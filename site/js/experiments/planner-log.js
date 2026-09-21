// Bounded separate JSON log: one entry per plan, never repeated in 50 Hz CSV.
export class PlannerLog {
  constructor(limit = 100) { this.limit = limit; this.entries = []; }
  record(message, state, obstacleSequence) {
    this.entries.push({ state_sequence: state.sequence, simulation_time: state.timestamp,
      plan_id: message.plan_id, source_state_sequence: message.source_state_sequence,
      source_simulation_time: message.source_simulation_time, plan_received_simulation_time: state.timestamp,
      plan_age_sec: state.timestamp - message.source_simulation_time,
      obstacle_snapshot_id: message.obstacle_sequence, latest_obstacle_sequence: obstacleSequence,
      plan: structuredClone(message) });
    if (this.entries.length > this.limit) this.entries.shift();
  }
  download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.entries, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'p6a-planner-log.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
