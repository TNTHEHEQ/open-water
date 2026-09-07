import test from 'node:test';
import assert from 'node:assert/strict';
import { PlannerBridge, resolvePlannerEndpoint } from '../../site/js/bridge/planner-bridge.js';
import { CommandMux } from '../../site/js/control/command-authority.js';
import { createVesselState } from '../../site/js/twin/vessel-state.js';
import { SimulationStateSource } from '../../site/js/twin/simulation-state-source.js';
import { ExperimentRecorder } from '../../site/js/experiments/experiment-recorder.js';
import { createPlant } from '../../tools/p0a-common.mjs';
function setup() {
  let now = 0, command;
  const sockets = [], mux = new CommandMux({ setActuatorCommands(c) { command = { ...c }; } }, { maxSteerRad: .5 });
  const bridge = new PlannerBridge(mux, { endpoint: 'ws://localhost:8765', now: () => now, socketFactory: () => {
    const socket = { readyState: 1, bufferedAmount: 0, sent: [], send(text) { this.sent.push(JSON.parse(text)); }, close() { this.readyState = 3; this.onclose(); } };
    sockets.push(socket); return socket;
  } });
  bridge.start(); sockets[0].onopen();
  return { bridge, mux, sockets, command: () => command, time: t => { now = t; } };
}
const mode = m => JSON.stringify({ protocol_version: 1, type: 'set_control_mode', mode: m });
const command = (seq, timestamp = 999999) => JSON.stringify({ protocol_version: 1, type: 'control_command', sequence: seq, timestamp, propulsion_command: .6, steering_angle_rad: .2 });
test('bridge requires ownership; rejects invalid/old commands without refreshing timeout', () => {
  const x = setup(), b = x.bridge;
  b.receive(command(0)); assert.equal(b.diagnostics.invalidMessages, 1); assert.equal(x.mux.mode, 'MANUAL');
  b.receive(mode('EXTERNAL')); b.receive(command(1)); assert.equal(x.command().propulsionCommand, .6);
  x.time(.4); b.receive(command(1)); b.receive(command(0)); b.receive('{'); b.receive('{"protocol_version":2}');
  x.time(.51); x.mux.apply(.51); b.update(createVesselState());
  assert.equal(x.command().propulsionCommand, 0); assert.equal(b.diagnostics.failsafe, true);
  assert.equal(b.diagnostics.invalidMessages, 5); assert.equal(b.diagnostics.lastCommandAgeMs, 510);
});
test('disconnect immediately fails safe; reconnect requires new ownership and new command, sequences restart per connection', () => {
  const x = setup(), b = x.bridge; b.receive(mode('EXTERNAL')); b.receive(command(20));
  x.sockets[0].close(); assert.equal(x.command().propulsionCommand, 0); assert.equal(b.diagnostics.failsafe, true);
  x.time(.9); b.update(createVesselState()); assert.equal(x.sockets.length, 1);
  x.time(1); b.update(createVesselState()); assert.equal(x.sockets.length, 2); x.sockets[1].onopen();
  b.receive(command(0)); assert.equal(x.command().propulsionCommand, 0);
  b.receive(mode('EXTERNAL')); b.receive(command(0)); assert.equal(x.command().propulsionCommand, .6);
  b.stop(); x.time(100); b.update(createVesselState()); assert.equal(x.sockets.length, 2);
});
test('publisher throttles to 50 Hz, latest wins under backpressure, invalid state is never serialized', () => {
  const x = setup(), b = x.bridge, s = createVesselState(), socket = x.sockets[0];
  for (let i = 0; i < 1000; i++) { x.time(i / 1000); b.update(s); }
  assert.equal(socket.sent.filter(m => m.type === 'simulation_state').length, 50);
  socket.bufferedAmount = 1e6; x.time(1); b.update(s); assert.equal(b.diagnostics.droppedStateMessages, 1);
  socket.bufferedAmount = 0; s.pose.position.x = 42; x.time(2); b.update(s);
  assert.equal(socket.sent.at(-1).state.pose.position.x, 42); assert.equal(socket.sent.length, 52);
  s.pose.position.x = Infinity; x.time(3); b.update(s); assert.equal(socket.sent.length, 52);
});
test('optional endpoint, validation and failed construction do not prevent standalone', () => {
  assert.equal(resolvePlannerEndpoint('', { plannerBridgeEnabled: false }), '');
  assert.equal(resolvePlannerEndpoint('?planner=', {}), '');
  assert.equal(resolvePlannerEndpoint('?planner=ws://127.0.0.1:8765', {}), 'ws://127.0.0.1:8765/');
  assert.throws(() => resolvePlannerEndpoint('?planner=http://localhost', {}));
  const x = setup(); x.bridge.stop();
  const b = new PlannerBridge(x.mux, { endpoint: '', socketFactory: () => { throw Error(); } }); b.start(); assert.equal(b.running, false);
  assert.throws(() => new PlannerBridge(x.mux, { stateRateHz: 240 }));
});
test('publisher and recorder ON/OFF preserve identical ideal plant states and step counts', () => {
  function run(observe) {
    const b = createPlant(); b.setActuatorMode('ideal');
    const source = new SimulationStateSource(b, b.wf), recorder = new ExperimentRecorder(); recorder.start('regression');
    const x = setup(); let steps = 0; const step = b._step.bind(b); b._step = dt => { steps++; step(dt); };
    for (let i = 0; i < 600; i++) {
      b.setControls(.55, i > 120 ? .3 : 0); b.wf.time += 1 / 60; b.update(1 / 60);
      if (observe) { const s = source.update(); x.time(i / 60); x.bridge.update(s); recorder.update(s); }
    }
    return { pos: b.pos.toArray(), q: b.quat.toArray(), v: b.vel.toArray(), w: b.angVelB.toArray(), steps };
  }
  assert.deepEqual(run(true), run(false));
});
