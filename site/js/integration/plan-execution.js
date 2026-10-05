export function plantCapabilities(spec) {
  const a=spec.actuator;
  const message={protocol_version:1,type:'plant_capabilities',vessel_id:'usv001',actuator:{max_thrust_fwd_n:spec.maxThrustFwd,max_thrust_rev_n:spec.maxThrustRev,propulsion_time_constant_sec:a.propulsionTimeConstantSec,steering_min_rad:a.steeringMinRad,steering_max_rad:a.steeringMaxRad,steering_time_constant_sec:a.steeringTimeConstantSec,steering_rate_rad_per_sec:a.steeringRateRadPerSec}};
  if(!Object.values(message.actuator).every(Number.isFinite)||a.propulsionTimeConstantSec<=0||a.steeringTimeConstantSec<=0)throw new TypeError('P6B requires finite realistic actuator profile');
  return message;
}
export class SimulationHoldController {
  held=false;
  hold(){this.held=true;}
  release(){this.held=false;}
  timestep(frameDt){return this.held?0:frameDt;}
}
// Debug/integration-only test harness, independent of planner tracking controller.
export class P6BTestPreconditioner {
  constructor(mux,spec,hold){this.mux=mux;this.spec=spec;this.hold=hold;this.active=false;this.status='IDLE';}
  start(){this.mux.setMode('MANUAL');this.hold.release();this.active=true;this.integral=0;this.stable=0;this.elapsed=0;this.status='PRECONDITIONING';}
  update(state,dt){
    if(!this.active)return;
    const error=2-state.velocity.body.surge;
    this.elapsed+=dt;this.integral=Math.max(-100,Math.min(100,this.integral+30*error*dt));
    const force=Math.max(0,Math.min(200,162+150*error+this.integral));
    this.mux.setControls(force/this.spec.maxThrustFwd,0);
    this.stable=Math.abs(error)<.08?this.stable+dt:0;
    if(this.stable>=3||this.elapsed>120){this.active=false;this.status=this.stable>=3?'READY':'FAILED';this.hold.hold();}
  }
}
export class PlanExecutionController {
  constructor(bridge,mux,hold,capabilities){this.bridge=bridge;this.mux=mux;this.hold=hold;this.capabilities=capabilities;this.status='IDLE';this.requestId=0;this.plan=null;this.metrics={};this.ack=false;this.rows=[];this.events=[];this.failures=0;this.wasFailsafe=false;this.owns=false;}
  event(value){this.events.push({status:value,time:this.bridge.simulationTime});if(this.events.length>1000)this.events.shift();}
  connected(){this.bridge.send(this.capabilities);}
  request(state,scenario){
    if(this.owns||this.status==='PLANNING')throw new Error('Execution busy');
    this.hold.hold();this.plan=null;this.status='PLANNING';this.bridge.nextPublish=-Infinity;this.bridge.update(state);
    this.requestSourceSequence=this.bridge.diagnostics.stateSequence-1;
    this.bridge.minimumSourceSequence=this.requestSourceSequence;
    this.bridge.send({protocol_version:1,type:'plan_request',request_id:++this.requestId,state_sequence:this.bridge.diagnostics.stateSequence-1,simulation_time:state.timestamp,obstacle_sequence:this.bridge.diagnostics.obstacleSequence,hold:true,scenario});this.event('PLANNING');
  }
  onPlan(plan){if(this.requestSourceSequence!==undefined&&plan.source_state_sequence!==this.requestSourceSequence)return;this.plan=plan;this.status=plan.status==='SUCCESS'&&plan.execution_capable?'PLAN_READY':'SOLVER_ERROR';}
  execute(){if(!this.hold.held||this.status!=='PLAN_READY'||!this.plan?.execution_capable)throw new Error('No executable held plan');this.status='ARMING';this.owns=true;this.ack=false;this.rows=[];this.failures=0;this.wasFailsafe=false;
    this.bridge.send({protocol_version:1,type:'execute_plan',plan_id:this.plan.plan_id,simulation_time:this.bridge.simulationTime,hold:true});this.event('ARMING');}
  allowControl(message){return this.owns&&['ARMING','EXECUTING','FINISHING'].includes(this.status)&&(['set_control_mode','control_command'].includes(message.type));}
  onControl(){if(this.status==='ARMING'&&!this.ack&&this.bridge.claimed&&this.mux.external.isFresh(this.bridge.now(),.5)&&this.hold.held){this.ack=true;this.bridge.send({protocol_version:1,type:'execution_ack',plan_id:this.plan.plan_id,hold:true});}}
  receive(m){
    this.metrics=m.metrics??this.metrics;
    if(m.status==='ARMED'){
      if(!this.owns||!this.hold.held||!this.ack||this.mux.mode!=='EXTERNAL'||!this.mux.external.isFresh(this.bridge.now(),.5)){this.abort('INVALID_ARMED');return;}
      this.status='EXECUTING';this.hold.release();this.event('ARMED');return;
    }
    if(m.status==='COMPLETE'){this.status='COMPLETE';this.owns=false;this.mux.setControls(0,0);this.mux.setMode('MANUAL');this.bridge.claimed=false;this.hold.hold();this.event('COMPLETE');return;}
    if(m.status.startsWith('REJECTED')||m.status==='ABORTED'||m.status==='SOLVER_ERROR'){this.abort(m.reason||m.status,false);this.status=m.status;this.event(m.reason||m.status);return;}
    this.status=m.status;if(m.status!=='EXECUTING')this.event(m.status);
  }
  update(state){
    if(this.owns&&this.status==='EXECUTING'&&this.mux.failsafe&&!this.wasFailsafe){this.failures++;this.abort('COMMAND_TIMEOUT');}
    this.wasFailsafe=this.mux.failsafe;
    if(this.owns&&this.status==='EXECUTING'&&this.rows.length<30000)this.rows.push({simulation_time:state.timestamp,plan_id:this.plan?.plan_id,control_mode:this.mux.mode,failsafe:this.mux.failsafe,...this.metrics});
  }
  abort(reason='LOCAL_ABORT',notify=true){
    // Local ownership return never waits for the network. Actuator state is not reset.
    this.mux.setControls(0,0);this.mux.setMode('MANUAL');this.bridge.claimed=false;this.mux.external.invalidate();this.mux.apply(this.bridge.now());this.hold.release();this.owns=false;this.status='ABORTED';
    if(notify)this.bridge.send({protocol_version:1,type:'execution_abort',reason});this.event(reason);
  }
  disconnected(){if(this.owns||this.status==='PLANNING')this.abort('DISCONNECTED',false);}
}

