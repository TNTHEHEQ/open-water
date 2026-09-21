export const MAX_TRAJECTORY_BYTES = 262144;
export const MAX_TRAJECTORY_POINTS = 256;
export const MAX_OBSTACLES = 32;
const plain = x => x && Object.getPrototypeOf(x) === Object.prototype;
function fields(x, required, optional = []) {
  if (!plain(x) || required.some(k => !Object.hasOwn(x, k))
      || Object.keys(x).some(k => !required.includes(k) && !optional.includes(k))) throw new TypeError('Unexpected fields');
}
const seq = n => Number.isSafeInteger(n) && n >= 0;
export function validatePlannedTrajectory(m) {
  fields(m, ['protocol_version', 'type', 'sequence', 'plan_id', 'source_state_sequence',
    'source_simulation_time', 'obstacle_sequence', 'status', 'points'], ['diagnostics']);
  if (m.protocol_version !== 1 || m.type !== 'planned_trajectory' || !seq(m.sequence)
      || !seq(m.source_state_sequence) || !seq(m.obstacle_sequence)
      || typeof m.plan_id !== 'string' || !m.plan_id || m.plan_id.length > 80
      || !Number.isFinite(m.source_simulation_time) || m.source_simulation_time < 0
      || !['SUCCESS', 'FAIL', 'STALE_INPUT', 'INFEASIBLE', 'SOLVER_ERROR'].includes(m.status)
      || !Array.isArray(m.points) || m.points.length > MAX_TRAJECTORY_POINTS
      || (m.status === 'SUCCESS' ? m.points.length < 2 : m.points.length !== 0)) throw new TypeError('Invalid plan');
  let time = -1;
  for (const p of m.points) {
    fields(p, ['t_rel', 'x', 'y', 'heading_rad', 'speed_mps']);
    if (!Object.values(p).every(Number.isFinite) || p.t_rel < 0 || p.t_rel <= time || p.speed_mps < 0) throw new TypeError('Invalid point');
    time = p.t_rel;
  }
  if (m.points.length && m.points[0].t_rel !== 0) throw new TypeError('Relative time must start at zero');
  if (m.diagnostics !== undefined) {
    fields(m.diagnostics, [], ['solve_time_sec', 'min_clearance_m', 'objective']);
    if (!Object.values(m.diagnostics).every(Number.isFinite)
        || (m.diagnostics.solve_time_sec !== undefined && m.diagnostics.solve_time_sec < 0)) throw new TypeError('Invalid diagnostics');
  }
  return true;
}
export function validateObstacleState(m) {
  fields(m, ['protocol_version', 'type', 'sequence', 'simulation_time', 'obstacles']);
  if (m.protocol_version !== 1 || m.type !== 'obstacle_state' || !seq(m.sequence)
      || !Number.isFinite(m.simulation_time) || m.simulation_time < 0
      || !Array.isArray(m.obstacles) || m.obstacles.length > MAX_OBSTACLES) throw new TypeError('Invalid obstacle state');
  const ids = new Set();
  for (const o of m.obstacles) {
    fields(o, ['id', 'position', 'velocity', 'radius_m', 'prediction_model']);
    for (const k of ['position', 'velocity']) {
      fields(o[k], ['x', 'y']);
      if (!Object.values(o[k]).every(Number.isFinite)) throw new TypeError('Nonfinite obstacle');
    }
    if (typeof o.id !== 'string' || !o.id || o.id.length > 64 || ids.has(o.id)
        || !Number.isFinite(o.radius_m) || o.radius_m <= 0 || o.prediction_model !== 'CONSTANT_VELOCITY') throw new TypeError('Invalid obstacle');
    ids.add(o.id);
  }
  return true;
}
