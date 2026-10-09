import { validateControlCommand } from '../bridge/protocol.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = values => values.every(Number.isFinite);

// The only normal external-command write to Boat is applyPhysicalTick().
// Receive/coalescing, ownership changes and plan switches never advance history.
export class PhysicalCommandApplicationLimiter {
  constructor(sink, { maxThrustForwardN, initialThrustN, initialSteeringRad, initialPhysicalTime,
    episodeId = 1, generation = 1, timeoutSec = 0.5 } = {}) {
    if (!finite([maxThrustForwardN, initialThrustN, initialSteeringRad, initialPhysicalTime, timeoutSec])
      || maxThrustForwardN <= 0 || timeoutSec <= 0 || initialThrustN < 0 || initialThrustN > 200 + 1e-8
      || Math.abs(initialSteeringRad) > Math.PI / 6 + 1e-8) throw Error('INVALID_PHYSICAL_SEED');
    this.sink = sink; this.forwardN = maxThrustForwardN; this.timeoutSec = timeoutSec;
    this.applied = { Tc: initialThrustN, delta: initialSteeringRad };
    this.lastPhysicalTime = initialPhysicalTime;
    this.target = { ...this.applied }; this.reference = { ...this.applied };
    this.episodeId = episodeId; this.generation = generation; this.lastSequence = -1;
    this.lastTimestamp = -Infinity; this.receiptWallSec = null;
    this.received = 0; this.firstSequence = null; this.lastReceivedSequence = null;
  }
  // Called only for a trusted execution INVALIDATE lifecycle event.
  setIdentity(episodeId, generation) {
    if (!Number.isSafeInteger(episodeId) || !Number.isSafeInteger(generation)
      || episodeId !== this.episodeId || generation !== this.generation + 1) throw Error('INVALID_LIFECYCLE_IDENTITY');
    // Authorization advances; the last real receipt and its original timeout
    // deadline remain valid. Only explicit authority loss cancels freshness.
    this.generation = generation;
  }
  invalidate() { this.receiptWallSec = null; }
  age(now) { return this.receiptWallSec === null ? null : Math.max(0, now - this.receiptWallSec); }
  isFresh(now) { return this.receiptWallSec !== null && this.age(now) <= this.timeoutSec; }
  receive(envelope, { wallTime, physicalTime }) {
    if (envelope?.protocol_version !== 1 || envelope.type !== 'physical_command_target'
      || !Number.isSafeInteger(envelope.episode_id) || !Number.isSafeInteger(envelope.generation)
      || !finite([wallTime, physicalTime, envelope.reference_command?.Tc, envelope.reference_command?.delta])) throw Error('INVALID_TARGET_ENVELOPE');
    validateControlCommand(envelope.command);
    const command = envelope.command;
    if (envelope.episode_id !== this.episodeId || envelope.generation !== this.generation) return { accepted: false, reason: 'EPISODE_GENERATION_MISMATCH' };
    if (command.sequence <= this.lastSequence) return { accepted: false, reason: 'STALE_SEQUENCE' };
    if (command.timestamp < this.lastTimestamp || command.timestamp > physicalTime + 1e-8) return { accepted: false, reason: 'INVALID_SENDER_TIMESTAMP' };
    if (physicalTime - command.timestamp > this.timeoutSec + 1e-8) return { accepted: false, reason: 'STALE_COMMAND_AGE' };
    this.target = { Tc: clamp(command.propulsion_command * this.forwardN, 0, 200), delta: clamp(command.steering_angle_rad, -Math.PI / 6, Math.PI / 6) };
    this.reference = { ...envelope.reference_command };
    this.lastSequence = command.sequence; this.lastTimestamp = command.timestamp; this.receiptWallSec = wallTime;
    if (this.received === 0) this.firstSequence = command.sequence;
    this.received++; this.lastReceivedSequence = command.sequence;
    return { accepted: true, target: { ...this.target } };
  }
  applyPhysicalTick({ dt, physicalTime, wallTime }) {
    if (!finite([dt, physicalTime, wallTime]) || dt <= 0 || physicalTime <= this.lastPhysicalTime
      || Math.abs(physicalTime - this.lastPhysicalTime - dt) > 1e-8) throw Error('DUPLICATE_OR_INVALID_PHYSICAL_TICK');
    if (!this.isFresh(wallTime)) throw Error('COMMAND_TIMEOUT_FAILSAFE');
    const previous = { ...this.applied };
    const applied = { Tc: clamp(this.target.Tc, previous.Tc - 20 * dt, previous.Tc + 20 * dt),
      delta: clamp(this.target.delta, previous.delta - 0.15 * dt, previous.delta + 0.15 * dt) };
    const command = { propulsionCommand: applied.Tc / this.forwardN, steeringAngleRad: applied.delta };
    this.sink.setActuatorCommands(command);
    this.applied = applied; this.lastPhysicalTime = physicalTime;
    const log = { physical_time: physicalTime, physical_dt: dt, episode_id: this.episodeId, generation: this.generation,
      reference_Tc: this.reference.Tc, reference_delta: this.reference.delta,
      target_Tc: this.target.Tc, target_delta: this.target.delta, applied_Tc: applied.Tc, applied_delta: applied.delta,
      previous_applied_Tc: previous.Tc, previous_applied_delta: previous.delta,
      target_minus_applied_Tc: this.target.Tc - applied.Tc, target_minus_applied_delta: this.target.delta - applied.delta,
      applied_Tc_rate: (applied.Tc - previous.Tc) / dt, applied_delta_rate: (applied.delta - previous.delta) / dt,
      commands_received_this_tick: this.received, received_command_count: this.received,
      first_sequence: this.firstSequence, last_sequence: this.lastReceivedSequence,
      coalesced_count: Math.max(0, this.received - 1), latest_target: { ...this.target }, latest_accepted_sequence: this.lastSequence };
    this.received = 0; this.firstSequence = null; this.lastReceivedSequence = null;
    return log;
  }
}
