export const CSV_COLUMNS = Object.freeze(['time', 'x', 'y', 'z', 'roll', 'pitch', 'yaw',
  'u', 'v', 'w', 'p', 'q', 'r', 'propulsion_cmd', 'propulsion_actual', 'raw_thrust_N', 'effective_thrust_N',
  'steering_cmd_rad', 'steering_actual_rad', 'steering_effective_rad', 'steering_rate_rad_s', 'ventilation_factor',
  'wave_Hs_m', 'wave_Tp_s', 'wind_x', 'wind_y', 'wind_z', 'current_x', 'current_y', 'current_z',
  'planing_force_N', 'CoP_x', 'CoP_y', 'CoP_z', 'submerged_points']);
export function stateRow(s) {
  const p = s.pose.position, a = s.attitude, v = s.velocity.body, c = s.control, t = s.actuator, e = s.environment, d = s.dynamics;
  const row = [s.timestamp, p.x, p.y, p.z, a.rollRad, a.pitchRad, a.yawRad,
    v.surge, v.sway, v.heave, v.rollRate, v.pitchRate, v.yawRate,
    c.propulsionCommand, t.propulsionActual, t.rawThrustN, t.effectiveThrustN,
    c.steeringCommandRad, t.steeringActualRad, t.steeringEffectiveRad, t.steeringRateRadPerSec, t.ventilationFactor,
    e.wave.significantHeightM, e.wave.peakPeriodSec, e.wind.x, e.wind.y, e.wind.z, e.current.x, e.current.y, e.current.z,
    d.planingForceN, d.centerOfPressure.x, d.centerOfPressure.y, d.centerOfPressure.z, d.submergedPoints];
  if (!row.every(Number.isFinite)) throw new TypeError('Nonfinite CSV sample');
  return row;
}
export function exportCsv(rows) { return CSV_COLUMNS.join(',') + '\n' + rows.map(r => r.join(',')).join('\n') + (rows.length ? '\n' : ''); }
