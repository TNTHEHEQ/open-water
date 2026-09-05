import { snapshotVesselState } from './vessel-state.js';

// Output-only contract. No start/stop physics, controls, networking or renderer.
export class VesselStateSource {
  update() { throw new Error('State source must implement update()'); }
  getState() { throw new Error('State source must implement getState()'); }
  snapshot() { return snapshotVesselState(this.getState()); }
}
