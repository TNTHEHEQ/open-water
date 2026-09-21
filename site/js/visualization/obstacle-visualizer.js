import * as THREE from 'three';
import { enuPlanPointToOpenWater } from '../twin/coordinate-adapter.js';
import { predictionPoints } from '../scenario/obstacle-state.js';
export class ObstacleVisualizer {
  constructor(group, height = () => 0) { this.group = group; this.height = height; this.objects = new Map(); }
  destroy(item) { for (const o of [item.body, item.envelope, item.prediction]) { o.removeFromParent(); o.geometry.dispose(); o.material.dispose(); } }
  update(message, horizonSec = 50) {
    const ids = new Set(message.obstacles.map(o => o.id));
    for (const [id, item] of this.objects) if (!ids.has(id)) { this.destroy(item); this.objects.delete(id); }
    for (const o of message.obstacles) {
      let item = this.objects.get(o.id);
      if (item && item.radius !== o.radius_m) { this.destroy(item); this.objects.delete(o.id); item = null; }
      if (!item) {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(o.radius_m, o.radius_m, .6, 32),
          new THREE.MeshBasicMaterial({ color: 0xef3434 }));
        body.name = 'obstacle-physical-radius';
        const envelope = new THREE.Mesh(new THREE.RingGeometry(o.radius_m + .48, o.radius_m + .52, 48),
          new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: .5, side: THREE.DoubleSide, depthTest: false }));
        envelope.rotation.x = -Math.PI / 2; envelope.name = 'obstacle-radius-plus-frozen-0.5m-buffer';
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const prediction = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff8800, depthTest: false, depthWrite: false, transparent: true }));
        prediction.frustumCulled = false; prediction.renderOrder = 5; prediction.name = 'constant-velocity-prediction';
        this.group.add(body, envelope, prediction);
        item = { body, envelope, prediction, radius: o.radius_m }; this.objects.set(o.id, item);
      }
      const p = enuPlanPointToOpenWater(o.position, this.height(o.position.x, o.position.y));
      item.body.position.set(p.x, p.y + .3, p.z); item.envelope.position.set(p.x, p.y, p.z);
      predictionPoints(o, horizonSec).forEach((v, i) => {
        const w = enuPlanPointToOpenWater(v, this.height(v.x, v.y));
        item.prediction.geometry.attributes.position.array.set([w.x, w.y, w.z], 3 * i);
      });
      item.prediction.geometry.attributes.position.needsUpdate = true;
    }
  }
  clear() { for (const v of this.objects.values()) this.destroy(v); this.objects.clear(); }
  dispose() { this.clear(); }
}
