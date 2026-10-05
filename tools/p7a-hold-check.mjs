// Real wall-clock, real Boat, native C++ keepalive test. No state publications
// during the ten-second held interval: freshness must come from the native timer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
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
const out = path.join(root, 'research/lifted_stp/results/p7a_openwater_tracking/hold_test');
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync(path.join(out, 'result.json'))) throw Error('Hold evidence exists; no overwrite');
const child = spawn(path.join(root, 'build/linux-release/cpp/lifted_stp/openwater/p6b_openwater_server'),
  ['8771', out, path.join(root, 'research/lifted_stp/results/p7a_openwater_tracking/openwater_tracking_v1.json')]);
let consoleOutput = '', publishing, polling, bridge, execution, report;
child.stdout.on('data', b => { consoleOutput += b; }); child.stderr.on('data', b => { consoleOutput += b; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, seconds = 180) {
  const start = performance.now();
  while (!fn()) {
    if (child.exitCode !== null || performance.now() - start > seconds * 1000) throw Error('Native hold-test timeout: ' + consoleOutput.slice(-800));
    await pause(2);
  }
}
const samples = [], commands = [];
try {
  await until(() => consoleOutput.includes('P6B LISTEN'), 30);
  const water = new WaveField(); water.setSeaPreset(1);
  const boat = new Boat(water, new THREE.Scene(), 0); boat.setSpec(VESSEL_SPECS.zodiac_boat); boat.reset();
  const source = new SimulationStateSource(boat, water); source.update();
  const mux = new CommandMux(boat, { maxSteerRad: boat.spec.maxSteerRad });
  const hold = new SimulationHoldController(); const pre = new P6BTestPreconditioner(mux, boat.spec, hold);
  pre.start();
  while (pre.active) {
    pre.update(source.getState(), .02); mux.apply(performance.now() / 1000);
    const dt = hold.timestep(.02); water.update(dt, boat.pos.x, boat.pos.z); boat.update(dt); source.update();
  }
  if (pre.status !== 'READY') throw Error('PRECONDITIONING_FAILURE');
  let sequence = 0;
  bridge = new PlannerBridge(mux, { endpoint: 'ws://127.0.0.1:8771', socketFactory: url => new WebSocket(url),
    onPlan: plan => execution.onPlan(plan),
    obstacleSource: time => ({ protocol_version: 1, type: 'obstacle_state', sequence: sequence++, simulation_time: time, obstacles: [] }) });
  execution = new PlanExecutionController(bridge, mux, hold, plantCapabilities(boat.spec)); bridge.execution = execution;
  const receive = bridge.receive.bind(bridge);
  bridge.receive = text => {
    const m = JSON.parse(text);
    if (m.type === 'control_command') commands.push({ received_wall_sec: performance.now() / 1000, ...m });
    receive(text);
  };
  bridge.start(); publishing = setInterval(() => bridge.update(source.getState()), 20);
  await until(() => bridge.diagnostics.connected, 15); await pause(50);
  execution.request(source.getState(), 'CALIBRATION');
  await until(() => ['PLAN_READY', 'SOLVER_ERROR'].includes(execution.status));
  if (execution.status !== 'PLAN_READY') throw Error('Hold test requires accepted real-state plan');
  execution.onControl = () => {}; // Deliberately retain HOLD; no execution_ack.
  execution.execute();
  await until(() => mux.mode === 'EXTERNAL' && bridge.claimed && mux.external.isFresh(bridge.now(), .5), 10);
  clearInterval(publishing);
  const physical = () => {
    const s = source.snapshot();
    return { timestamp: s.timestamp, pose: s.pose, velocity: s.velocity, attitude: s.attitude,
      actuator: s.actuator, command: s.control };
  };
  const before = physical(), wallStart = performance.now() / 1000, commandsBefore = commands.length;
  let changed = false, failsafeCount = 0;
  polling = setInterval(() => {
    mux.apply(bridge.now()); const dt = hold.timestep(.02);
    water.update(dt, boat.pos.x, boat.pos.z); boat.update(dt); source.update();
    if (JSON.stringify(physical()) !== JSON.stringify(before)) changed = true;
    if (mux.failsafe) failsafeCount++;
    samples.push({ wall_sec: performance.now() / 1000 - wallStart, t_sim: water.time,
      propulsionCommand: boat.diagnostics.propulsionCommand, steeringCommandRad: boat.diagnostics.steeringCommandRad,
      rawThrustN: boat.diagnostics.rawThrustN, steeringActualRad: boat.diagnostics.steeringActualRad, failsafe: mux.failsafe });
  }, 20);
  await pause(10000); clearInterval(polling);
  const received = commands.slice(commandsBefore), wallDuration = performance.now() / 1000 - wallStart;
  const sameCommands = received.every(c => c.propulsion_command === before.command.propulsionCommand
    && c.steering_angle_rad === before.command.steeringCommandRad && c.timestamp === before.timestamp);
  const gaps = received.slice(1).map((c, i) => c.received_wall_sec - received[i].received_wall_sec);
  const maxGap = Math.max(0, ...gaps, received[0]?.received_wall_sec - wallStart,
    wallStart + wallDuration - received.at(-1)?.received_wall_sec);
  report = { status: !changed && sameCommands && failsafeCount === 0 && received.length >= 90 && maxGap < .5
    ? 'HOLD_KEEPALIVE_PASS' : 'HOLD_KEEPALIVE_FAIL', wall_duration_sec: wallDuration,
    native_timer_only: true, state_publications_during_hold: 0, keepalive_count: received.length,
    max_command_receipt_gap_sec: maxGap, simulation_time_unchanged: before.timestamp === water.time,
    all_physical_fields_unchanged: !changed, all_commands_identical: sameCommands,
    failsafe_count: failsafeCount, before, after: physical(), commands: received, samples };
  execution.abort('HOLD_TEST_COMPLETE'); hold.hold();
} catch (error) { report = { status: 'HOLD_KEEPALIVE_FAIL', error: String(error) }; process.exitCode = 1; }
finally {
  clearInterval(publishing); clearInterval(polling); bridge?.stop(); child.stdin.end('QUIT\n');
  if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  const owOut = path.join(owRoot, 'results/p7a_tracking/hold_test'); fs.mkdirSync(owOut, { recursive: true });
  fs.writeFileSync(path.join(owOut, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(owOut, 'bridge-console.txt'), consoleOutput);
  console.log(report.status, report.wall_duration_sec, report.keepalive_count, report.max_command_receipt_gap_sec);
}
