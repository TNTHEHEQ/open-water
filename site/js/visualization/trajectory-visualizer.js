import * as THREE from 'three';
import { enuPlanPointToOpenWater } from '../twin/coordinate-adapter.js';
import { validatePlannedTrajectory } from '../bridge/visual-protocol.js';
export class TrajectoryVisualizer {
  constructor(group, height = () => 0) {
    this.height = height; this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(256 * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, 0);
    this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: false }));
    this.line.name = 'planned-trajectory-cyan'; this.line.frustumCulled = false;
    this.line.renderOrder = 5; group.add(this.line); this.plan = null;
  }
  replace(message) {
    validatePlannedTrajectory(message); this.clear();
    if (message.status !== 'SUCCESS') return;
    this.plan = message;
    message.points.forEach((p, i) => {
      const v = enuPlanPointToOpenWater(p, this.height(p.x, p.y));
      this.positions.set([v.x, v.y, v.z], 3 * i);
    });
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.setDrawRange(0, message.points.length);
  }
  clear() { this.plan = null; this.geometry.setDrawRange(0, 0); }
  dispose() { this.line.removeFromParent(); this.geometry.dispose(); this.line.material.dispose(); }
}
