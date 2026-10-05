// Independent P7A real Boat harness. Reuse P6B bridge/mux/preconditioning/
// native tracking and reconstruction. Physical state is never assigned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import WebSocket from 'ws';
import * as THREE from 'three';
import { WaveField } from '../site/js/simulation/waves.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
import { SimulationStateSource } from '../site/js/twin/simulation-state-source.js';
import { CommandMux } from '../site/js/control/command-authority.js';
import { PlannerBridge } from '../site/js/bridge/planner-bridge.js';
import { plantCapabilities, SimulationHoldController, PlanExecutionController,
  P6BTestPreconditioner } from '../site/js/integration/plan-execution.js';
globalThis.window ??= { location: { search: '' } };
globalThis.matchMedia ??= () => ({ matches: false });
const { Boat } = await import('../site/js/simulation/boat.js');
const owRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(owRoot, '../all-in-planner');
const output = path.join(root, 'research/lifted_stp/results/p7a_openwater_tracking');
const contract = JSON.parse(fs.readFileSync(path.join(output, 'contract.json'), 'utf8'));
const candidate = process.argv[2] ?? 'Ku0_A', scenario = process.argv[3] ?? 'CALIBRATION';
const caseName = scenario.toLowerCase() + '_' + candidate;
const directory = path.join(output, 'campaigns', caseName);
const owDirectory = path.join(owRoot, 'results/p7a_tracking', caseName);
if (fs.existsSync(path.join(directory, 'result.json'))) throw Error('Formal result exists; do not overwrite');
fs.mkdirSync(directory, { recursive: true }); fs.mkdirSync(owDirectory, { recursive: true });
const config = scenario === 'CALIBRATION' ? path.join(output, 'configs', candidate + '.json')
  : path.join(output, 'openwater_tracking_v1.json');
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const frozenConfigHash = hash(config);
const child = spawn(path.join(root, 'build/linux-release/cpp/lifted_stp/openwater/p6b_openwater_server'),
  ['8771', directory, config], { cwd: root, env: { ...process.env, OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1' } });
let consoleOutput = '', timer, execution, bridge, report, source, mux, hold;
child.stdout.on('data', b => { consoleOutput += b; });
child.stderr.on('data', b => { consoleOutput += b; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, seconds = 180) {
  const start = performance.now();
  while (!fn()) {
    if (child.exitCode !== null) throw Error('Native server exited ' + child.exitCode + ': ' + consoleOutput.slice(-1000));
    if (performance.now() - start > seconds * 1000) throw Error('Wall timeout ' + execution?.status + ': ' + consoleOutput.slice(-1000));
    await pause(1);
  }
}
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const telemetry = [];
try {
  await until(() => consoleOutput.includes('P6B LISTEN'), 30);
  const water = new WaveField(); water.setSeaPreset(contract.calibration.sea_preset);
  const boat = new Boat(water, new THREE.Scene(), 0); boat.setSpec(VESSEL_SPECS.zodiac_boat); boat.reset();
  source = new SimulationStateSource(boat, water); source.update();
  mux = new CommandMux(boat, { maxSteerRad: boat.spec.maxSteerRad }); hold = new SimulationHoldController();
  let obstacleSequence = 0;
  bridge = new PlannerBridge(mux, { endpoint: 'ws://127.0.0.1:8771',
    socketFactory: url => new WebSocket(url), visualizationOnly: false,
    obstacleSource: time => ({ protocol_version: 1, type: 'obstacle_state', sequence: obstacleSequence++,
      simulation_time: time, obstacles: [] }), onPlan: p => execution.onPlan(p) });
  execution = new PlanExecutionController(bridge, mux, hold, plantCapabilities(boat.spec)); bridge.execution = execution;
  const pre = new P6BTestPreconditioner(mux, boat.spec, hold); pre.start();
  const dt = contract.calibration.simulation_dt_sec;
  while (pre.active) {
    pre.update(source.getState(), dt); mux.apply(performance.now() / 1000);
    const step = hold.timestep(dt); water.update(step, boat.pos.x, boat.pos.z); boat.update(step); source.update();
  }
  const initial = source.snapshot();
  report = { caseName, scenario, candidate, status: 'RUNNING', initial,
    preconditioning_status: pre.status, plant_capabilities: plantCapabilities(boat.spec),
    controller_config: JSON.parse(fs.readFileSync(config, 'utf8')), controller_sha256: frozenConfigHash,
    episode_frame: { E_ref: initial.pose.position.x, N_ref: initial.pose.position.y, H_ref: initial.pose.headingRad },
    source_contract_sha256: hash(path.join(output, 'contract.json')), tracking_started: false };
  write(path.join(directory, 'initial.json'), report);
  if (pre.status !== 'READY') throw Error('PRECONDITIONING_FAILURE');
  bridge.start();
  timer = setInterval(() => {
    if (hold.held || !bridge.diagnostics.connected) bridge.update(source.getState());
    mux.apply(performance.now() / 1000);
  }, 20);
  await until(() => bridge.diagnostics.connected, 15); await pause(50);
  execution.request(source.getState(), scenario);
  const beforeSolve = source.snapshot(), solveStarted = performance.now();
  await until(() => ['PLAN_READY', 'SOLVER_ERROR', 'ABORTED'].includes(execution.status));
  report.solve_wall_sec = (performance.now() - solveStarted) / 1000; report.plan = execution.plan;
  report.planning_hold = { before: beforeSolve, after: source.snapshot(),
    simulation_time_unchanged: source.getState().timestamp === beforeSolve.timestamp };
  if (execution.status !== 'PLAN_READY') {
    report.status = 'OPENWATER_REAL_STATE_PLANNING_FAILURE';
    report.failure = execution.events; report.metrics = null;
  } else {
    report.tracking_started = true; execution.execute();
    await until(() => ['EXECUTING', 'ABORTED'].includes(execution.status), 10);
    while (execution.status === 'EXECUTING') {
      mux.apply(performance.now() / 1000);
      const step = hold.timestep(dt); water.update(step, boat.pos.x, boat.pos.z); boat.update(step); source.update();
      bridge.nextPublish = -Infinity; bridge.update(source.getState());
      await until(() => execution.status !== 'EXECUTING'
        || execution.metrics.t_rel >= water.time - execution.plan.source_simulation_time - 1e-9, 5);
      execution.update(source.getState());
      telemetry.push({ state: source.snapshot(), control_mode: mux.mode, failsafe: mux.failsafe, metrics: { ...execution.metrics } });
      const m = execution.metrics;
      if ([m.position_error, m.cross_error, m.heading_error, m.speed_error].some(v => !Number.isFinite(v))) execution.abort('NONFINITE_TRACKING');
      else if (scenario === 'CALIBRATION' && (Math.abs(m.cross_error) > 2 || Math.abs(m.heading_error) > .5
        || Math.abs(m.speed_error) > 1)) execution.abort('CALIBRATION_HARD_REJECTION');
    }
    const records = fs.readFileSync(path.join(directory, 'execution-1.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const rms = k => Math.sqrt(records.reduce((sum, r) => sum + r[k] ** 2, 0) / records.length);
    const max = k => Math.max(...records.map(r => Math.abs(r[k])));
    const metrics = { samples: records.length, execution_sec: source.getState().timestamp - initial.timestamp,
      amplitude_saturation_fraction: records.filter(r => r.amplitude_saturated).length / records.length,
      rate_limited_fraction: records.filter(r => r.rate_limited).length / records.length,
      timeout_count: execution.failures, abort_count: execution.status === 'COMPLETE' ? 0 : 1,
      steering_command_total_variation_rad: records.slice(1).reduce((sum, r, i) => sum + Math.abs(r.delta_exec - records[i].delta_exec), 0) };
    for (const k of ['position_error', 'along_error', 'cross_error', 'heading_error', 'speed_error', 'yaw_error']) {
      metrics['rms_' + k] = rms(k); metrics['max_' + k] = max(k); metrics['terminal_' + k] = records.at(-1)[k];
    }
    metrics.score = metrics.rms_cross_error / .5 + metrics.rms_heading_error / .1
      + metrics.rms_speed_error / .3 + .5 * metrics.rms_yaw_error / .1
      + 2 * metrics.amplitude_saturation_fraction + metrics.rate_limited_fraction;
    report.status = execution.status; report.metrics = metrics;
    report.calibration_eligible = report.status === 'COMPLETE'
      && metrics.max_cross_error <= 2 && metrics.max_heading_error <= .5 && metrics.max_speed_error <= 1
      && metrics.amplitude_saturation_fraction <= .2 && metrics.timeout_count === 0;
  }
  report.final = source.snapshot(); report.events = execution.events; report.messages = bridge.diagnostics;
  if (hash(config) !== frozenConfigHash) throw Error('CONTROLLER_CONFIG_CHANGED');
} catch (error) {
  report ??= { caseName, scenario, candidate, tracking_started: false };
  report.status = 'HARNESS_ERROR'; report.error = String(error); process.exitCode = 1;
} finally {
  clearInterval(timer);
  if (execution?.owns) execution.abort('RUN_END', false);
  hold?.hold(); report ??= { status: 'HARNESS_ERROR' };
  write(path.join(directory, 'result.json'), report); write(path.join(owDirectory, 'result.json'), report);
  write(path.join(owDirectory, 'telemetry.json'), telemetry);
  fs.writeFileSync(path.join(owDirectory, 'bridge-console.txt'), consoleOutput);
  bridge?.stop(); child.stdin.end('QUIT\n');
  if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  console.log(caseName, report.status, JSON.stringify(report.metrics ?? report.error ?? null));
}
