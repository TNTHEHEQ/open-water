import test from 'node:test';
import assert from 'node:assert/strict';
import {SimulationHoldController,RollingPlanExecutionController,plantCapabilities} from '../site/js/integration/plan-execution.js';
import {CommandMux} from '../site/js/control/command-authority.js';
import {VESSEL_SPECS} from '../site/js/simulation/vessels.js';
import {parsePlannerMessage} from '../site/js/bridge/protocol.js';
function fixture(){
  const hold=new SimulationHoldController(),sent=[];
  const mux=new CommandMux({setActuatorCommands:()=>{}},{maxSteerRad:Math.PI/6});
  const bridge={simulationTime:7,claimed:true,now:()=>10,send:m=>{sent.push(m);return true;},
    diagnostics:{stateSequence:2,obstacleSequence:3},update:()=>{}};
  const e=new RollingPlanExecutionController(bridge,mux,hold,plantCapabilities(VESSEL_SPECS.zodiac_boat));
  mux.setMode('EXTERNAL');mux.external.receive(.01,.03,10);mux.apply(10);e.owns=true;e.status='EXECUTING_PREFIX';
  return {hold,sent,mux,bridge,e};
}
test('P7B1 prefix completion holds without neutral/manual or ownership loss',()=>{
  const {hold,mux,e}=fixture();
  e.receive({status:'PLAN_PREFIX_COMPLETE'});
  assert.equal(e.status,'HOLD_REPLAN');assert.equal(hold.held,true);assert.equal(mux.mode,'EXTERNAL');
  assert.equal(e.owns,true);assert.equal(mux.external.command.propulsionCommand,.01);
  e.metrics={t_rel:2};e.request({timestamp:7});assert.equal(e.status,'PLANNING');assert.deepEqual(e.metrics,{});
  assert.equal(e.allowControl({type:'control_command'}),true);
  assert.equal(mux.external.command.steeringAngleRad,.03);
});
test('P7B1 only explicit actual TASK_COMPLETE releases ownership',()=>{
  const {hold,mux,e}=fixture();
  e.receive({status:'TASK_COMPLETE'});assert.equal(e.status,'TASK_COMPLETE');
  assert.equal(hold.held,true);assert.equal(mux.mode,'MANUAL');assert.equal(e.owns,false);
});
test('P7B1 held timeout aborts and keeps simulation held',()=>{
  const {hold,mux,e}=fixture();e.receive({status:'PLAN_PREFIX_COMPLETE'});
  mux.external.receive(.01,.03,9);mux.apply(10);e.update({timestamp:7});
  assert.equal(e.failures,1);assert.equal(e.status,'ABORTED');assert.equal(hold.held,true);
});
test('P7B1 prefix statuses are protocol checked and execution needs fresh held ACK',()=>{
  for(const status of ['EXECUTING_PREFIX','PLAN_PREFIX_COMPLETE','TASK_COMPLETE']){
    assert.equal(parsePlannerMessage(JSON.stringify({protocol_version:1,type:'execution_status',status,reason:'',plan_id:'p'})).status,status);
  }
  const {hold,e}=fixture();e.receive({status:'PLAN_PREFIX_COMPLETE'});e.receive({status:'ARMED'});
  assert.equal(e.status,'ABORTED');assert.equal(hold.held,true);
});
