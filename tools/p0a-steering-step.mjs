import {DT,createPlant,save,responseTimes} from './p0a-common.mjs';
const b=createPlant(),rows=[];const target=10*Math.PI/180;
for(let i=0;i<6*240;i++){
  b.setActuatorCommands({propulsionCommand:0,steeringAngleRad:i<240?0:target});b._step(DT);
  const d=b.diagnostics;rows.push([(i+1)*DT,d.steeringCommandRad,d.steeringActualRad,d.steeringEffectiveRad,d.steeringRateRadPerSec]);
}
const saturated=createPlant();saturated.setActuatorCommands({propulsionCommand:0,steeringAngleRad:30*Math.PI/180});
let largeStepMaxRate=0;for(let i=0;i<960;i++){saturated._step(DT);largeStepMaxRate=Math.max(largeStepMaxRate,Math.abs(saturated.diagnostics.steeringRateRadPerSec));}
save('steering-step',['time_s','command_rad','actual_rad','effective_rad','rate_rad_s'],rows,{
  ...responseTimes(rows,0,2,1,0,target),maxRateRadPerSec:Math.max(...rows.map(r=>Math.abs(r[4]))),
  large30DegStepMaxRateRadPerSec:largeStepMaxRate,
  note:'10 deg/T=28.57 deg/s does not activate the 45 deg/s bound. Separate 30 deg step verifies saturation.',
});
