import { parsePlannerMessage, PROTOCOL_VERSION } from './protocol.js';
import { validateObstacleState } from './visual-protocol.js';
import { validateVesselState } from '../twin/vessel-state.js';

export function resolvePlannerEndpoint(search, config) {
  const params = new URLSearchParams(search);
  const endpoint = params.has('planner') ? params.get('planner') : config.plannerBridgeEnabled ? config.plannerUrl : '';
  if (!endpoint) return '';
  const url = new URL(endpoint);
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new TypeError('Planner endpoint must use ws/wss');
  return url.href;
}

export class PlannerBridge {
  constructor(mux, { endpoint = '', stateRateHz = 50, maxBufferedBytes = 65536,
    visualizationOnly = false, onPlan = () => {}, obstacleSource = null,
    now = () => performance.now() / 1000, socketFactory = url => new WebSocket(url) } = {}) {
    if (!(Number.isFinite(stateRateHz) && stateRateHz >= 10 && stateRateHz <= 100)
      || !(Number.isFinite(maxBufferedBytes) && maxBufferedBytes > 0)) throw new RangeError('Invalid bridge budget');
    this.visualizationOnly = visualizationOnly; this.onPlan = onPlan; this.obstacleSource = obstacleSource;
    this.lastPlanSequence = -1; this.minimumSourceSequence = 0;
    this.mux = mux; this.endpoint = endpoint; this.now = now; this.socketFactory = socketFactory;
    this.period = 1 / stateRateHz; this.maxBufferedBytes = maxBufferedBytes;
    this.socket = null; this.running = false; this.claimed = false;
    this.reconnectAt = Infinity; this.retryDelay = 1; this.nextPublish = 0;
    this.diagnostics = { connected: false, controlMode: 'MANUAL', lastCommandSequence: -1,
      lastCommandAgeMs: null, stateSequence: 0, messagesReceived: 0, messagesSent: 0,
      obstacleSequence: -1, planId: '-', planStatus: 'NONE', planSourceTime: null, planReceivedTime: null,
      planPoints: 0, planSolveTime: null, blockedControlMessages: 0,
      invalidMessages: 0, droppedStateMessages: 0, failsafe: false };
  }
  start() { if (this.running || !this.endpoint) return; this.running = true; this.connect(); }
  stop() {
    this.running = false; this.reconnectAt = Infinity;
    const socket = this.socket; this.socket = null;
    this.disconnected(); socket?.close();
  }
  disconnected() {
    this.diagnostics.connected = false; this.claimed = false;
    this.mux.external.invalidate(); this.mux.apply(this.now());
    this.execution?.disconnected();
    this.refreshDiagnostics();
  }
  connect() {
    if (!this.running) return;
    let socket;
    try { socket = this.socketFactory(this.endpoint); }
    catch { this.scheduleReconnect(); return; }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket || !this.running) return;
      this.diagnostics.connected = true; this.diagnostics.lastCommandSequence = -1;
      this.claimed = false; this.mux.external.invalidate(); this.lastPlanSequence = -1;
      this.reconnectAt = Infinity; this.nextPublish = this.now();
      this.send({ protocol_version: PROTOCOL_VERSION, type: 'hello', role: 'openwater_plant', vessel_id: 'usv001' });
      this.execution?.connected();
    };
    socket.onmessage = event => {
      if (this.socket === socket && this.running && this.diagnostics.connected && socket.readyState === 1) this.receive(event.data);
    };
    socket.onerror = () => { if (this.socket === socket) { this.disconnected(); socket.close(); } };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null; this.disconnected(); this.scheduleReconnect();
    };
  }
  scheduleReconnect() {
    if (!this.running) return;
    this.reconnectAt = this.now() + this.retryDelay; this.retryDelay = 2;
  }
  receive(text) {
    const d = this.diagnostics; d.messagesReceived++;
    try {
      const m = parsePlannerMessage(text);
      if (m.type === 'planned_trajectory') {
        if (m.sequence <= this.lastPlanSequence || m.source_state_sequence < this.minimumSourceSequence) throw new RangeError('Stale plan');
        this.lastPlanSequence = m.sequence;
        d.planId = m.plan_id; d.planStatus = m.status; d.planSourceTime = m.source_simulation_time;
        d.planReceivedTime = this.simulationTime; d.planPoints = m.points.length;
        d.planSolveTime = m.diagnostics?.solve_time_sec ?? null;
        this.onPlan(m); return;
      }
      if (m.type === 'execution_status' && this.execution) { this.execution.receive(m); return; }
      if (this.execution && !this.execution.allowControl(m)) throw new RangeError('No P6B execution request');
      if (this.visualizationOnly) { d.blockedControlMessages++; throw new RangeError('P6A visual-only authority'); }
      if (m.type === 'set_control_mode') {
        this.mux.setMode(m.mode); this.claimed = m.mode === 'EXTERNAL';
      } else {
        if (!this.claimed || m.sequence <= d.lastCommandSequence) throw new RangeError('Unowned or stale command');
        this.mux.external.receive(m.propulsion_command, m.steering_angle_rad, this.now());
        d.lastCommandSequence = m.sequence;
        this.lastSenderTimestamp = m.timestamp;
      }
      this.mux.apply(this.now());
      this.execution?.onControl();
    } catch { d.invalidMessages++; }
    this.refreshDiagnostics();
  }
  refreshDiagnostics() {
    const d = this.diagnostics, age = this.mux.external.age(this.now());
    d.controlMode = this.mux.mode; d.failsafe = this.mux.failsafe;
    d.lastCommandAgeMs = age === null ? null : age * 1000;
    return d;
  }
  send(message) {
    if (this.socket?.readyState !== 1) return false;
    try { this.socket.send(JSON.stringify(message)); this.diagnostics.messagesSent++; return true; }
    catch { this.disconnected(); this.socket?.close(); return false; }
  }
  invalidatePlans() {
    this.minimumSourceSequence = this.diagnostics.stateSequence;
    this.diagnostics.planStatus = 'INVALIDATED';
    this.diagnostics.planId = '-'; this.diagnostics.planPoints = 0;
    this.diagnostics.planSourceTime = null; this.diagnostics.planReceivedTime = null; this.diagnostics.planSolveTime = null;
    // A new hello explicitly clears the server session/snapshot. No silent reset.
    const restart = this.running; this.stop(); if (restart) this.start();
  }
  update(state) {
    this.simulationTime = state.timestamp;
    const now = this.now();
    if (this.running && !this.socket && now >= this.reconnectAt) this.connect();
    this.refreshDiagnostics();
    if (!this.diagnostics.connected || now + 1e-9 < this.nextPublish) return;
    // Drop missed slots; never serialize multiple copies of the same frame to catch up.
    this.nextPublish += (Math.floor(Math.max(0, now - this.nextPublish) / this.period) + 1) * this.period;
    if (this.socket.bufferedAmount > this.maxBufferedBytes) { this.diagnostics.droppedStateMessages++; return; }
    try { validateVesselState(state); } catch { this.diagnostics.droppedStateMessages++; return; }
    // send() serializes synchronously; no deep clone or queue of mutable snapshots.
    this.send({ protocol_version: PROTOCOL_VERSION, type: 'simulation_state',
      sequence: this.diagnostics.stateSequence++, simulation_time: state.timestamp, state });
    if (this.obstacleSource) {
      try {
        const obstacles = this.obstacleSource(state.timestamp); validateObstacleState(obstacles);
        if (this.socket?.bufferedAmount <= this.maxBufferedBytes && this.send(obstacles)) this.diagnostics.obstacleSequence = obstacles.sequence;
      } catch { this.diagnostics.droppedStateMessages++; }
    }
  }
}
