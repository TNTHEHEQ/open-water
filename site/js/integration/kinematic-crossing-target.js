// Independent kinematic moving disc truth; never writes/reset/steps a Boat.
export class KinematicCrossingTarget {
  constructor(contract, frame, missionStartSimTime) {
    if (contract.scenario !== 'H2_DYNAMIC_CROSSING' || contract.prediction_model !== 'CONSTANT_VELOCITY'
      || ![frame.E_ref, frame.N_ref, frame.H_ref, missionStartSimTime, contract.s_conflict_m,
        contract.t_conflict_episode_sec, contract.target_radius_m, contract.collision_buffer_m].every(Number.isFinite)
      || contract.target_velocity_planner_mps[0] !== 0 || contract.target_velocity_planner_mps[1] !== 1) throw Error('INVALID_FROZEN_CROSSING_CONTRACT');
    this.frame = { ...frame }; this.start = missionStartSimTime;
    this.s = contract.s_conflict_m; this.conflictTime = contract.t_conflict_episode_sec;
    this.radius = contract.target_radius_m; this.buffer = contract.collision_buffer_m; this.id = contract.target_id;
    this.footprint = contract.ownship_footprint.map(b => ({ ...b }));
  }
  truth(simulationTime) {
    if (!Number.isFinite(simulationTime) || simulationTime < this.start - 1e-8) throw Error('INVALID_TARGET_PHYSICAL_TIME');
    const t = simulationTime - this.start, l = t - this.conflictTime, H = this.frame.H_ref;
    const obstacle = { id: this.id, prediction_model: 'CONSTANT_VELOCITY', radius_m: this.radius,
      position: { x: this.frame.E_ref + Math.sin(H) * this.s - Math.cos(H) * l,
        y: this.frame.N_ref + Math.cos(H) * this.s + Math.sin(H) * l },
      velocity: { x: -Math.cos(H), y: Math.sin(H) } };
    return { simulation_time: simulationTime, episode_time: t, s_world: this.s, l_world: l, obstacle };
  }
  actualClearance({ s_world, l_world, psi }, simulationTime) {
    const target = this.truth(simulationTime);
    return Math.min(...this.footprint.map(b => Math.hypot(
      s_world + Math.cos(psi) * b.x - Math.sin(psi) * b.y - target.s_world,
      l_world + Math.sin(psi) * b.x + Math.cos(psi) * b.y - target.l_world) - b.radius - this.radius - this.buffer));
  }
}
