import { MAX_TRAJECTORY_BYTES, validatePlannedTrajectory } from './visual-protocol.js';
export const PROTOCOL_VERSION = 1;
function fields(message, keys) {
  if (!message || Object.getPrototypeOf(message) !== Object.prototype
    || Object.keys(message).length !== keys.length || keys.some(k => !Object.hasOwn(message, k))) throw new TypeError('Unexpected message fields');
}
export function validateProtocolVersion(message) {
  if (message?.protocol_version !== PROTOCOL_VERSION) throw new RangeError('Unsupported protocol version');
  return true;
}
export function validateControlCommand(m) {
  validateProtocolVersion(m);
  fields(m, ['protocol_version', 'type', 'sequence', 'timestamp', 'propulsion_command', 'steering_angle_rad']);
  if (m.type !== 'control_command' || !Number.isSafeInteger(m.sequence) || m.sequence < 0
    || ![m.timestamp, m.propulsion_command, m.steering_angle_rad].every(Number.isFinite)) throw new TypeError('Invalid control command');
  return true;
}
export function validateControlMode(m) {
  validateProtocolVersion(m);
  fields(m, ['protocol_version', 'type', 'mode']);
  if (m.type !== 'set_control_mode' || !['MANUAL', 'EXTERNAL'].includes(m.mode)) throw new TypeError('Invalid control mode');
  return true;
}
export function parsePlannerMessage(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_TRAJECTORY_BYTES) throw new TypeError('JSON frame budget');
  const m = JSON.parse(text);
  if (m?.type === 'planned_trajectory') { validatePlannedTrajectory(m); return m; }
  if (new TextEncoder().encode(text).length > 4096) throw new TypeError('Expected small JSON text frame');
  if (m?.type === 'control_command') validateControlCommand(m);
  else if (m?.type === 'set_control_mode') validateControlMode(m);
  else throw new TypeError('Unsupported message type');
  return m;
}
