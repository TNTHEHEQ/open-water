import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { createVesselState, validateVesselState } from '../../site/js/twin/vessel-state.js';
import * as C from '../../site/js/twin/coordinate-adapter.js';
import { SimulationStateSource } from '../../site/js/twin/simulation-state-source.js';
import { runRegression } from '../../tools/usv1-regression.mjs';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
const vectorNear = (a,b) => { for(const key of ['x','y','z']) near(a[key],b[key]); };

test('v0 is complete, finite, plain and JSON safe; validator rejects leakage and malformed states',()=>{
  const state=createVesselState();
  assert.equal(validateVesselState(state),true);
  assert.deepEqual(JSON.parse(JSON.stringify(state)),state);
  const changes=[s=>{s.pose.position=new T.Vector3();},s=>{s.velocity.linear.x=NaN;},
    s=>{s.pose.orientation.w=0;},s=>{s.source='LIVE';},s=>{s.velocity.angular.z=Infinity;},
    s=>{s.callback=()=>{};},s=>{s.circular=s;},s=>{delete s.control;},s=>{s.schemaVersion=1;},
    s=>{s.control.throttleCommand=2;},s=>{s.sequence=-1;}];
  for(const change of changes){const broken=createVesselState();change(broken);assert.throws(()=>validateVesselState(broken));}
});
test('ENU polar and axial maps are distinct involutions, including in-place conversion',()=>{
  const v={x:2,y:3,z:5};
  assert.deepEqual(C.openWaterPositionToENU(v),{x:2,y:5,z:3});
  assert.deepEqual(C.openWaterAngularVelocityToENU(v),{x:-2,y:-5,z:-3});
  vectorNear(C.enuVelocityToOpenWater(C.openWaterVelocityToENU(v)),v);
  vectorNear(C.enuAngularVelocityToOpenWater(C.openWaterAngularVelocityToENU(v)),v);
  C.openWaterPositionToENU(v,v);assert.deepEqual(v,{x:2,y:5,z:3});
});
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])test(`ENU heading and quaternion at ${heading} rad`,()=>{
  const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),heading);
  near(C.openWaterHeadingRad(q),heading);
  const enu=C.openWaterQuaternionToENU(q);
  const forward=C.rotateVector({x:0,y:1,z:0},enu);
  vectorNear(forward,{x:Math.sin(heading),y:Math.cos(heading),z:0});
  const round=C.enuQuaternionToOpenWater(enu);
  vectorNear(round,q);near(round.w,q.w);
});
test('nonplanar quaternion basis conjugation and angular cross products agree',()=>{
  const q=new T.Quaternion().setFromEuler(new T.Euler(.27,-.83,.46));
  const v=new T.Vector3(.4,1.2,-.7),w=new T.Vector3(.2,-.5,.3);
  vectorNear(C.openWaterPositionToENU(v.clone().applyQuaternion(q)),
    C.rotateVector(C.openWaterPositionToENU(v),C.openWaterQuaternionToENU(q)));
  const transformedCross=new T.Vector3().crossVectors(
    new T.Vector3().copy(C.openWaterAngularVelocityToENU(w)),
    new T.Vector3().copy(C.openWaterPositionToENU(v)));
  vectorNear(transformedCross,C.openWaterPositionToENU(w.clone().cross(v)));
});
test('source projects deterministically, preserves references and snapshots isolate callers',()=>{
  const boat={pos:new T.Vector3(1,2,3),quat:new T.Quaternion(),vel:new T.Vector3(4,5,6),
    angVelB:new T.Vector3(.1,.2,.3),throttle:.7,steer:-.4,_effSteer:-.1,propWet:.9,
    _waterVel:new T.Vector3(1,2,3),surfaceCurrent:new T.Vector3(.1,0,.2),trueWind:new T.Vector3(3,0,4),
    diagnostics:{thrustN:700,planingForceN:123,centerOfPressure:new T.Vector3(7,8,9),submergedPoints:6}};
  const water={time:12,preset:2,heightAt:()=>.45};
  const source=new SimulationStateSource(boat,water);
  const s=source.update(), pos=s.pose.position, control=s.control;
  assert.equal(validateVesselState(s),true);
  assert.deepEqual(s.pose.position,{x:1,y:3,z:2});
  assert.deepEqual(s.velocity.angular,{x:-.1,y:-.3,z:-.2});
  assert.deepEqual(s.velocity.body,{surge:6,sway:4,heave:5,rollRate:-.3,pitchRate:-.1,yawRate:.2});
  assert.equal(s.control.propulsion.thrustN,700); assert.equal(s.environment.localWaterHeight,.45);
  const copy=source.snapshot();copy.pose.position.x=900;assert.equal(s.pose.position.x,1);
  assert.equal(source.update(),s);assert.equal(s.pose.position,pos);assert.equal(s.control,control);
  assert.equal(s.sequence,2);assert.equal(s.timestamp,12);
  assert.deepEqual(boat.pos.toArray(),[1,2,3]);
});
const fixture=JSON.parse(readFileSync(new URL('../fixtures/usv1-regression.json',import.meta.url)));
for(const {preset,samples} of fixture.cases)test(`USV-1 sea ${preset}: observer enabled, pose/CoP/forces/wake bit-identical`,()=>{
  let source;
  const actual=runRegression(preset,(boat,water,planing,copWorld)=>{
    source??=new SimulationStateSource(boat,water);
    source.update(); validateVesselState(source.getState());
    assert.equal(source.getState().dynamics.planingForceN,planing);
    if(copWorld)assert.deepEqual(boat.diagnostics.centerOfPressure.toArray(),copWorld);
  });
  assert.deepEqual(actual,samples);
});
