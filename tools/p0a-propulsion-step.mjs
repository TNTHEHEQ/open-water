import {DT,createPlant,save,responseTimes} from './p0a-common.mjs';
const b=createPlant(),rows=[];let initial;
for(let i=0;i<8*240;i++){
  if(i===240)initial=b.outboardActuator.actualPropulsion;
  b.setActuatorCommands({propulsionCommand:i<240?.2:.8,steeringAngleRad:0});b._step(DT);
  const d=b.diagnostics;rows.push([(i+1)*DT,d.propulsionCommand,d.actualPropulsion,d.rawThrustN,d.effectiveThrustN,b.vel.length()]);
}
save('propulsion-step',['time_s','command','actual','raw_thrust_N','effective_thrust_N','speed_m_s'],rows,{
  actualAtStep:initial,...responseTimes(rows,0,2,1,initial,.8),
  note:'Response fractions use actual value at t=1, since the preceding 0.2 command has not fully settled.',
});
