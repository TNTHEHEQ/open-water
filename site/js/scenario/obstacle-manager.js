import { obstacleAt } from './obstacle-state.js';
import { validateObstacleState } from '../bridge/visual-protocol.js';
export class ObstacleManager {
  constructor() { this.truth = []; this.sequence = 0; }
  setScenario(obstacles, simulationTime) {
    const m = { protocol_version: 1, type: 'obstacle_state', sequence: 0,
      simulation_time: simulationTime, obstacles };
    validateObstacleState(m);
    this.truth = obstacles.map(o => ({ ...structuredClone(o), referenceTime: simulationTime }));
  }
  remove(id) { this.truth = this.truth.filter(o => o.id !== id); }
  clear() { this.truth = []; }
  snapshot(simulationTime) {
    const m = { protocol_version: 1, type: 'obstacle_state', sequence: this.sequence++,
      simulation_time: simulationTime, obstacles: this.truth.map(o => obstacleAt(o, simulationTime)) };
    validateObstacleState(m); return m;
  }
  seedVisualScenario(state) {
    const h = state.pose.headingRad, p = state.pose.position;
    this.setScenario([{ id: 'p6a-moving-circle',
      position: { x: p.x + 35 * Math.sin(h) + 7 * Math.cos(h), y: p.y + 35 * Math.cos(h) - 7 * Math.sin(h) },
      velocity: { x: -.3 * Math.cos(h), y: .3 * Math.sin(h) }, radius_m: 1.5,
      prediction_model: 'CONSTANT_VELOCITY' }], state.timestamp);
  }
}
