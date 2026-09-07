// External test substitute, NOT a planner/controller. Run on loopback only.
import { WebSocketServer } from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { validateVesselState } from '../site/js/twin/vessel-state.js';
import { validateControlCommand } from '../site/js/bridge/protocol.js';
import { summarizeSmoke } from './planner-smoke-summary.mjs';
const args = process.argv.slice(2), option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const experiment = option('--experiment', 'steering-step');
if (!['steering-step', 'propulsion-step', 'turning', 'suite'].includes(experiment)) throw Error('Unknown experiment');
const port = Number(option('--port', '8765'));
const out = `artifacts/p0b/${experiment}`;
mkdirSync(out, { recursive: true });
const wss = new WebSocketServer({ host: '127.0.0.1', port, maxPayload: 32768 });
const samples = [], events = []; let firstTime, latest, sequence = 0, completed = false, disconnected = false, connections = 0;
const end = experiment === 'steering-step' ? 6 : experiment === 'propulsion-step' ? 8 : experiment === 'turning' ? 90 : 110;
function writeSummary() {
  writeFileSync(`${out}/telemetry.json`, JSON.stringify(samples));
  const report = { experiment, connections, ...summarizeSmoke(samples, experiment), events };
  writeFileSync(`${out}/summary.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
wss.on('connection', socket => {
  connections++; events.push({ event: 'connected', connection: connections, simulationTime: latest?.timestamp ?? null });
  let txTimer;
  const send = m => { if (socket.readyState === 1) socket.send(JSON.stringify({ protocol_version: 1, ...m })); };
  const claim = () => send({ type: 'set_control_mode', mode: 'EXTERNAL' });
  socket.on('message', data => {
    try {
      const m = JSON.parse(data.toString()); if (m.protocol_version !== 1) throw Error('version');
      if (m.type === 'hello') { claim(); return; }
      if (m.type !== 'simulation_state' || !Number.isSafeInteger(m.sequence) || m.simulation_time !== m.state.timestamp) throw Error('wrapper');
      validateVesselState(m.state); latest = m.state; firstTime ??= latest.timestamp;
      if (!completed) samples.push(m);
      const t = latest.timestamp - firstTime;
      if (experiment === 'suite' && t >= 106 && !disconnected) {
        disconnected = true; events.push({ event: 'disconnect', simulationTime: latest.timestamp }); socket.close();
      }
      if (t >= end && !completed) { completed = true; writeSummary(); }
    } catch (error) { console.error('Invalid telemetry:', error.message); }
  });
  txTimer = setInterval(() => {
    if (!latest) return;
    const t = latest.timestamp - firstTime;
    let prop = 0, steer = 0;
    if (experiment === 'suite') {
      if (t < 6) steer = t >= 1 ? Math.PI / 18 : 0;
      else if (t < 14) prop = t < 7 ? .2 : .8;
      else if (t < 104) { prop = .55; steer = t >= 34 ? Math.PI / 18 : 0; }
      else if (t < 106) return; // connected, deliberately silent: timeout
      else if (t < 107.5) return; // fresh connection stays safe with no command
      else if (t < 109) { prop = .4; steer = -.1; }
    } else if (experiment === 'steering-step') steer = t >= 1 ? Math.PI / 18 : 0;
    else if (experiment === 'propulsion-step') prop = t < 1 ? .2 : .8;
    else { prop = .55; steer = t >= 20 ? Math.PI / 18 : 0; }
    if (completed) { prop = 0; steer = 0; }
    const message = { protocol_version: 1, type: 'control_command', sequence: sequence++, timestamp: performance.now() / 1000,
      propulsion_command: prop, steering_angle_rad: steer };
    validateControlCommand(message); send(message);
  }, 25);
  socket.on('close', () => clearInterval(txTimer));
  socket.on('error', error => console.error(error.message));
});
console.log(`Planner smoke ${experiment}: ws://127.0.0.1:${port}; browser ?debug&planner=ws://127.0.0.1:${port}`);
process.on('SIGINT', () => { if (!completed) writeSummary(); for (const socket of wss.clients) socket.close(); wss.close(() => process.exit()); });
