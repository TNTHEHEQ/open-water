import { VESSEL_SPECS } from '../simulation/vessels.js';
import { SIMULATOR_CONFIG } from '../config/simulator-config.js';
// No catalog fetch, storage restore, unlocks, or switching. Keep the profile intact.
export async function loadSingleVessel(boat, cameraController) {
  const spec = VESSEL_SPECS[SIMULATOR_CONFIG.vesselId];
  boat.setSpec(spec);
  boat.reset();
  await boat.loadModel(SIMULATOR_CONFIG.modelUrl, spec.length, !!spec.reversed);
  cameraController.setVessel(spec);
  return spec;
}
