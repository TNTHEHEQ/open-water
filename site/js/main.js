import { ObstacleManager } from './scenario/obstacle-manager.js';
import { PlannerVisualizationGroup } from './visualization/planner-visualization-group.js';
import { PlannerLog } from './experiments/planner-log.js';
import { loadSingleVessel } from './controllers/single-vessel-loader.js';
import { SimulationStartup } from './ui/simulation-startup.js';
import { SIMULATOR_CONFIG } from './config/simulator-config.js';
import { SimulationStateSource } from './twin/simulation-state-source.js';
import { CommandMux } from './control/command-authority.js';
import { PlannerBridge, resolvePlannerEndpoint } from './bridge/planner-bridge.js';
import { ExperimentRecorder } from './experiments/experiment-recorder.js';
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
boat.setActuatorMode(SIMULATOR_CONFIG.actuatorMode);
const effects = new BoatEffects(scene, waveField, boat);
const audio = new BoatAudio(waveField, { engineBank: VESSEL_SPECS[SIMULATOR_CONFIG.vesselId].audio.bank, wildlife: SIMULATOR_CONFIG.wildlife });
effects.onExhaustPop = (intensity, position) => audio.exhaustPop(intensity, position);
const foamTrail = new FoamTrail();
const weather = new WeatherEffects(scene, camera, waveField, audio);
const perceptualEffects = new PerceptualEffects({ scene, camera, boat, waveField });
const colorGrading = new ColorGrading(waveField);
const commandMux = new CommandMux(boat, {
  maxSteerRad: VESSEL_SPECS[SIMULATOR_CONFIG.vesselId].maxSteerRad,
  externalCommandTimeoutSec: SIMULATOR_CONFIG.externalCommandTimeoutSec,
});
let plannerEndpoint = '';
try { plannerEndpoint = resolvePlannerEndpoint(location.search, SIMULATOR_CONFIG); }
catch { console.warn('Invalid planner URL: continuing standalone MANUAL'); }
const obstacleManager = new ObstacleManager();
const plannerVisuals = new PlannerVisualizationGroup(scene, (x, y) => waveField.heightAt(x, y));
plannerVisuals.visible = Boolean(plannerEndpoint);
const plannerLog = new PlannerLog();
let seedObstacleScenario = true, latestObstacles = null;
const plannerBridge = new PlannerBridge(commandMux, {
  endpoint: plannerEndpoint, stateRateHz: SIMULATOR_CONFIG.plannerStateRateHz,
  visualizationOnly: true,
  obstacleSource: time => obstacleManager.snapshot(time),
  onPlan: message => {
    plannerVisuals.planned.replace(message);
    plannerLog.record(message, twinStateSource.getState(), plannerBridge.diagnostics.obstacleSequence);
  },
});
const recorder = new ExperimentRecorder({ sampleRateHz: SIMULATOR_CONFIG.recorderSampleRateHz });
let plannerStarted = false;
const drive = new DriveController(commandMux, {
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
  driveValidation = new DriveValidation(drive, boat, output, () => window.openWater.twin.getState());
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
    // Render quality must not change this plant's 240 Hz actuator integration.
    { setPerformanceBudget: budget => boat.setPerformanceBudget({ ...budget, physicsHz: 240, physicsMaxSteps: 12 }) },
    ocean, environment, effects, weather, perceptualEffects,
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
  plannerVisuals.clear(); seedObstacleScenario = true; obstacleManager.clear(); plannerBridge.invalidatePlans();
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
  if (e.code === 'KeyR' && commandMux.mode === 'MANUAL') resetBoat();
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
const twinStateSource = new SimulationStateSource(boat, waveField);
let debugElapsed = 0;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  qualityController.resize();
  perceptualEffects.resize();
});

