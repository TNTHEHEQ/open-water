// Frozen P8F scenario: one simulator-owned kinematic disc, no plant forces.
export const P8F_AR10 = Object.freeze({
  id: 'P8F_AR10_DYNAMIC_CROSSING', targetId: 'P8F_AR10_TARGET',
  missionGoal: 75, lookahead: 75, intervals: 120, width: 20, dt: .02,
  targetS: 50, crossingTime: 16.36108398930107, targetRadius: 2.5, plannerBuffer: .5,
  velocityS: 0, velocityL: 1, seaPreset: 1,
});
export function episodeFrame(state) {
  const p = state.pose.position, h = state.pose.headingRad, t = state.timestamp;
  if (![p.x, p.y, h, t].every(Number.isFinite)) throw new TypeError('P8F_INVALID_FRAME');
  return Object.freeze({ E_ref: p.x, N_ref: p.y, H_ref: h, episode_start_sim_time: t });
}
export function plannerToEnu(frame, s, l, velocity = false) {
  const h = frame.H_ref;
  return { x: (velocity ? 0 : frame.E_ref) + Math.sin(h) * s - Math.cos(h) * l,
    y: (velocity ? 0 : frame.N_ref) + Math.cos(h) * s + Math.sin(h) * l };
}
export function enuToPlanner(frame, p, velocity = false) {
  const e = p.x - (velocity ? 0 : frame.E_ref), n = p.y - (velocity ? 0 : frame.N_ref);
  return { s: Math.sin(frame.H_ref) * e + Math.cos(frame.H_ref) * n,
    l: -Math.cos(frame.H_ref) * e + Math.sin(frame.H_ref) * n };
}
export function configureP8F(manager, state, dynamic = true) {
  const frame = episodeFrame(state);
  manager.setScenario(dynamic ? [{
    id: P8F_AR10.targetId,
    position: plannerToEnu(frame, P8F_AR10.targetS, -P8F_AR10.crossingTime),
    velocity: plannerToEnu(frame, P8F_AR10.velocityS, P8F_AR10.velocityL, true),
    radius_m: P8F_AR10.targetRadius, prediction_model: 'CONSTANT_VELOCITY',
  }] : [], state.timestamp);
  return frame;
}
// The caller passes the same authoritative state used for simulation_state.
export function p8fObstacleSnapshot(manager, state) { return manager.snapshot(state.timestamp); }
export function p8fActualClearance(state, frame) {
  const own = enuToPlanner(frame, state.pose.position), elapsed = state.timestamp - frame.episode_start_sim_time;
  const target = { s: P8F_AR10.targetS, l: -P8F_AR10.crossingTime + elapsed };
  const psi = Math.atan2(Math.sin(frame.H_ref - state.pose.headingRad), Math.cos(frame.H_ref - state.pose.headingRad));
  const radius = Math.hypot(3.2 / 3, 1);
  const circles = [0, 1, 2].map(index => {
    const offset = -3.2 + (2 * index + 1) * 3.2 / 3;
    const s = own.s + Math.cos(psi) * offset, l = own.l + Math.sin(psi) * offset;
    const raw = Math.hypot(s - target.s, l - target.l) - radius - P8F_AR10.targetRadius;
    const bankRaw = Math.min(l + 10 - radius, 10 - l - radius);
    return { index, s, l, radius, raw, buffered: raw - P8F_AR10.plannerBuffer,
      bankRaw, bankBuffered: bankRaw - P8F_AR10.plannerBuffer };
  });
  return { elapsed, own, target, psi, circles,
    minimum: circles.reduce((a, b) => a.buffered < b.buffered ? a : b),
    bankMinimum: circles.reduce((a, b) => a.bankBuffered < b.bankBuffered ? a : b),
    certification: 'ACTUAL_50HZ_SAMPLED_ONLY' };
}
