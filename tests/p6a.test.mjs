import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parsePlannerMessage } from '../site/js/bridge/protocol.js';
import { validateObstacleState } from '../site/js/bridge/visual-protocol.js';
import { ObstacleManager } from '../site/js/scenario/obstacle-manager.js';
import { predictionPoints } from '../site/js/scenario/obstacle-state.js';
import { PlannerVisualizationGroup } from '../site/js/visualization/planner-visualization-group.js';
import { ActualTrackVisualizer } from '../site/js/visualization/actual-track-visualizer.js';
import { enuPlanPointToOpenWater } from '../site/js/twin/coordinate-adapter.js';
import { PlannerBridge } from '../site/js/bridge/planner-bridge.js';
import { CommandMux } from '../site/js/control/command-authority.js';
import { createVesselState } from '../site/js/twin/vessel-state.js';
import { PlannerLog } from '../site/js/experiments/planner-log.js';
const plan = () => ({ protocol_version: 1, type: 'planned_trajectory', sequence: 1, plan_id: 'plan-1',
  source_state_sequence: 1, source_simulation_time: 0, obstacle_sequence: 0, status: 'SUCCESS',
  points: [{ t_rel: 0, x: 1, y: 2, heading_rad: 0, speed_mps: 2 },
    { t_rel: 1, x: 1, y: 4, heading_rad: 0, speed_mps: 2 }] });
const obstacle = () => ({ id: 'one', position: { x: 20, y: 30 }, velocity: { x: 1, y: -2 },
  radius_m: 3, prediction_model: 'CONSTANT_VELOCITY' });
