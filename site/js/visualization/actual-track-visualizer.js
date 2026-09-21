import * as THREE from 'three';
import { enuPlanPointToOpenWater } from '../twin/coordinate-adapter.js';
export class ActualTrackVisualizer {
  constructor(group, height = () => 0, capacity = 2000) {
    if (!Number.isSafeInteger(capacity) || capacity < 2 || capacity > 2000) throw new RangeError('Track capacity');
    this.capacity = capacity; this.count = 0; this.nextTime = 0; this.height = height;
    this.positions = new Float32Array(capacity * 3); this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0xffe500, depthTest: false }));
    this.line.name = 'actual-track-yellow'; this.line.frustumCulled = false; this.line.renderOrder = 6; group.add(this.line);
  }
  update(state) {
    if (state.timestamp < this.nextTime) return;
    this.nextTime = state.timestamp + .1;
    if (this.count === this.capacity) { this.positions.copyWithin(0, 3); this.count--; }
    const p = state.pose.position, v = enuPlanPointToOpenWater(p, this.height(p.x, p.y));
    this.positions.set([v.x, v.y, v.z], this.count++ * 3);
    this.geometry.attributes.position.needsUpdate = true; this.geometry.setDrawRange(0, this.count);
  }
  clear() { this.count = 0; this.nextTime = 0; this.geometry.setDrawRange(0, 0); }
  dispose() { this.line.removeFromParent(); this.geometry.dispose(); this.line.material.dispose(); }
}
