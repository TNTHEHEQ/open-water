import * as THREE from 'three';
import { TrajectoryVisualizer } from './trajectory-visualizer.js';
import { ActualTrackVisualizer } from './actual-track-visualizer.js';
import { ObstacleVisualizer } from './obstacle-visualizer.js';
export class PlannerVisualizationGroup {
  constructor(scene, height) {
    this.group = new THREE.Group(); this.group.name = 'PlannerVisualizationGroup'; scene.add(this.group);
    this.planned = new TrajectoryVisualizer(this.group, height);
    this.actual = new ActualTrackVisualizer(this.group, height);
    this.obstacles = new ObstacleVisualizer(this.group, height);
    this.frameCosts = { on: { count: 0, totalMs: 0 }, off: { count: 0, totalMs: 0 } };
    this.nextObstacleTime = 0; this.metrics = { updates: 0, cpuMs: 0, maximumCpuMs: 0 };
  }
  set visible(v) { this.group.visible = Boolean(v); }
  get visible() { return this.group.visible; }
  update(state, obstacles) {
    const start = performance.now();
    this.actual.update(state); // Visibility does not discard actual history.
    if (this.visible) {
      if (state.timestamp >= this.nextObstacleTime) {
        this.nextObstacleTime = state.timestamp + .1;
        const points = this.planned.plan?.points;
        this.obstacles.update(obstacles, points?.at(-1).t_rel || 50);
      }
    }
    const cost = performance.now() - start; this.metrics.updates++; this.metrics.cpuMs += cost;
    this.metrics.maximumCpuMs = Math.max(this.metrics.maximumCpuMs, cost);
  }
  recordFrame(ms) {
    const sample = this.frameCosts[this.visible ? 'on' : 'off'];
    sample.count++; sample.totalMs += ms;
  }
  clear() { this.planned.clear(); this.actual.clear(); this.obstacles.clear(); this.nextObstacleTime = 0; }
  dispose() { this.planned.dispose(); this.actual.dispose(); this.obstacles.dispose(); this.group.removeFromParent(); }
}