test('P6A trajectory strict validation, finite points, limits and control budget', () => {
  assert.equal(parsePlannerMessage(JSON.stringify(plan())).points.length, 2);
  const p = plan(); p.points[0].x = Infinity;
  assert.throws(() => parsePlannerMessage(JSON.stringify(p)));
  assert.throws(() => parsePlannerMessage(' '.repeat(262145)));
  assert.throws(() => parsePlannerMessage(JSON.stringify(plan()).replace('"x":1', '"x":1e999')));
  p.points = Array.from({ length: 257 }, (_, i) => ({ ...plan().points[0], t_rel: i }));
  assert.throws(() => parsePlannerMessage(JSON.stringify(p)));
  assert.throws(() => parsePlannerMessage(' '.repeat(4096) + '{"protocol_version":1,"type":"set_control_mode","mode":"EXTERNAL"}'));
  p.points = plan().points; p.unknown = 1;
  assert.throws(() => parsePlannerMessage(JSON.stringify(p)));
});
test('P6A geometry replacement, reset, disposal and ENU basis', () => {
  assert.deepEqual(enuPlanPointToOpenWater({ x: 3, y: 7 }, 2), { x: 3, y: 2.2, z: 7 });
  const scene = new THREE.Scene(), v = new PlannerVisualizationGroup(scene, () => 2);
  const geometry = v.planned.geometry; v.planned.replace(plan()); v.planned.replace(plan());
  assert.equal(v.planned.geometry, geometry);
  assert.equal(v.planned.geometry.drawRange.count, 2);
  assert.deepEqual(Array.from(v.planned.positions.slice(0, 3)).map(n => Math.round(n * 10) / 10), [1, 2.2, 2]);
  v.planned.replace({ ...plan(), status: 'FAIL', points: [] });
  assert.equal(geometry.drawRange.count, 0);
  v.clear(); v.dispose(); assert.equal(scene.children.length, 0);
});
test('P6A actual trail bounded memory and fixed buffer', () => {
  const trail = new ActualTrackVisualizer(new THREE.Group(), () => 0, 10), state = createVesselState();
  const buffer = trail.positions;
  for (let i = 0; i < 100; i++) { state.timestamp = i; state.pose.position.x = i; trail.update(state); }
  assert.equal(trail.count, 10); assert.equal(trail.positions, buffer);
  assert.equal(trail.positions[0], 90); assert.equal(trail.positions[27], 99);
  trail.clear(); assert.equal(trail.count, 0); trail.dispose();
});
test('P6A simulator-time obstacle truth, update, deletion and prediction', () => {
  const m = new ObstacleManager(); m.setScenario([obstacle()], 10);
  assert.deepEqual(m.snapshot(12).obstacles[0].position, { x: 22, y: 26 });
  assert.deepEqual(m.snapshot(12).obstacles[0].position, { x: 22, y: 26 });
  const group = new PlannerVisualizationGroup(new THREE.Scene(), () => 0);
  group.obstacles.update(m.snapshot(12), 50);
  const item = group.obstacles.objects.get('one');
  assert.equal(item.body.position.x, 22); assert.equal(item.body.position.z, 26);
  assert.deepEqual(predictionPoints(m.snapshot(12).obstacles[0], 50)[1], { x: 72, y: -74 });
  m.remove('one'); group.obstacles.update(m.snapshot(13)); assert.equal(group.obstacles.objects.size, 0);
  group.dispose();
  assert.throws(() => m.setScenario([obstacle(), obstacle()], 0));
  assert.throws(() => validateObstacleState({}));
});
test('P6A visual-only bridge cannot claim or write external control; old default remains covered by legacy tests', () => {
  const calls = [], sink = { setActuatorCommands: c => calls.push({ ...c }) };
  const mux = new CommandMux(sink, { maxSteerRad: .5 }); let received = 0;
  const bridge = new PlannerBridge(mux, { visualizationOnly: true, onPlan: () => received++ });
  bridge.receive('{"protocol_version":1,"type":"set_control_mode","mode":"EXTERNAL"}');
  bridge.receive('{"protocol_version":1,"type":"control_command","sequence":1,"timestamp":0,"propulsion_command":1,"steering_angle_rad":0.5}');
  assert.equal(mux.mode, 'MANUAL'); assert.equal(bridge.diagnostics.blockedControlMessages, 2);
  assert.equal(calls.length, 0);
  bridge.receive(JSON.stringify(plan())); assert.equal(received, 1); assert.equal(calls.length, 0);
  bridge.receive(JSON.stringify(plan())); assert.equal(received, 1);
});
test('P6A paired publishing and no historical queue under backpressure', () => {
  let now = 0, sent = [];
  const mux = new CommandMux({ setActuatorCommands() {} }, { maxSteerRad: .5 });
  const manager = new ObstacleManager(); manager.setScenario([obstacle()], 0);
  const socket = { readyState: 1, bufferedAmount: 0, send: text => sent.push(JSON.parse(text)), close() {} };
  const bridge = new PlannerBridge(mux, { endpoint: 'ws://localhost', now: () => now,
    visualizationOnly: true, socketFactory: () => socket, obstacleSource: t => manager.snapshot(t) });
  bridge.start(); socket.onopen(); const state = createVesselState();
  state.timestamp = 1; bridge.update(state);
  assert.deepEqual(sent.slice(-2).map(m => [m.type, m.simulation_time]), [['simulation_state', 1], ['obstacle_state', 1]]);
  const count = sent.length; socket.bufferedAmount = 100000; now = 10; bridge.update(state);
  assert.equal(sent.length, count); bridge.stop();
});
test('P6A separate bounded per-plan log', () => {
  const log = new PlannerLog(2), state = createVesselState(); state.timestamp = 5;
  for (let i = 0; i < 3; i++) log.record(plan(), state, 5);
  assert.equal(log.entries.length, 2); assert.equal(log.entries[0].plan_age_sec, 5);
  assert.equal(log.entries[0].plan.points.length, 2);
});
test('P6A visualization ON/OFF preserves identical physical integration', async () => {
  const { createPlant } = await import('../tools/p0a-common.mjs');
  const { SimulationStateSource } = await import('../site/js/twin/simulation-state-source.js');
  function run(visible) {
    const boat = createPlant(), source = new SimulationStateSource(boat, boat.wf);
    const visuals = new PlannerVisualizationGroup(new THREE.Scene(), (x, y) => boat.wf.heightAt(x, y));
    visuals.visible = visible; const manager = new ObstacleManager(); manager.setScenario([obstacle()], 0);
    visuals.planned.replace(plan()); let steps = 0; const step = boat._step.bind(boat);
    boat._step = dt => { steps++; step(dt); };
    for (let i = 0; i < 600; i++) {
      boat.setControls(.55, i > 120 ? .3 : 0); boat.wf.time += 1 / 60; boat.update(1 / 60);
      visuals.update(source.update(), manager.snapshot(boat.wf.time));
    }
    const out = { pos: boat.pos.toArray(), q: boat.quat.toArray(), v: boat.vel.toArray(), w: boat.angVelB.toArray(),
      steps, actualPropulsion: boat.diagnostics.actualPropulsion };
    visuals.dispose(); return out;
  }
  assert.deepEqual(run(true), run(false));
});
test('P6A hiding group preserves actual history', () => {
  const group = new PlannerVisualizationGroup(new THREE.Scene(), () => 0), state = createVesselState();
  group.visible = false; state.timestamp = 1;
  group.update(state, { obstacles: [] }); assert.equal(group.actual.count, 1); group.dispose();
});

test('P6A reset before Start never opens a socket', () => {
  const mux = new CommandMux({ setActuatorCommands() {} }, { maxSteerRad: .5 });
  let opened = 0;
  const bridge = new PlannerBridge(mux, { endpoint: 'ws://localhost:8765', visualizationOnly: true,
    socketFactory: () => { opened++; throw Error('Not started'); } });
  bridge.invalidatePlans(); assert.equal(opened, 0); assert.equal(bridge.running, false);
  assert.equal(bridge.diagnostics.planPoints, 0); assert.equal(mux.mode, 'MANUAL');
});
