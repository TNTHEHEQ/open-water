import * as THREE from 'three';
import {DT,createPlant,save} from './p0a-common.mjs';
import {openWaterHeadingRad} from '../site/js/twin/coordinate-adapter.js';
const b=createPlant(),rows=[],v=new THREE.Vector3(),q=new THREE.Quaternion();
for(let i=0;i<90*240;i++){
  b.setActuatorCommands({propulsionCommand:.55,steeringAngleRad:i<20*240?0:10*Math.PI/180});b._step(DT);
  v.copy(b.vel).applyQuaternion(q.copy(b.quat).invert());const d=b.diagnostics;
  rows.push([(i+1)*DT,b.pos.x,b.pos.z,openWaterHeadingRad(b.quat),v.z,v.x,b.angVelB.y,
    d.propulsionCommand,d.actualPropulsion,d.rawThrustN,d.effectiveThrustN,d.steeringCommandRad,d.steeringActualRad,d.steeringEffectiveRad]);
}
const tail=rows.filter(r=>r[0]>80),mean=i=>tail.reduce((a,r)=>a+r[i],0)/tail.length;
const u=mean(4),vMean=mean(5),r=mean(6);
save('turning-circle',['time_s','east_m','north_m','heading_rad','u_m_s','v_m_s','r_rad_s',
  'propulsion_cmd','propulsion_actual','raw_thrust_N','effective_thrust_N','steering_cmd_rad','steering_actual_rad','steering_effective_rad'],rows,{
  steadyU:u,steadyV:vMean,steadyR:r,approxTurningRadiusM:Math.hypot(u,vMean)/Math.abs(r),
  yawRateRange: [Math.min(...tail.map(row=>row[6])),Math.max(...tail.map(row=>row[6]))],
  environment:'flat water, zero wind/current/wake; straight 20s, turn 70s; mean final 10s',
});
