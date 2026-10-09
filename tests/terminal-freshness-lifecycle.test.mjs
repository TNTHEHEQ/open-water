import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PhysicalCommandApplicationLimiter} from '../site/js/integration/physical-command-limiter.js';
const make=()=>new PhysicalCommandApplicationLimiter({setActuatorCommands(){}},
 {maxThrustForwardN:10500,initialThrustN:100,initialSteeringRad:.01,initialPhysicalTime:1});
function msg(sequence=10,generation=1,episode_id=1,timestamp=1,Tc=100,delta=.01){
 return {protocol_version:1,type:'physical_command_target',episode_id,generation,reference_command:{Tc,delta},
 command:{protocol_version:1,type:'control_command',sequence,timestamp,propulsion_command:Tc/10500,steering_angle_rad:delta}};
}
const receive=(x,m,wallTime=1,physicalTime=1)=>x.receive(m,{wallTime,physicalTime});
test('identity advance changes ONLY generation, preserving freshness and all command/physical history',()=>{
 const x=make();receive(x,msg());const before={...x};x.setIdentity(1,2);
 assert.deepEqual({...x},{...before,generation:2});
});
test('original 1.500 deadline survives identity advance at 1.300; never extends to 1.800',()=>{
 const x=make();receive(x,msg());assert.equal(x.age(1.3),.30000000000000004);x.setIdentity(1,2);
 assert.equal(x.receiptWallSec,1);assert.equal(x.isFresh(1.499),true);assert.equal(x.isFresh(1.5),true);
 assert.equal(x.isFresh(1.501),false);
 assert.throws(()=>x.applyPhysicalTick({dt:.02,physicalTime:1.02,wallTime:1.501}),/COMMAND_TIMEOUT_FAILSAFE/);
});
test('real gen2 neutral at 1.320 sets its actual receipt deadline to 1.820',()=>{
 const x=make();receive(x,msg());x.setIdentity(1,2);
 assert.equal(receive(x,msg(11,2,1,1.02,0,0),1.32,1.02).accepted,true);
 assert.equal(x.receiptWallSec,1.32);assert.equal(x.isFresh(1.819),true);assert.equal(x.isFresh(1.821),false);
});
test('sequence and sender timestamp restrictions survive generation advance',()=>{
 const x=make();receive(x,msg());x.setIdentity(1,2);
 assert.equal(receive(x,msg(10,2)).reason,'STALE_SEQUENCE');
 assert.equal(receive(x,msg(11,2,1,.99)).reason,'INVALID_SENDER_TIMESTAMP');
 assert.equal(receive(x,msg(11,2,1,1.01)).reason,'INVALID_SENDER_TIMESTAMP');
 assert.equal(receive(x,msg(11,2),2,2).reason,'STALE_COMMAND_AGE');
 assert.equal(x.lastSequence,10);assert.equal(x.lastTimestamp,1);assert.equal(x.receiptWallSec,1);
});
for(const [label,gen,episode] of [['old',1,1],['future',3,1],['wrong episode',2,2]]){
 test(label+' command still rejected without refreshing age',()=>{
  const x=make();receive(x,msg());x.setIdentity(1,2);
  assert.equal(receive(x,msg(11,gen,episode),1.3).reason,'EPISODE_GENERATION_MISMATCH');
  assert.equal(x.receiptWallSec,1);assert.equal(x.generation,2);
 });
}
test('explicit freshness invalidate remains available for actual authority loss',()=>{
 const x=make();receive(x,msg());x.setIdentity(1,2);x.invalidate();
 assert.equal(x.receiptWallSec,null);assert.equal(x.isFresh(1.01),false);
});
test('exact P8F1 20.071429 ms gap crosses physical tick with original deadline and slew budget',()=>{
 const x=make();receive(x,msg(10,1,1,1,200,.5));const receipt=x.receiptWallSec;
 const before={...x.applied};x.setIdentity(1,2);
 const tick=x.applyPhysicalTick({dt:.02,physicalTime:1.02,wallTime:1.02});
 assert.equal(x.receiptWallSec,receipt);assert.ok(Math.abs(x.age(1.02)-.02)<1e-12);
 assert.ok(Math.abs(tick.applied_Tc-before.Tc-.4)<1e-10);
 assert.ok(Math.abs(tick.applied_delta-before.delta-.003)<1e-10);
 assert.equal(receive(x,msg(11,2,1,1.02,0,0),1.020071429,1.02).accepted,true);
 assert.equal(x.receiptWallSec,1.020071429);
});
test('actual historical P8F1 receipt/command fixture: no false timeout before neutral',()=>{
 const root=new URL('../../all-in-planner/research/lifted_stp/results/p8f1_terminal_lifecycle/run_20261007T161221Z_h1/',import.meta.url);
 const rows=fs.readFileSync(new URL('lifecycle_messages.jsonl',root),'utf8').trim().split('\n').map(JSON.parse);
 const active=rows.find(r=>r.rx_index===4098),inv=rows.find(r=>r.rx_index===4100),neutral=rows.find(r=>r.rx_index===4101);
 const x=new PhysicalCommandApplicationLimiter({setActuatorCommands(){}},{maxThrustForwardN:10500,initialThrustN:active.target.Tc,initialSteeringRad:active.target.delta,initialPhysicalTime:active.simulation_time});
 const from=r=>msg(r.command_sequence,r.generation,r.episode_id,r.sender_timestamp,r.propulsion_command*10500,r.steering_angle_rad);
 receive(x,from(active),active.wall_sec,active.simulation_time);x.setIdentity(1,2);
 const mid=inv.wall_sec+.01;
 assert.equal(x.isFresh(mid),true);
 x.applyPhysicalTick({dt:.02,physicalTime:active.simulation_time+.02,wallTime:mid});
 assert.equal(receive(x,from(neutral),neutral.wall_sec,neutral.simulation_time).accepted,true);
 assert.equal(x.generation,2);
});
