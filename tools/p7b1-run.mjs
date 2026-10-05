// Deterministic real-Boat rolling execution; no physical state assignments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import WebSocket from 'ws';
import * as THREE from 'three';
import { WaveField } from '../site/js/simulation/waves.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
import { SimulationStateSource } from '../site/js/twin/simulation-state-source.js';
import { CommandMux } from '../site/js/control/command-authority.js';
import { PlannerBridge } from '../site/js/bridge/planner-bridge.js';
import { plantCapabilities,SimulationHoldController,RollingPlanExecutionController,P6BTestPreconditioner } from '../site/js/integration/plan-execution.js';
globalThis.window??={location:{search:''}};
globalThis.matchMedia??=()=>({matches:false});
const {Boat}=await import('../site/js/simulation/boat.js');
const owRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.resolve(owRoot,'../all-in-planner');
const out=path.join(root,'research/lifted_stp/results/p7b1_openwater_rolling');
const contract=JSON.parse(fs.readFileSync(path.join(out,'rolling_contract.json'),'utf8'));
const config=path.join(root,'research/lifted_stp/results/p7a_openwater_tracking/openwater_tracking_v1.json');
const smoke=process.argv.includes('--smoke'),name=smoke?'smoke':'h1',maxCycles=smoke?2:contract.max_cycles;
const directory=path.join(out,'campaigns',name),owDirectory=path.join(owRoot,'results/p7b1_rolling',name);
if(fs.existsSync(path.join(directory,'result.json')))throw Error('Existing campaign; do not overwrite');
fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(owDirectory,{recursive:true});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const filehash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(filehash(config)!==contract.controller_sha256)throw Error('Frozen controller changed');
const child=spawn(path.join(root,'build/linux-release/cpp/lifted_stp/openwater/p6b_openwater_server'),['8771',directory,config],
  {cwd:root,env:{...process.env,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'}});
let consoleOutput='',timer,bridge,execution,mux,hold,source,boat,water;
child.stdout.on('data',b=>{consoleOutput+=b;});child.stderr.on('data',b=>{consoleOutput+=b;});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,seconds=180){
  const start=performance.now();
  while(!fn()){
    if(child.exitCode!==null)throw Error('Native server exited '+consoleOutput.slice(-1000));
    if(execution?.status==='SOLVER_ERROR')throw Error('Native protocol SOLVER_ERROR');
    if(performance.now()-start>seconds*1000)throw Error('Protocol wall timeout: '+execution?.status);
    await pause(1);
  }
}
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const telemetry=[],cycles=[],handover=[],holds=[],commands=[],events=[];
let report={status:'RUNNING',name,state_origin:'OPENWATER_ACTUAL_TELEMETRY',controller_sha256:filehash(config)},initial,frame;
const physical=state=>({water_time:water.time,timestamp:state.timestamp,pose:state.pose,velocity:state.velocity,actuator:state.actuator,attitude:state.attitude,control:state.control});
const world=state=>{
  const E=state.pose.position.x-frame.E_ref,N=state.pose.position.y-frame.N_ref;
  return {s:Math.sin(frame.H_ref)*E+Math.cos(frame.H_ref)*N,l:-Math.cos(frame.H_ref)*E+Math.sin(frame.H_ref)*N,
    psi:Math.atan2(Math.sin(frame.H_ref-state.pose.headingRad),Math.cos(frame.H_ref-state.pose.headingRad))};
};
function checkPhysical(state){
  const w=world(state),r=Math.hypot(3.2/3,1),offsets=[-6.4/3,0,6.4/3];
  const clear=Math.min(...offsets.flatMap(x=>[w.l+Math.sin(w.psi)*x+10-r,10-w.l-Math.sin(w.psi)*x-r]));
  if(!Object.values(w).every(Number.isFinite)||!Number.isFinite(clear))throw Error('NONFINITE');
  if(clear<0)throw Error('BANK_COLLISION');
  const a=state.actuator;
  if(Math.abs(a.steeringRateRadPerSec)>Math.PI/4+1e-9||Math.abs(a.steeringActualRad)>Math.PI/6+1e-9
    ||a.rawThrustN<0||a.rawThrustN>220+1e-8||Math.abs(state.control.steeringCommandRad)>Math.PI/6+1e-9
    ||state.control.propulsionCommand*boat.spec.maxThrustFwd>200+1e-8)throw Error('ACTUATOR_CONTRACT_VIOLATION');
  return {physical_bank_clearance:clear,residual_bank_margin:clear-.5,...w};
}
try{
  await until(()=>consoleOutput.includes('P6B LISTEN'),30);
  water=new WaveField();water.setSeaPreset(contract.sea_preset);
  boat=new Boat(water,new THREE.Scene(),0);boat.setSpec(VESSEL_SPECS.zodiac_boat);boat.reset();
  source=new SimulationStateSource(boat,water);source.update();
  mux=new CommandMux(boat,{maxSteerRad:boat.spec.maxSteerRad});hold=new SimulationHoldController();
  let obstacleSequence=0;
  bridge=new PlannerBridge(mux,{endpoint:'ws://127.0.0.1:8771',socketFactory:u=>new WebSocket(u),visualizationOnly:false,
    obstacleSource:t=>({protocol_version:1,type:'obstacle_state',sequence:obstacleSequence++,simulation_time:t,obstacles:[]}),
    onPlan:p=>execution.onPlan(p)});
  execution=new RollingPlanExecutionController(bridge,mux,hold,plantCapabilities(boat.spec));bridge.execution=execution;
  const originalReceive=bridge.receive.bind(bridge);
  bridge.receive=text=>{
    const m=JSON.parse(text);
    if(m.type==='control_command')commands.push({wall_sec:performance.now()/1000,hold:hold.held,phase:execution.status,...m});
    if(m.type==='execution_status'||m.type==='set_control_mode')events.push({t_sim:water.time,...m});
    originalReceive(text);
  };
  const pre=new P6BTestPreconditioner(mux,boat.spec,hold);pre.start();
  while(pre.active){pre.update(source.getState(),contract.dt_sec);mux.apply(performance.now()/1000);
    const dt=hold.timestep(contract.dt_sec);water.update(dt,boat.pos.x,boat.pos.z);boat.update(dt);source.update();}
  if(pre.status!=='READY')throw Error('PRECONDITIONING_FAILURE');
  initial=source.snapshot();frame={E_ref:initial.pose.position.x,N_ref:initial.pose.position.y,H_ref:initial.pose.headingRad};
  report.initial=initial;report.episode_frame=frame;report.preconditioning=pre.status;
  telemetry.push({cycle_id:null,state:initial,phase:'HOLD_INITIAL_PLAN',...checkPhysical(initial)});
  timer=setInterval(()=>{mux.apply(performance.now()/1000);execution.update(source.getState());},20);
  bridge.start();await until(()=>bridge.diagnostics.connected,15);
  let previousFinal=null;
  for(let cycle=0;cycle<maxCycles;cycle++){
    if(!hold.held)throw Error('SOLVE_WITHOUT_HOLD');
    mux.apply(performance.now()/1000);source.update();
    const snapshot=source.snapshot(),before=physical(snapshot),commandsBefore=commands.length,wallStart=performance.now();
    if(previousFinal&&hash(before)!==hash(previousFinal))throw Error('ROLLING_INITIAL_STATE_MISMATCH');
    execution.request(source.getState());
    const requestSequence=execution.requestSourceSequence;
    await until(()=>['PLAN_READY','SOLVER_ERROR','ABORTED'].includes(execution.status));
    const wall=(performance.now()-wallStart)/1000,after=physical(source.snapshot());
    if(hash(before)!==hash(after))throw Error('HOLD_STATE_CHANGED_DURING_SOLVE');
    const planFile=path.join(directory,'plan-'+(cycle+1)+'.json');
    if(!fs.existsSync(planFile)){
      report.failure_cycle=cycle;report.failure_snapshot=snapshot;
      report.failure=JSON.parse(fs.readFileSync(path.join(directory,'plan-'+(cycle+1)+'-error.json'),'utf8'));
      throw Error('REAL_PLANT_REPLAN_FAILURE: '+report.failure.error);
    }
    const native=JSON.parse(fs.readFileSync(planFile,'utf8'));
    const w=world(snapshot),b=snapshot.velocity.body,a=snapshot.actuator,c=snapshot.control;
    const u=b.surge,v=-b.sway,psi=w.psi,wt=Math.cos(psi)*u-Math.sin(psi)*v,wn=Math.sin(psi)*u+Math.cos(psi)*v;
    const expected=[w.l,wn/wt,0,psi,u,v,-b.yawRate,a.rawThrustN,-a.steeringActualRad,c.propulsionCommand*boat.spec.maxThrustFwd,-c.steeringCommandRad];
    const error=Math.max(...expected.map((x,i)=>Math.abs(x-native.initial[i])));
    handover.push({cycle_id:cycle,previous_final_actual_hash:previousFinal?hash(previousFinal):null,
      held_actual_hash:hash(before),expected_transformed_initial_hash:hash(expected),native_initial_hash:hash(native.initial),
      actual_fields:snapshot,native_initial:native.initial,expected_initial:expected,max_transform_difference:error,
      state_origin:'OPENWATER_ACTUAL_TELEMETRY',source_state_sequence:requestSequence,source_sim_time:snapshot.timestamp,
      plan_id:native.message?.plan_id,world_s:w.s,hold_before:before,hold_after:after,hold_wall_sec:wall});
    if(error>1e-10||native.source.sequence!==requestSequence||Math.abs(native.world_s_origin-w.s)>1e-10)throw Error('ROLLING_INITIAL_STATE_MISMATCH');
    if(execution.status!=='PLAN_READY'||!native.rounds?.every(r=>r.accepted)||native.execution_gate!=='PASS'){
      report.failure_cycle=cycle;report.failure=native;throw Error('REAL_PLANT_REPLAN_FAILURE');
    }
    const deltaTc=native.decision[9]-expected[9],deltaDc=native.decision[10]-expected[10];
    if(Math.abs(deltaTc)>1e-8||Math.abs(deltaDc)>1e-8)throw Error('COMMAND_HANDOVER_FAILURE');
    handover.at(-1).Delta_Tc_handover=deltaTc;handover.at(-1).Delta_deltac_handover=deltaDc;
    bridge.nextPublish=-Infinity;bridge.update(source.getState());
    execution.execute();await until(()=>['EXECUTING_PREFIX','ABORTED'].includes(execution.status),10);
    if(execution.status==='ABORTED')throw Error('ARMING_FAILURE');
    const start=snapshot.timestamp,end=start+Math.min(2,execution.plan.points.at(-1).t_rel);
    while(execution.status==='EXECUTING_PREFIX'){
      const dt=Math.min(contract.dt_sec,Math.max(0,end-water.time));if(dt<=1e-12)throw Error('PREFIX_BOUNDARY_PROTOCOL_FAILURE');
      mux.apply(performance.now()/1000);water.update(hold.timestep(dt),boat.pos.x,boat.pos.z);boat.update(hold.timestep(dt));source.update();
      const stamp=source.getState().timestamp;
      bridge.nextPublish=-Infinity;bridge.update(source.getState());
      await until(()=>execution.status!=='EXECUTING_PREFIX'||execution.metrics.t_rel>=stamp-start-1e-9,5);
      mux.apply(performance.now()/1000);source.update();
      execution.update(source.getState());
      if(mux.failsafe||execution.failures)throw Error('COMMAND_TIMEOUT');
      const actual=source.snapshot(),clear=checkPhysical(actual);
      telemetry.push({cycle_id:cycle,state:actual,phase:execution.status,plan_id:execution.plan.plan_id,metrics:{...execution.metrics},...clear});
      if(bridge.diagnostics.invalidMessages)throw Error('PROTOCOL_INVALID_MESSAGE');
    }
    if(!['HOLD_REPLAN','TASK_COMPLETE'].includes(execution.status))throw Error('EXECUTION_FAILURE '+execution.status);
    const final=source.snapshot();
    cycles.push({cycle_id:cycle,plan_id:execution.plan.plan_id,source_state_sequence:requestSequence,source_sim_time:start,
      prefix_start:start,prefix_end:final.timestamp,duration:final.timestamp-start,s_world_start:w.s,s_world_end:world(final).s,
      status:execution.status,solver:native.rounds,solve_wall_sec:wall,continuity:native.continuity,commands_during_solve:commands.length-commandsBefore});
    previousFinal=physical(final);
    console.log('PREFIX',cycle,'duration',final.timestamp-start,'s_world',world(final).s,'phase',execution.status);
    if(execution.status==='TASK_COMPLETE')break;
    if(cycle===0){
      const heldBefore=physical(source.snapshot()),n=commands.length,t0=performance.now();let failsafe=0;
      while(performance.now()-t0<contract.hold_wall_test_sec*1000){
        const dt=hold.timestep(contract.dt_sec);water.update(dt,boat.pos.x,boat.pos.z);boat.update(dt);mux.apply(performance.now()/1000);
        source.update();if(mux.failsafe)failsafe++;
        if(hash(physical(source.snapshot()))!==hash(heldBefore))throw Error('HOLD_KEEPALIVE_STATE_CHANGED');
        await pause(20);
      }
      const cmd=commands.slice(n),gaps=cmd.slice(1).map((x,i)=>x.wall_sec-cmd[i].wall_sec);
      const identical=cmd.every(x=>x.propulsion_command===cmd[0].propulsion_command&&x.steering_angle_rad===cmd[0].steering_angle_rad);
      if(!cmd.length||!identical||failsafe||Math.max(...gaps)>.5)throw Error('HOLD_KEEPALIVE_FAILURE');
      holds.push({cycle_id:cycle,wall_sec:(performance.now()-t0)/1000,keepalive_count:cmd.length,max_gap_sec:Math.max(...gaps),
        commands_identical:identical,failsafe_count:failsafe,before:heldBefore,after:physical(source.snapshot()),state_publications:0,phase:execution.status,control_mode:mux.mode});
    }
  }
  report.status=execution.status==='TASK_COMPLETE'?'H1_ROLLING_TASK_COMPLETE':'H1_ROLLING_TASK_INCOMPLETE';
  report.final=source.snapshot();
}catch(error){
  report.status=String(error).includes('REAL_PLANT_REPLAN_FAILURE')?'REAL_PLANT_REPLAN_FAILURE':'ROLLING_INFRASTRUCTURE_FAILURE';
  report.error=String(error);report.final=source?.snapshot();process.exitCode=1;
}finally{
  clearInterval(timer);hold?.hold();
  report.cycles=cycles;report.state_handover=handover;report.hold_checks=holds;report.events=events;
  report.bridge_diagnostics=bridge?.diagnostics;report.commands=commands;
  write(path.join(directory,'result.json'),report);write(path.join(owDirectory,'result.json'),report);
  write(path.join(owDirectory,'telemetry.json'),telemetry);
  write(path.join(owDirectory,'events.json'),execution?.events??[]);
  fs.writeFileSync(path.join(owDirectory,'bridge-console.txt'),consoleOutput);
  bridge?.stop();child.stdin.end('QUIT\n');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));
  console.log(report.status,report.error??'',cycles.length,'prefixes');
}
