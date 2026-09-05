import { loadSingleVessel } from './controllers/single-vessel-loader.js';
import { SimulationStartup } from './ui/simulation-startup.js';
import { SIMULATOR_CONFIG } from './config/simulator-config.js';
import { VESSEL_SPECS } from './simulation/vessels.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WaveField, SEA_PRESETS } from './simulation/waves.js';
import { WakeField } from './simulation/wake-field.js';
import { Boat } from './simulation/boat.js';
import { Ocean } from './rendering/ocean.js';
import { BoatEffects } from './rendering/effects.js';
import { FoamTrail } from './rendering/foamtrail.js';
import { WeatherEffects } from './rendering/weather.js';
import { PerceptualEffects } from './rendering/perceptual-effects.js';
import { ColorGrading } from './rendering/color-grading.js';
import { VesselOcclusionPass } from './rendering/vessel-occlusion.js';
import { WaterPassRenderer } from './rendering/water-pass-renderer.js';
import { EnvironmentController } from './rendering/environment-controller.js';
import { BoatAudio } from './runtime/audio.js';
import { PerformanceManager } from './runtime/performance.js';
import { QualityController } from './runtime/quality-controller.js';
import { BoatHud } from './ui/hud.js';
import { DriveController } from './controllers/drive-controller.js';
import { CameraController } from './controllers/camera-controller.js';
import { GestureDriveController } from './controllers/gesture-drive-controller.js';
import { ViewInputController } from './controllers/view-input-controller.js';

document.addEventListener('selectstart', (event) => event.preventDefault());

const IS_TOUCH = new URLSearchParams(location.search).has('touch')
  || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', IS_TOUCH);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);
const performanceManager = new PerformanceManager(renderer, { isTouch: IS_TOUCH });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(-12, 5, -12);
const waveField = new WaveField();
const wakeField = new WakeField();
waveField.setWakeField(wakeField);
const environment = new EnvironmentController({
  renderer,
  scene,
  waveField,
  isTouch: IS_TOUCH,
});
const { sunLight, paradiseSky } = environment;
const ocean = new Ocean(waveField, performanceManager.quality);
scene.add(ocean.mesh);
scene.add(ocean.patch);
const boat = new Boat(waveField, scene, environment.startYaw());
const effects = new BoatEffects(scene, waveField, boat);
const audio = new BoatAudio(waveField, { engineBank: VESSEL_SPECS[SIMULATOR_CONFIG.vesselId].audio.bank, wildlife: SIMULATOR_CONFIG.wildlife });
effects.onExhaustPop = (intensity, position) => audio.exhaustPop(intensity, position);
const foamTrail = new FoamTrail();
const weather = new WeatherEffects(scene, camera, waveField, audio);
const perceptualEffects = new PerceptualEffects({ scene, camera, boat, waveField });
const colorGrading = new ColorGrading(waveField);
const drive = new DriveController(boat, {
  isTouch: IS_TOUCH,
  auto: () => location.hash === '#auto',
});
// Development-only acceptance driver, absent from normal startup.
let driveValidation = null;
if (new URLSearchParams(location.search).has('debug')
  && new URLSearchParams(location.search).get('validate') === 'drive') {
  const { DriveValidation } = await import('./debug/drive-validation.js');
  const output = document.getElementById('validation-results');
  output.hidden = false;
  driveValidation = new DriveValidation(drive, boat, output);
}
const cameraController = new CameraController({
  camera,
  boat,
  waveField,
  isTouch: IS_TOUCH,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  statusElement: document.getElementById('camera-status'),
});
const WAVE_INTENSITY_KEY = 'ocean-boat:wave-intensity';
const startup = new SimulationStartup({
  performanceManager, audio, body: document.body,
  loader: document.getElementById('loading'),
  welcome: document.getElementById('welcome'),
  startButton: document.getElementById('start-simulation'),
});
startup.bind();
void loadSingleVessel(boat, cameraController).then(() => startup.markBoatReady());

