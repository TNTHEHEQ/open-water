import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { PlannerBridge } from '../../site/js/bridge/planner-bridge.js';
import { CommandMux } from '../../site/js/control/command-authority.js';
import { SimulationStateSource } from '../../site/js/twin/simulation-state-source.js';
import { createPlant } from '../../tools/p0a-common.mjs';
test('real loopback WebSocket completes command→actuator→6DOF→TwinState→server', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const b = createPlant(), mux = new CommandMux(b, { maxSteerRad: b.spec.maxSteerRad }), source = new SimulationStateSource(b, b.wf);
  const bridge = new PlannerBridge(mux, { endpoint: `ws://127.0.0.1:${server.address().port}`, socketFactory: url => new WebSocket(url) });
  const connected = once(server, 'connection'); bridge.start(); const [peer] = await connected;
  const send = m => peer.send(JSON.stringify({ protocol_version: 1, ...m }));
  try {
    if (!bridge.diagnostics.connected) await once(bridge.socket, 'open');
    send({ type: 'set_control_mode', mode: 'EXTERNAL' });
    send({ type: 'control_command', sequence: 0, timestamp: -1e6, propulsion_command: .55, steering_angle_rad: .174532925 });
    await new Promise(resolve => { setTimeout(resolve, 20); });
    assert.equal(mux.mode, 'EXTERNAL');
    for (let i = 0; i < 240; i++) { mux.apply(performance.now() / 1000); b.wf.time += 1 / 240; b.update(1 / 240); }
    assert.ok(b.outboardActuator.actualPropulsion > .4 && b.outboardActuator.actualPropulsion < .55);
    assert.ok(b.vel.length() > .1); assert.ok(b.angVelB.length() > 0);
    const received = new Promise(resolve => { peer.on('message', data => { const m = JSON.parse(data.toString()); if (m.type === 'simulation_state') resolve(m); }); });
    bridge.update(source.update()); const state = await received;
    assert.equal(state.state.actuator.propulsionActual, b.outboardActuator.actualPropulsion);
    assert.equal(state.simulation_time, b.wf.time);
    const closed = once(bridge.socket, 'close'); peer.close(); await closed;
    assert.equal(mux.failsafe, true); assert.equal(b.outboardActuator.propulsionCommand, 0); assert.ok(b.outboardActuator.actualPropulsion > 0);
  } finally { bridge.stop(); for (const client of server.clients) client.terminate(); await new Promise(resolve => { server.close(resolve); }); }
});
