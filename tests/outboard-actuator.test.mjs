import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OutboardActuator } from '../site/js/simulation/outboard-actuator.js';
import { REALISTIC_GENERIC_ACTUATOR as P, IDEAL_ACTUATOR, VESSEL_SPECS } from '../site/js/simulation/vessels.js';
globalThis.window ??= { location: { search: '' } };
globalThis.matchMedia ??= () => ({ matches: false });
const { Boat } = await import('../site/js/simulation/boat.js');
const h = 1 / 240, deg = Math.PI / 180;
const close = (x, y, tolerance = 1e-12) => assert.ok(Math.abs(x-y) <= tolerance, `${x} != ${y}`);
const water = {time:0,preset:1,heightAt:()=>0,velocityAt:(_x,_z,out)=>out.set(0,0,0),normalAt:(_x,_z,out)=>out.set(0,1,0)};
function boat() {const b=new Boat(water,new THREE.Scene(),0); b.setSpec(VESSEL_SPECS.zodiac_boat);b.reset();return b;}

test('steering commands saturate +50/-50 degrees to +30/-30, propulsion to +/-1',()=>{
  const a=new OutboardActuator(P);a.setCommands(2,50*deg);close(a.steeringCommandRad,30*deg);assert.equal(a.propulsionCommand,1);
  a.setCommands(-2,-50*deg);close(a.steeringCommandRad,-30*deg);assert.equal(a.propulsionCommand,-1);
});
test('large reversing steering steps hit and never exceed 45 deg/s',()=>{
  const a=new OutboardActuator(P);let max=0;
  for(let i=0;i<1920;i++){
    a.setCommands(0,(i<960?30:-30)*deg);const old=a.actualSteeringRad;a.update(h);
    close(a.steeringRateRadPerSec,(a.actualSteeringRad-old)/h);
    assert.ok(Math.abs(a.steeringRateRadPerSec)<=45*deg+1e-12);max=Math.max(max,Math.abs(a.steeringRateRadPerSec));
  }
  close(max,45*deg);
});
test('10 degree steering step follows discrete first-order solution monotonically',()=>{
  const a=new OutboardActuator(P);a.setCommands(0,10*deg);
  for(let i=1;i<=1200;i++){const old=a.actualSteeringRad;a.update(h);
    assert.ok(a.actualSteeringRad>=old&&a.actualSteeringRad<10*deg);
    close(a.actualSteeringRad,10*deg*(1-(1-h/P.steeringTimeConstantSec)**i));
  }
  assert.ok(Math.abs(a.actualSteeringRad-10*deg)<1e-6);
});
for(const command of [1,-1])test(`propulsion ${command} step has finite monotonic lag and correct discrete solution`,()=>{
  const a=new OutboardActuator(P);a.setCommands(command,0);
  for(let i=1;i<=2400;i++){const old=a.actualPropulsion;a.update(h);
    assert.ok(Math.abs(a.actualPropulsion)>=Math.abs(old));
    close(a.actualPropulsion,command*(1-(1-h/.6)**i));
  }
  close(a.actualPropulsion,command,1e-6);
});
test('reset clears commands, actual state, rate, thrust and effective angle',()=>{
  const b=boat();b.setActuatorCommands({propulsionCommand:.8,steeringAngleRad:.2});b.update(.02);b.reset();
  for(const key of ['propulsionCommand','actualPropulsion','steeringCommandRad','actualSteeringRad','steeringRateRadPerSec'])assert.equal(b.outboardActuator[key],0);
  for(const key of ['rawThrustN','effectiveThrustN','thrustN','steeringEffectiveRad'])assert.equal(b.diagnostics[key],0);
});
test('canonical radians API and normalized compatibility wrapper reach identical command states',()=>{
  const a=boat(),b=boat();a.setControls(.7,.4);
  b.setActuatorCommands({propulsionCommand:.7,steeringAngleRad:.4*b.spec.maxSteerRad});
  for(let i=0;i<480;i++){a._step(h);b._step(h);}
  assert.deepEqual(a.pos,b.pos);assert.equal(a.outboardActuator.actualSteeringRad,b.outboardActuator.actualSteeringRad);
});
test('actuator updates exactly once inside each native physics substep, not each frame',()=>{
  const b=boat();let steps=0;const update=b.outboardActuator.update.bind(b.outboardActuator);
  b.outboardActuator.update=dt=>{close(dt,h);steps++;update(dt);};
  b.update(1/60);assert.equal(steps,4);b.update(0);assert.equal(steps,4);
});
test('2-second command response is identical at 30/60/120/144 render FPS with 240 Hz plant',()=>{
  const states=[];
  for(const fps of [30,60,120,144]){
    const b=boat();b.setActuatorCommands({propulsionCommand:1,steeringAngleRad:10*deg});
    for(let i=0;i<2*fps;i++)b.update(1/fps);
    states.push([b.outboardActuator.actualPropulsion,b.outboardActuator.actualSteeringRad]);
  }
  for(const s of states){close(s[0],states[0][0]);close(s[1],states[0][1]);}
});
test('actual mechanical angle differs from effective angle; raw thrust sign uses actual state',()=>{
  const b=boat();b.vel.z=10;b.setActuatorCommands({propulsionCommand:1,steeringAngleRad:.3});b._step(h);
  const d=b.diagnostics;assert.ok(d.steeringActualRad>0&&d.steeringActualRad<.3);
  assert.ok(d.steeringEffectiveRad<d.steeringActualRad);
  close(d.rawThrustN,10500*d.actualPropulsion);assert.ok(d.effectiveThrustN<=d.rawThrustN);
  b.setActuatorCommands({propulsionCommand:-1,steeringAngleRad:0});b._step(h);
  close(b.diagnostics.rawThrustN,2700*b.outboardActuator.actualPropulsion);
});
test('ideal bypass assigns command exactly, and invalid input or delay fails explicitly',()=>{
  const a=new OutboardActuator({...P,...IDEAL_ACTUATOR});
  for(const value of [.8,-.3,0]){a.setCommands(value,value*.3);a.update(h);assert.equal(a.actualPropulsion,value);assert.equal(a.actualSteeringRad,value*.3);}
  assert.throws(()=>a.setCommands(NaN,0));assert.throws(()=>a.update(Infinity));
  assert.throws(()=>new OutboardActuator({...P,steeringDelaySec:.1}));
  assert.throws(()=>new OutboardActuator({...P,propulsionTimeConstantSec:-1}));
});
