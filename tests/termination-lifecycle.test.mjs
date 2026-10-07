import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PhysicalCommandApplicationLimiter } from '../site/js/integration/physical-command-limiter.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/p8f-terminal-order.json',import.meta.url)));
const envelope=row=>({protocol_version:1,type:'physical_command_target',episode_id:row.episode_id,generation:row.generation,reference_command:row.reference_command,
 command:Object.fromEntries(['protocol_version','type','sequence','timestamp','propulsion_command','steering_angle_rad'].map(k=>[k,row[k]]))});
function setup(){
 const limiter=new PhysicalCommandApplicationLimiter({setActuatorCommands(){}},{maxThrustForwardN:10500,initialThrustN:100,initialSteeringRad:0,initialPhysicalTime:fixture.previous.receipt_sim_time});
 const receive=row=>limiter.receive(envelope(row),{wallTime:row.wall_sec,physicalTime:fixture.neutral.receipt_sim_time});
 assert.equal(receive(fixture.previous).accepted,true);
 return {limiter,receive};
}
test('exact P8F old wire order: future generation neutral is correctly rejected',()=>{
 const {limiter,receive}=setup();
 assert.deepEqual(receive(fixture.neutral),{accepted:false,reason:'EPISODE_GENERATION_MISMATCH'});
 assert.equal(limiter.generation,1);assert.equal(limiter.lastSequence,fixture.previous.sequence);
});
test('same fixture with INVALIDATE before neutral: accepted without resetting sequence/timestamp',()=>{
 const {limiter,receive}=setup();
 limiter.setIdentity(fixture.invalidate.episode_id,fixture.invalidate.generation);
 assert.equal(limiter.lastSequence,fixture.previous.sequence);
 assert.equal(limiter.lastTimestamp,fixture.previous.timestamp);
 const result=receive(fixture.neutral);
 assert.deepEqual(result,{accepted:true,target:{Tc:0,delta:0}});
 assert.ok(fixture.neutral.sequence>fixture.previous.sequence);
 assert.ok(fixture.neutral.timestamp>=fixture.previous.timestamp);
 assert.ok(fixture.neutral.timestamp<=fixture.neutral.receipt_sim_time+1e-8);
});
for(const [name,episode,generation] of [['skip',1,3],['wrong episode',2,2],['duplicate',1,2]]){
 test('trusted lifecycle rejects '+name,()=>{
  const {limiter}=setup();if(name==='duplicate')limiter.setIdentity(1,2);
  assert.throws(()=>limiter.setIdentity(episode,generation),/INVALID_LIFECYCLE_IDENTITY/);
 });
}
test('old generation commands remain rejected after INVALIDATE',()=>{
 const {limiter,receive}=setup();limiter.setIdentity(1,2);
 assert.equal(receive({...fixture.neutral,generation:1}).reason,'EPISODE_GENERATION_MISMATCH');
});
test('rollover does not bypass stale sequence, sender timestamp or command age',()=>{
 const {limiter,receive}=setup();limiter.setIdentity(1,2);
 assert.equal(receive({...fixture.neutral,sequence:fixture.previous.sequence}).reason,'STALE_SEQUENCE');
 assert.equal(receive({...fixture.neutral,timestamp:fixture.previous.timestamp-.01}).reason,'INVALID_SENDER_TIMESTAMP');
 assert.equal(receive({...fixture.neutral,timestamp:fixture.neutral.receipt_sim_time+.01}).reason,'INVALID_SENDER_TIMESTAMP');
 const old=fixture.neutral.timestamp+.6;
 assert.equal(limiter.receive(envelope(fixture.neutral),{wallTime:old,physicalTime:old}).reason,'STALE_COMMAND_AGE');
});
