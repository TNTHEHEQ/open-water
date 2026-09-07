import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandMux } from '../../site/js/control/command-authority.js';
import { DriveController } from '../../site/js/controllers/drive-controller.js';
import { createPlant, DT } from '../../tools/p0a-common.mjs';
test('manual keys/touch/auto pass mux; EXTERNAL commands cannot be overwritten; return MANUAL works', () => {
  const b = createPlant(), mux = new CommandMux(b, { maxSteerRad: b.spec.maxSteerRad });
  const drive = new DriveController(mux); drive.press('KeyW'); drive.press('KeyD');
  drive.update(.2, 0, { active: false }); mux.apply(0);
  assert.ok(b.outboardActuator.propulsionCommand > 0); assert.ok(b.outboardActuator.steeringCommandRad > 0);
  mux.setMode('EXTERNAL'); mux.external.receive(.55, -.1, 0);
  drive.update(.2, 0, { active: true, throttle: -1, steer: 1 }); mux.apply(.1);
  assert.equal(b.outboardActuator.propulsionCommand, .55); assert.equal(b.outboardActuator.steeringCommandRad, -.1);
  drive.isAuto = () => true; drive.update(.1, 10, { active: false }); mux.apply(.2);
  assert.equal(b.outboardActuator.propulsionCommand, .55);
  mux.setMode('MANUAL'); mux.apply(.3); assert.equal(b.outboardActuator.propulsionCommand, 1);
});
test('monotonic timeout and disconnect neutralize commands without resetting actual actuator', () => {
  const b = createPlant(), mux = new CommandMux(b, { maxSteerRad: b.spec.maxSteerRad, externalCommandTimeoutSec: .5 });
  mux.setMode('EXTERNAL'); mux.external.receive(.8, .2, 100); mux.apply(100);
  for (let i = 0; i < 120; i++) b.outboardActuator.update(DT);
  const a = b.outboardActuator, before = a.actualPropulsion, steering = a.actualSteeringRad;
  mux.apply(100.5); assert.equal(mux.failsafe, false);
  mux.apply(100.501); assert.equal(mux.failsafe, true); assert.equal(a.propulsionCommand, 0); assert.equal(a.steeringCommandRad, 0);
  assert.equal(a.actualPropulsion, before); assert.equal(a.actualSteeringRad, steering);
  a.update(DT); assert.ok(a.actualPropulsion > 0 && a.actualPropulsion < before);
  mux.external.receive(.8, .2, 101); mux.apply(101); mux.external.invalidate(); mux.apply(101);
  assert.equal(a.propulsionCommand, 0); assert.ok(a.actualPropulsion > 0);
});
test('unclaimed, switching authority, invalid parameters and receipt values are safe', () => {
  const sink = { setActuatorCommands() {} }, mux = new CommandMux(sink, { maxSteerRad: .5 });
  assert.equal(mux.mode, 'MANUAL'); mux.external.receive(1, 1, 0); mux.setMode('EXTERNAL'); mux.apply(0);
  assert.equal(mux.failsafe, true); assert.throws(() => mux.setMode('LIVE'));
  assert.throws(() => mux.external.receive(NaN, 0, 0)); assert.throws(() => mux.setControls(0, NaN));
  assert.throws(() => new CommandMux(sink, { maxSteerRad: .5, externalCommandTimeoutSec: 0 }));
});
