// Independent audit only. No bridge/controller execution is enabled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { OutboardActuator } from '../site/js/simulation/outboard-actuator.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
import { openWaterHeadingRad } from '../site/js/twin/coordinate-adapter.js';
globalThis.window ??= { location: { search: '' } };
globalThis.matchMedia ??= () => ({ matches: false });
const { Boat } = await import('../site/js/simulation/boat.js');
const planner=JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const spec=VESSEL_SPECS.zodiac_boat, h=1/240;
const water={time:0,preset:1,heightAt:()=>0,velocityAt:(_x,_z,out)=>out.set(0,0,0),normalAt:(_x,_z,out)=>out.set(0,1,0)};
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const forceCommandToNormalized=force=>Math.max(-1,Math.min(1,force/(force>=0?spec.maxThrustFwd:spec.maxThrustRev)));
for(const [force,normalized] of [[5250,.5],[-1350,-.5],[0,0],[21000,1],[-5400,-1]])near(forceCommandToNormalized(force),normalized);
const cardinal=[];
for(const p of planner.cardinals) {
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.heading);
  // Exact direction expression read from frozen Boat._step; positive attenuation cannot change sign.
  const force=new THREE.Vector3(Math.sin(planner.delta_rad),0,Math.cos(planner.delta_rad)).applyQuaternion(q).multiplyScalar(planner.T_N);
  const reflected=new THREE.Vector3(-Math.sin(planner.delta_rad),0,Math.cos(planner.delta_rad)).applyQuaternion(q).multiplyScalar(planner.T_N);
  near(reflected.x,p.force_EN[0]);near(reflected.z,p.force_EN[1]);
  const discrepancy=Math.hypot(force.x-p.force_EN[0],force.z-p.force_EN[1]);
  near(discrepancy,2*planner.T_N*Math.sin(planner.delta_rad));
  const b=new Boat(water,new THREE.Scene(),p.heading);b.setSpec(spec);b.reset();
  // Manufactured unit-test orientation only; not an execution initialization or teleport.
  b.quat.copy(q);
  b.setActuatorCommands({propulsionCommand:.2,steeringAngleRad:.1});
  b._step(h); // Call frozen production plant; do not replace its physics.
  assert.ok(b.outboardActuator.actualSteeringRad>0);
  assert.ok(b.angVelB.y<0,'Positive OW mechanical angle must produce negative navigation yaw at stern');
  assert.ok(planner.body_acceleration[2]<0,'Positive planner angle produces negative CCW yaw');
  cardinal.push({heading_rad:p.heading,planner_force_EN:p.force_EN,openwater_force_EN:[force.x,force.z],same_sign_force_difference_N:discrepancy,negative_mapping_force_error_N:Math.hypot(reflected.x-p.force_EN[0],reflected.z-p.force_EN[1]),openwater_body_navigation_yaw_rate:b.angVelB.y,openwater_after_p6a_ccw_conversion:-b.angVelB.y,heading_after_step:openWaterHeadingRad(b.quat)});
}
function stepDiagnostic(commandForce,commandAngle) {
  const a=new OutboardActuator(spec.actuator);a.setCommands(forceCommandToNormalized(commandForce),commandAngle);
  const rows=[];
  for(let k=1;k<=240*6;k++) {
    a.update(h);const t=k*h;
    const raw=(a.actualPropulsion>=0?spec.maxThrustFwd:spec.maxThrustRev)*a.actualPropulsion;
    rows.push({t,raw,angle:a.actualSteeringRad,predictedT:commandForce*(1-Math.exp(-t/spec.actuator.propulsionTimeConstantSec)),predictedDelta:commandAngle*(1-Math.exp(-t/spec.actuator.steeringTimeConstantSec))});
  }
  const metric=(key,predicted,target)=>({t10:rows.find(r=>Math.abs(r[key])>=.1*Math.abs(target)).t,t50:rows.find(r=>Math.abs(r[key])>=.5*Math.abs(target)).t,t90:rows.find(r=>Math.abs(r[key])>=.9*Math.abs(target)).t,settling_2pct_sec:rows.find(r=>Math.abs(r[key]-target)<=.02*Math.abs(target)).t,max_abs_error:Math.max(...rows.map(r=>Math.abs(r[key]-r[predicted])))});
  return {commandForce,commandAngle,thrust:metric('raw','predictedT',commandForce),steering:metric('angle','predictedDelta',commandAngle),note:'Unity-gain continuous integration actuator equation vs real standalone 240Hz Euler actuator; raw force, not effective hydrodynamic force'};
}
assert.ok(.55>spec.actuator.steeringMaxRad);
const result={status:'STEERING_CONTRACT_CONFLICT_CONFIRMED',audit_assertions:'PASS',execution_enabled:false,plant:{vessel:spec.id,max_thrust_fwd_n:spec.maxThrustFwd,max_thrust_rev_n:spec.maxThrustRev,...spec.actuator},mapping_cases:'forward/reverse/zero/saturation PASS',cardinals:cardinal,step_diagnostics:[stepDiagnostic(100,.1),stepDiagnostic(-100,-.1)],inherited_steering_command_containment:'FAIL: .55 rad > pi/6 rad',proposed_sign_mapping:'deltaP=-deltaOW; deltacP=-deltacOW; output mechanical=-deltacP; pending explicit contract resolution'};
fs.writeFileSync('results/p6b/actuator-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));