function storedWaveIntensity() {
  try {
    const level = Number(localStorage.getItem(WAVE_INTENSITY_KEY));
    return Number.isInteger(level) && SEA_PRESETS[level] ? level : 2;
  } catch {
    return 2;
  }
}

function rememberWaveIntensity(level) {
  try { localStorage.setItem(WAVE_INTENSITY_KEY, String(level)); } catch {  }
}


environment.load({
  ocean,
  boat,
  cameraController,
  onReady: () => startup.markSkyReady(),
});

const waterPasses = new WaterPassRenderer({
  renderer,
  scene,
  camera,
  ocean,
  waveField,
  boat,
  paradiseSky,
  isTouch: IS_TOUCH,
  width: innerWidth,
  height: innerHeight,
});

const bufSize = renderer.getDrawingBufferSize(new THREE.Vector2());
const composerRT = new THREE.WebGLRenderTarget(bufSize.x, bufSize.y, {
  samples: IS_TOUCH ? 0 : 4,
  type: THREE.HalfFloatType,
});
const composer = new EffectComposer(renderer, composerRT);
composer.addPass(new RenderPass(scene, camera));
const vesselOcclusion = new VesselOcclusionPass(scene, camera, bufSize.x, bufSize.y);
composer.addPass(vesselOcclusion);
const bloom = new UnrealBloomPass(bufSize.clone(), 0.22, 0.55, 1.0);
composer.addPass(bloom);
composer.addPass(perceptualEffects.lensPass);
composer.addPass(colorGrading.pass);
const smaa = new SMAAPass(bufSize.x, bufSize.y);
composer.addPass(smaa);
composer.addPass(new OutputPass());
ocean.uniforms.uResolution.value.copy(bufSize);

const qualityController = new QualityController({
  performanceManager,
  renderer,
  composer,
  waterPasses,
  bloom,
  smaa,
  sunLight,
  budgetTargets: [
    boat, ocean, environment, effects, weather, perceptualEffects,
    vesselOcclusion,
  ],
  resolutionTarget: ocean.uniforms.uResolution.value,
  elements: {
    control: document.getElementById('quality-control'),
    current: document.getElementById('quality-current'),
    select: document.getElementById('quality-select'),
  },
});
qualityController.bind();

const gestureDrive = new GestureDriveController({
  element: document.getElementById('gesture-drive'),
  tutorialElement: document.getElementById('drive-tutorial'),
  audio,
});
gestureDrive.bind();

function resetBoat() {
  drive.resetOutput();
  wakeField.clear();
  boat.reset();
  cameraController.resetVessel();
  gestureDrive.reset();
}

