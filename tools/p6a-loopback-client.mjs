import WebSocket from 'ws';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createVesselState } from '../site/js/twin/vessel-state.js';
import { parsePlannerMessage } from '../site/js/bridge/protocol.js';
const socket = new WebSocket('ws://127.0.0.1:8765');
let sequence = 0, interval;
const state = createVesselState(); state.pose.position.x = 12; state.pose.position.y = 5;
state.velocity.body.surge = 2;
const timeout = setTimeout(() => { console.error('Timeout'); process.exit(1); }, 180000);
socket.on('open', () => {
  socket.send(JSON.stringify({ protocol_version: 1, type: 'hello', role: 'openwater_plant', vessel_id: 'usv001' }));
  interval = setInterval(() => {
    state.sequence = sequence; state.timestamp = 10;
    socket.send(JSON.stringify({ protocol_version: 1, type: 'simulation_state', sequence, simulation_time: 10, state }));
    socket.send(JSON.stringify({ protocol_version: 1, type: 'obstacle_state', sequence: sequence++, simulation_time: 10,
      obstacles: [{ id: 'one', position: { x: 19, y: 40 }, velocity: { x: -.1, y: 0 }, radius_m: 1.5, prediction_model: 'CONSTANT_VELOCITY' }] }));
  }, 20);
  console.log('READY: manually issue PLAN_ONCE in C++ server');
});
socket.on('message', bytes => {
  const m = parsePlannerMessage(bytes.toString());
  assert.equal(m.type, 'planned_trajectory'); assert.equal(m.status, 'SUCCESS');
  assert.ok(Math.abs(m.points[0].x - 12) < 1e-8); assert.ok(Math.abs(m.points[0].y - 5) < 1e-8);
  fs.mkdirSync('results/p6a', { recursive: true });
  fs.writeFileSync('results/p6a/loopback.json', JSON.stringify({ message: m, bytes: bytes.length, messagesSent: sequence,
    windowsClient: process.platform, manualTrigger: true, noControlMessages: true }, null, 2));
  console.log('PASS real C++ plan', m.points.length, bytes.length, m.diagnostics);
  clearInterval(interval); clearTimeout(timeout); socket.close();
});