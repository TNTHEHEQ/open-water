export const SIMULATOR_CONFIG = Object.freeze({
  vesselId: 'zodiac_boat',
  actuatorMode: 'generic',
  plannerBridgeEnabled: false,
  plannerUrl: 'ws://127.0.0.1:8765',
  plannerStateRateHz: 50,
  externalCommandTimeoutSec: 0.5,
  recorderSampleRateHz: 50,
  modelUrl: './assets/boats/zodiac_boat.glb',
  wildlife: false,
  achievements: false,
  firstVoyage: false,
  vesselSelection: false,
});