if (new URLSearchParams(location.search).has('debug')) {
  window.openWater = {
    twin: Object.freeze({ getState: () => twinStateSource.snapshot() }),
    bridge: plannerBridge, recorder, plannerVisuals, obstacleManager, plannerLog,
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
  const plannerControls = document.createElement('div');
  plannerControls.innerHTML = '<label><input id="planner-visible" type="checkbox">Planner visualization</label> <button id="plan-log-download">Download plan log</button>';
  document.getElementById('recorder-controls').appendChild(plannerControls);
  const visibleToggle = document.getElementById('planner-visible'); visibleToggle.checked = plannerVisuals.visible;
  visibleToggle.onchange = () => { plannerVisuals.visible = visibleToggle.checked; };
  document.getElementById('plan-log-download').onclick = () => plannerLog.download();
  const controls = document.getElementById('recorder-controls'); controls.hidden = false;
  document.getElementById('record-start').onclick = () => recorder.start('experiment');
  document.getElementById('record-stop').onclick = () => recorder.stop();
  document.getElementById('record-download').onclick = () => recorder.downloadCsv();
  document.getElementById('record-preview').onclick = () => {
    const output = document.getElementById('csv-preview');
    output.hidden = !output.hidden;
    if (!output.hidden) output.textContent = recorder.getCsv();
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
  // Connect only after startup; the server's presence never grants ownership.
  if (startup.started && !plannerStarted) { plannerStarted = true; plannerBridge.start(); }
  commandMux.apply(performance.now() / 1000);
  boat.update(dt);
  const state = twinStateSource.update();
  if (seedObstacleScenario && startup.started) { obstacleManager.seedVisualScenario(state); seedObstacleScenario = false; }
  latestObstacles = obstacleManager.snapshot(state.timestamp);
  plannerBridge.update(state);
  plannerVisuals.update(state, latestObstacles);
  recorder.update(state);
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
    if (debugElement) {
      const s = twinStateSource.getState(), p = s.pose.position, v = s.velocity.body;
      debugElement.textContent = `Twin v${s.schemaVersion} | ${s.source} | ${s.vesselId} | ${boat.physicsHz} Hz | Sea ${s.environment.seaState}\n`
        + `Time ${s.timestamp.toFixed(2)} s | Sequence ${s.sequence}\n`
        + `ENU E ${p.x.toFixed(3)} N ${p.y.toFixed(3)} U ${p.z.toFixed(3)} m\n`
        + `Heading ${s.pose.headingRad.toFixed(3)} rad | Surge ${v.surge.toFixed(3)} Sway ${v.sway.toFixed(3)} m/s\n`
        + `Yaw rate ${v.yawRate.toFixed(3)} rad/s | Prop Cmd ${s.control.propulsionCommand.toFixed(2)} Actual ${s.actuator.propulsionActual.toFixed(3)}\n`
        + `Steer Cmd ${s.control.steeringCommandRad.toFixed(3)} Actual ${s.actuator.steeringActualRad.toFixed(3)} Effective ${s.actuator.steeringEffectiveRad.toFixed(3)} rad\nRate ${s.actuator.steeringRateRadPerSec.toFixed(3)} rad/s | Raw ${s.actuator.rawThrustN.toFixed(1)} Effective ${s.actuator.effectiveThrustN.toFixed(1)} N | Wet ${s.actuator.ventilationFactor.toFixed(3)}\n`
        + `Planing ${s.dynamics.planingForceN.toFixed(1)} N | Submerged ${s.dynamics.submergedPoints} | Wake ${wakeField.activeCount}\n`
        + `Rig steer ${boat.visualRig?._steer.toFixed(3)} rad | Pivots ${boat.visualRig?.steerPivots.length} | Props ${boat.visualRig?.propellers.length} | Jet anchors ${effects._propPositions.length}\n`
        + `Planner: ${plannerBridge.diagnostics.connected ? 'CONNECTED' : 'DISCONNECTED'} | Authority: ${commandMux.mode} | Failsafe: ${commandMux.failsafe ? 'YES' : 'NO'}\n`
        + `Command age: ${plannerBridge.diagnostics.lastCommandAgeMs?.toFixed(0) ?? '-'} ms | RX seq: ${plannerBridge.diagnostics.lastCommandSequence} | TX state: ${plannerBridge.diagnostics.stateSequence}\n`
        + `P6A VISUALIZATION ONLY / SYNTHETIC MODEL | NO ACTUATOR MAPPING\n`
        + `Plant seq ${plannerBridge.diagnostics.stateSequence} | Obstacle seq ${plannerBridge.diagnostics.obstacleSequence} | Blocked control ${plannerBridge.diagnostics.blockedControlMessages}\n`
        + `Plan ${plannerBridge.diagnostics.planId} | ${plannerBridge.diagnostics.planStatus} | Points ${plannerBridge.diagnostics.planPoints}\n`
        + `Source sim ${plannerBridge.diagnostics.planSourceTime?.toFixed(2) ?? '-'} | Received sim ${plannerBridge.diagnostics.planReceivedTime?.toFixed(2) ?? '-'} | Plan age ${plannerBridge.diagnostics.planSourceTime === null ? '-' : (s.timestamp - plannerBridge.diagnostics.planSourceTime).toFixed(2)} s\n`
        + `Solve ${plannerBridge.diagnostics.planSolveTime?.toFixed(2) ?? '-'} s | Actual trail ${plannerVisuals.actual.count} | Obstacles ${plannerVisuals.obstacles.objects.size}\n`
        + `Visual CPU mean ${(plannerVisuals.metrics.cpuMs / Math.max(1, plannerVisuals.metrics.updates)).toFixed(3)} ms | Cyan plan / Yellow actual / Orange prediction\n`
        + `Frame CPU ON ${(plannerVisuals.frameCosts.on.totalMs / Math.max(1, plannerVisuals.frameCosts.on.count)).toFixed(3)} ms (${plannerVisuals.frameCosts.on.count}) / OFF ${(plannerVisuals.frameCosts.off.totalMs / Math.max(1, plannerVisuals.frameCosts.off.count)).toFixed(3)} ms (${plannerVisuals.frameCosts.off.count})\n`
        + `REC ${recorder.recording ? 'ON' : 'OFF'} | Samples ${recorder.rows.length} | Skipped ${recorder.skippedSlots}`;
    }
  }
  environment.positionSunLight(boat.pos);
  performanceManager.beginGpu();
  waterPasses.render(frameStart, qualityController.current);
  composer.render();
  performanceManager.endGpu();
  performanceManager.endFrame();
  qualityController.updateHud(frameStart);
  startup.frameRendered();
  if (startup.started) plannerVisuals.recordFrame(performance.now() - frameStart);
});
