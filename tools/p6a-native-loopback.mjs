import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createVesselState } from '../site/js/twin/vessel-state.js';
import { parsePlannerMessage } from '../site/js/bridge/protocol.js';
const native = '/home/zy/work/all-in-planner/build/p5b-linux/cpp/lifted_stp/openwater/lifted_stp_openwater_server';
const child = spawn('wsl.exe', ['-d', 'Ubuntu-22.04', '-u', 'zy', '--', 'env',
  'LD_LIBRARY_PATH=/home/zy/.local/casadi-3.8.1-gcc/lib', 'OPENBLAS_NUM_THREADS=1', 'OMP_NUM_THREADS=1',
  native, '8767', '/home/zy/work/all-in-planner/build/p6a-loopback-records'], { cwd: tmpdir() });
let output = '', socket, publish, timeout;
const start = performance.now(), messages = [];
try {
  await new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(Error('Native listen timeout')), 30000);
    child.stdout.on('data', d => { output += d; if (output.includes('P6A LISTEN')) resolve(); });
    child.stderr.on('data', d => { output += d; });
    child.on('error', reject);
  });
  clearTimeout(timeout);
  // WSL loopback forwarding can register shortly after native bind/listen.
  for (let attempt = 0; attempt < 30; attempt++) {
    socket = new WebSocket('ws://127.0.0.1:8767');
    try { await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); }); break; }
    catch (e) { if (attempt === 29) throw e; await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  const next = () => new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(Error('Plan timeout')), 180000);
    socket.once('message', bytes => { clearTimeout(timeout); const m = parsePlannerMessage(bytes.toString());
      messages.push({ bytes: bytes.length, message: m }); resolve(m); });
  });
  socket.send(JSON.stringify({ protocol_version: 1, type: 'hello', role: 'openwater_plant', vessel_id: 'usv001' }));
  await new Promise(resolve => setTimeout(resolve, 100));
  let waiting = next(); child.stdin.write('PLAN_ONCE\n');
  assert.equal((await waiting).status, 'STALE_INPUT');
  const state = createVesselState(); state.pose.position.x = 12; state.pose.position.y = 5;
  state.velocity.body.surge = 2; state.timestamp = 10; let sequence = 0;
  publish = setInterval(() => {
    state.sequence = sequence;
    socket.send(JSON.stringify({ protocol_version: 1, type: 'simulation_state', sequence, simulation_time: 10, state }));
    socket.send(JSON.stringify({ protocol_version: 1, type: 'obstacle_state', sequence: sequence++, simulation_time: 10,
      obstacles: [{ id: 'one', position: { x: 19, y: 40 }, velocity: { x: -.1, y: 0 }, radius_m: 1.5, prediction_model: 'CONSTANT_VELOCITY' }] }));
  }, 20);
  await new Promise(resolve => setTimeout(resolve, 200));
  waiting = next(); child.stdin.write('PLAN_ONCE\n');
  const plan = await waiting;
  assert.equal(plan.status, 'SUCCESS'); assert.equal(plan.points.length, 81);
  assert.ok(Math.abs(plan.points[0].x - 12) < 1e-8 && Math.abs(plan.points[0].y - 5) < 1e-8);
  assert.ok(messages.every(x => x.message.type === 'planned_trajectory'));
  clearInterval(publish); socket.close();
  const report = { status: 'PASS', windowsClient: process.platform, server: 'WSL Ubuntu-22.04 native C++',
    hello: true, simulationState: true, obstacleState: true, staleInputDetected: true, noControlMessage: true,
    messages, totalSeconds: (performance.now() - start) / 1000 };
  fs.mkdirSync('results/p6a', { recursive: true });
  fs.writeFileSync('results/p6a/native-loopback.json', JSON.stringify(report, null, 2));
  console.log('PASS native loopback:', plan.points.length, 'points,', plan.diagnostics.solve_time_sec, 'seconds');
} finally {
  clearTimeout(timeout); clearInterval(publish); socket?.close(); child.stdin.end('QUIT\n');
}