// Explicit integration-only mode; legacy P6B remains one-shot.
export class RollingPlanExecutionController extends PlanExecutionController {
  request(state,scenario='H1_ROLLING'){
    if(scenario!=='H1_ROLLING'||(this.owns&&this.status!=='HOLD_REPLAN'))throw new Error('Invalid rolling request phase');
    this.metrics={}; // Previous-cycle t_rel must never satisfy the next-cycle state ACK.
    this.hold.hold();this.plan=null;this.status='PLANNING';this.bridge.nextPublish=-Infinity;this.bridge.update(state);
    this.requestSourceSequence=this.bridge.diagnostics.stateSequence-1;this.bridge.minimumSourceSequence=this.requestSourceSequence;
    this.bridge.send({protocol_version:1,type:'plan_request',request_id:++this.requestId,state_sequence:this.requestSourceSequence,simulation_time:state.timestamp,obstacle_sequence:this.bridge.diagnostics.obstacleSequence,hold:true,scenario});
    this.event(this.owns?'HOLD_REPLAN':'HOLD_INITIAL_PLAN');
  }
  execute(){
    const rows=this.rows,failures=this.failures;
    super.execute();this.rows=rows;this.failures=failures;
  }
  allowControl(message){
    return this.owns&&['ARMING','EXECUTING_PREFIX','HOLD_REPLAN','PLANNING','PLAN_READY'].includes(this.status)
      &&['set_control_mode','control_command'].includes(message.type);
  }
  receive(message){
    this.metrics=message.metrics??this.metrics;
    if(message.status==='PLAN_PREFIX_COMPLETE'){
      if(!this.owns||this.status!=='EXECUTING_PREFIX'){this.abort('INVALID_PREFIX_COMPLETE');return;}
      this.hold.hold();this.status='HOLD_REPLAN';this.event('PLAN_PREFIX_COMPLETE');return;
    }
    if(message.status==='TASK_COMPLETE'){
      this.hold.hold();this.owns=false;this.status='TASK_COMPLETE';this.mux.setControls(0,0);this.mux.setMode('MANUAL');this.bridge.claimed=false;this.event('TASK_COMPLETE');return;
    }
    if(message.status==='EXECUTING_PREFIX'){this.status='EXECUTING_PREFIX';return;}
    super.receive(message);
    if(message.status==='ARMED'&&this.status==='EXECUTING')this.status='EXECUTING_PREFIX';
  }
  update(state){
    if(this.owns&&this.mux.failsafe){this.failures++;this.abort('COMMAND_TIMEOUT');return;}
    if(this.owns&&this.status==='EXECUTING_PREFIX')this.rows.push({simulation_time:state.timestamp,plan_id:this.plan?.plan_id,control_mode:this.mux.mode,failsafe:this.mux.failsafe,...this.metrics});
  }
  abort(reason='LOCAL_ABORT',notify=true){super.abort(reason,notify);this.hold.hold();}
}
