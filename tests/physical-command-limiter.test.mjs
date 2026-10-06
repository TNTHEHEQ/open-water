import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicalCommandApplicationLimiter } from '../site/js/integration/physical-command-limiter.js';
import { CommandMux } from '../site/js/control/command-authority.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function setup(Tc=100,delta=0,time=0){
 const writes=[];const sink={setActuatorCommands:c=>writes.push({...c})};
 const limiter=new PhysicalCommandApplicationLimiter(sink,{maxThrustForwardN:10500,initialThrustN:Tc,initialSteeringRad:delta,initialPhysicalTime:time});
 const receive=(seq,Tc,delta=0,timestamp=time,identity={})=>limiter.receive({protocol_version:1,type:'physical_command_target',episode_id:1,generation:1,...identity,
  reference_command:{Tc:Tc+10,delta:delta+.1},command:{protocol_version:1,type:'control_command',sequence:seq,timestamp,propulsion_command:Tc/10500,steering_angle_rad:delta}},
  {wallTime:timestamp,physicalTime:Math.max(timestamp,time)});
 const tick=(t,dt=.02,wallTime=t)=>limiter.applyPhysicalTick({dt,physicalTime:t,wallTime});
 return {limiter,writes,sink,receive,tick};
}
test('A one command per physical tick preserves ordinary rate-limited commands',()=>{
 const s=setup();for(let k=1;k<=5;k++){s.receive(k,100+.4*k,.003*k,(k-1)*.02);const log=s.tick(k*.02);close(log.applied_Tc,100+.4*k);close(log.applied_delta,.003*k);}
 assert.equal(s.writes.length,5);
});
test('B two messages coalesce without applying or advancing previous physical state',()=>{
 const s=setup();s.receive(1,100.4);s.receive(2,100.8);assert.equal(s.writes.length,0);close(s.limiter.applied.Tc,100);
 const x=s.tick(.02);close(x.applied_Tc,100.4);close(x.target_Tc,100.8);assert.equal(x.commands_received_this_tick,2);assert.equal(x.coalesced_count,1);assert.equal(x.first_sequence,1);assert.equal(x.last_sequence,2);
});
test('C ten messages still consume only one physical thrust budget',()=>{
 const s=setup();for(let k=1;k<=10;k++)s.receive(k,100+.4*k);const x=s.tick(.02);close(x.applied_Tc,100.4);close(x.target_Tc,104);assert.equal(x.coalesced_count,9);
});
test('D steering burst is limited to 0.003 rad in one physical step',()=>{
 const s=setup();for(let k=1;k<=10;k++)s.receive(k,100,.003*k);close(s.tick(.02).applied_delta,.003);
});
test('E delayed older followed by current command retains newest sequence',()=>{
 const s=setup(100,0,.1);s.receive(10,100.4,0,.08);s.receive(11,100.8,0,.1);const x=s.tick(.12);close(x.target_Tc,100.8);close(x.applied_Tc,100.4);
});
test('F out-of-order and duplicate commands cannot overwrite target or refresh age',()=>{
 const s=setup();s.receive(10,101);assert.equal(s.receive(9,50).reason,'STALE_SEQUENCE');assert.equal(s.receive(10,50).reason,'STALE_SEQUENCE');close(s.limiter.target.Tc,101);assert.equal(s.tick(.02).received_command_count,1);
});
test('G switched plan reference can jump; physical history survives lifecycle invalidation',()=>{
 const s=setup();s.receive(1,100.4);s.tick(.02);s.receive(2,200,.5,.02);s.receive(3,180,.4,.02);
 const x=s.tick(.04);close(x.previous_applied_Tc,100.4);close(x.applied_Tc,100.8);close(x.reference_Tc,190);
 s.limiter.setIdentity(1,2);close(s.limiter.applied.Tc,100.8);assert.equal(s.receive(4,150,0,.04).reason,'EPISODE_GENERATION_MISMATCH');
 s.receive(4,150,0,.04,{generation:2});close(s.tick(.06).applied_Tc,101.2);
});
test('H no new messages: each real tick approaches retained target',()=>{
 const s=setup();s.receive(1,102,.012);for(let k=1;k<=8;k++){const x=s.tick(k*.02);close(x.applied_Tc,Math.min(102,100+.4*k));close(x.applied_delta,Math.min(.012,.003*k));assert.equal(x.received_command_count,k===1?1:0);}
});
test('I timeout holds physics and original emergency mux still selects neutral',()=>{
 const s=setup();s.receive(1,150);s.tick(.02);assert.throws(()=>s.tick(.04,.02,.501),/COMMAND_TIMEOUT_FAILSAFE/);close(s.limiter.applied.Tc,100.4);assert.equal(s.writes.length,1);
 const mux=new CommandMux(s.sink,{maxSteerRad:Math.PI/6});mux.setMode('EXTERNAL');mux.external.receive(150/10500,.1,0);mux.apply(.501);
 assert.equal(mux.failsafe,true);assert.deepEqual(s.writes.at(-1),{propulsionCommand:0,steeringAngleRad:0});close(s.limiter.applied.Tc,100.4);
});
test('identity, timestamp, protocol and amplitude validation',()=>{
 const s=setup(100,0,1);assert.equal(s.receive(1,110,0,1,{episode_id:2}).accepted,false);assert.equal(s.receive(1,110,0,.49).reason,'STALE_COMMAND_AGE');
 s.receive(2,300,1,1);close(s.limiter.target.Tc,200);close(s.limiter.target.delta,Math.PI/6);
 assert.equal(s.receive(3,50,0,.9).reason,'INVALID_SENDER_TIMESTAMP');
 assert.throws(()=>s.limiter.receive({},{wallTime:1,physicalTime:1}),/INVALID_TARGET_ENVELOPE/);
 assert.throws(()=>s.receive(4,NaN),/INVALID_TARGET_ENVELOPE/);
});
test('duplicate tick is rejected; limiter uses actual dt rather than message count or time',()=>{
 const s=setup();s.receive(1,150,.5);close(s.tick(.01,.01).applied_Tc,100.2);assert.throws(()=>s.tick(.01,.01),/DUPLICATE_OR_INVALID_PHYSICAL_TICK/);close(s.tick(.05,.04).applied_Tc,101);assert.equal(s.writes.length,2);
});
test('exact historical 40.08/40.10 burst keeps latest target but caps real 40.12 application',()=>{
 const previous=.017356093764889266*10500,s=setup(previous,0,40.10);
 s.receive(100,.017394189002984513*10500,0,40.08);s.receive(101,.01740210724287139*10500,0,40.10);
 const x=s.tick(40.12,.02,40.1);close(x.target_Tc,.01740210724287139*10500);close(x.applied_Tc-previous,.4);assert.ok(x.applied_Tc_rate<=20+1e-9);assert.equal(s.writes.length,1);
});