addEventListener('keydown', (e) => {
  if (!startup.started) return;
  audio.start();
  drive.press(e.code);
  if (e.code === 'KeyR') resetBoat();
  if (e.code === 'KeyC') cameraController.cycle();
  const states = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
  if (states[e.code] !== undefined) {
    setWaveIntensity(states[e.code], { userInitiated: true });
  }
});
addEventListener('keyup', (e) => drive.release(e.code));
addEventListener('blur', () => { drive.clearInput(); gestureDrive.reset(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { drive.clearInput(); gestureDrive.reset(); }
});

function setWaveIntensity(level) {
  if (!SEA_PRESETS[level]) return;
  waveField.setSeaPreset(level);
  rememberWaveIntensity(level);
  document.querySelectorAll('.wave-option').forEach(button => {
    const active = Number(button.dataset.wave) === level;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function blurAfterPointerClick(e) {
  if (e.detail > 0) e.currentTarget.blur();
}

document.querySelectorAll('.wave-option').forEach(button => {
  button.addEventListener('click', (e) => {
    audio.start();
    setWaveIntensity(Number(button.dataset.wave), { userInitiated: true });
    blurAfterPointerClick(e);
  });
});
setWaveIntensity(storedWaveIntensity());

const viewInput = new ViewInputController({
  element: renderer.domElement,
  cameraController,
  audio,
  isTouch: IS_TOUCH,
  isAppStarted: () => startup.started,
  isGestureActive: () => gestureDrive.state.active,
});
viewInput.bind();

const elKn = document.getElementById('kn');
const elThrottle = document.querySelector('#throttle i');
const elRudder = document.querySelector('#rudder i');
const boatHud = new BoatHud(elKn, elThrottle, elRudder);
const headingElement = document.getElementById('heading');
const debugElement = new URLSearchParams(location.search).has('debug') ? document.getElementById('sim-debug') : null;
if (debugElement) debugElement.hidden = false;
const headingForward = new THREE.Vector3();
let debugElapsed = 0;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  qualityController.resize();
  perceptualEffects.resize();
});

if (new URLSearchParams(location.search).has('debug')) {
  window.openWater = {
    boat, waveField, wakeField, camera, ocean, effects, foamTrail,
    weather, perceptualEffects, colorGrading, audio, renderer,
    snapCamera: () => cameraController.snap(),
    environmentState: () => ({
      trueWindMps: boat.trueWind.length(),
      apparentWindMps: boat.apparentWindSpeed,
      currentMps: boat.surfaceCurrent.length(),
      stwKn: boat.speedKn,
      sogKn: boat.groundSpeedKn,
      gustFactor: waveField.gustFactor,
      wakeSources: wakeField.activeCount,
    }),
  };
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const frameStart = performance.now();
  performanceManager.beginFrame(frameStart);
  qualityController.applyPending();
  renderer.info.reset();
  const frameDt = Math.min(clock.getDelta(), 0.05);
  const dt = startup.started ? frameDt : 0;
  waveField.update(dt, boat.pos.x, boat.pos.z);
  wakeField.update(dt, boat, waveField);
  environment.updateAtmosphere(dt);
  driveValidation?.update(dt);
  drive.update(dt, waveField.time, gestureDrive.state);
  boat.update(dt);
  ocean.update(dt, boat.pos.x, boat.pos.z, boat);
  foamTrail.update(renderer, dt, boat);
  ocean.uniforms.uFoamTrail.value = foamTrail.texture;
  ocean.uniforms.uTrailCenter.value.copy(foamTrail.center);
  effects.update(dt);
  environment.positionSunHolder(camera.position);
  cameraController.update(dt);
  environment.positionSky(camera.position);
  audio.update(boat, camera, dt);
  weather.update(dt);
  environment.setLightning(weather.flash);
  perceptualEffects.update(
    dt,
    weather.storm,
    cameraController.mode,
    effects.cameraSprayExposure(camera.position),
  );
  colorGrading.update(dt);
  boatHud.update(boat.speedKn, drive.throttle, drive.wheel);
  debugElapsed += frameDt;
  if (debugElapsed > 0.2) {
    debugElapsed = 0;
    headingForward.set(0, 0, 1).applyQuaternion(boat.quat);
    const heading = (Math.atan2(headingForward.x, headingForward.z) * 180 / Math.PI + 360) % 360;
    headingElement.textContent = heading.toFixed(1) + '°';
    if (debugElement) debugElement.textContent = `Zodiac | ${boat.physicsHz} Hz | Sea ${waveField.preset}\nTime ${waveField.time.toFixed(2)} s\nPosition ${boat.pos.x.toFixed(3)}, ${boat.pos.y.toFixed(3)}, ${boat.pos.z.toFixed(3)}\nSpeed ${boat.vel.length().toFixed(3)} m/s\nThrottle ${boat.throttle.toFixed(2)} | Steering ${boat.steer.toFixed(2)}\nWake sources ${wakeField.activeCount}`;
  }
  environment.positionSunLight(boat.pos);
  performanceManager.beginGpu();
  waterPasses.render(frameStart, qualityController.current);
  composer.render();
  performanceManager.endGpu();
  performanceManager.endFrame();
  qualityController.updateHud(frameStart);
  startup.frameRendered();
});
