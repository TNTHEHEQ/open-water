import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlannerMessage, validateControlCommand, validateControlMode, validateProtocolVersion } from '../../site/js/bridge/protocol.js';
const good = { protocol_version: 1, type: 'control_command', sequence: 2, timestamp: -500, propulsion_command: 2, steering_angle_rad: 1 };
test('wire commands are finite SI; saturation belongs to actuator; sender clock is opaque', () => {
  assert.equal(validateControlCommand(good), true);
  assert.deepEqual(parsePlannerMessage(JSON.stringify(good)), good);
});
test('wire rejects malformed, missing, extra state fields, nonfinite, bad sequence and wrong version', () => {
  for (const patch of [{ sequence: -1 }, { sequence: 1.1 }, { sequence: 1e20 }, { timestamp: NaN }, { propulsion_command: Infinity },
    { steering_angle_rad: '0.5' }, { protocol_version: 2 }, { x: 1 }, { type: 'reset' }]) {
    assert.throws(() => validateControlCommand({ ...good, ...patch }));
  }
  const missing = { ...good }; delete missing.sequence; assert.throws(() => validateControlCommand(missing));
  for (const value of ['{', 'null', '[]', '{}', 'x'.repeat(4097), JSON.stringify({ ...good, steering_angle_rad: null })]) assert.throws(() => parsePlannerMessage(value));
  assert.throws(() => validateProtocolVersion(null));
});
test('ownership is explicit and versioned', () => {
  for (const mode of ['MANUAL', 'EXTERNAL']) assert.equal(validateControlMode({ protocol_version: 1, type: 'set_control_mode', mode }), true);
  for (const mode of ['external', 'LIVE', null]) assert.throws(() => validateControlMode({ protocol_version: 1, type: 'set_control_mode', mode }));
});
