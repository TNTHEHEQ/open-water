import test from 'node:test';
import assert from 'node:assert/strict';
import { ObstacleManager } from '../site/js/scenario/obstacle-manager.js';
import { P8F_AR10, configureP8F, plannerToEnu, enuToPlanner, p8fObstacleSnapshot, p8fActualClearance } from '../site/js/scenario/p8f-ar10-crossing.js';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-11, a + ' != ' + b);
const state = (heading = .002732098823446956) => ({
  timestamp: 19.2, pose: { position: { x: 1.4568078218668974, y: 24.081244237312283 }, headingRad: heading },
});
test('AR10 point and velocity roundtrip in cardinal and arbitrary actual episode frames', () => {
  for (const h of [0, .7, Math.PI / 2, Math.PI, -.5]) {
    const manager = new ObstacleManager(), s = state(h), frame = configureP8F(manager, s);
    const snap = p8fObstacleSnapshot(manager, s), o = snap.obstacles[0];
    const p = enuToPlanner(frame, o.position), v = enuToPlanner(frame, o.velocity, true);
    close(p.s, 50); close(p.l, -16.36108398930107); close(v.s, 0); close(v.l, 1);
    close(o.radius_m, 2.5); assert.equal(o.prediction_model, 'CONSTANT_VELOCITY');
    assert.equal(snap.simulation_time, s.timestamp); assert.ok(p.l < 0);
    s.timestamp += P8F_AR10.crossingTime;
    const crossing = p8fObstacleSnapshot(manager, s);
    close(enuToPlanner(frame, crossing.obstacles[0].position).l, 0);
  }
});
test('target advances by simulation time, retains identity and never inflates radius with buffer', () => {
  const m = new ObstacleManager(), s = state(), frame = configureP8F(m, s);
  const a = p8fObstacleSnapshot(m, s), b = p8fObstacleSnapshot(m, s);
  assert.deepEqual(a.obstacles, b.obstacles);
  s.timestamp += .02;
  const c = p8fObstacleSnapshot(m, s), delta = enuToPlanner(frame, c.obstacles[0].position).l - enuToPlanner(frame, a.obstacles[0].position).l;
  close(delta, .02); assert.equal(c.obstacles[0].id, a.obstacles[0].id);
  assert.equal(c.obstacles[0].radius_m, 2.5); assert.equal(P8F_AR10.plannerBuffer, .5);
});
test('episode reset is deterministic and H1 publishes empty truth using the same clock', () => {
  const m = new ObstacleManager(), s = state(), f1 = configureP8F(m, s);
  const a = m.snapshot(25);
  const f2 = configureP8F(m, state()); assert.deepEqual(f1, f2);
  assert.deepEqual(m.snapshot(25).obstacles, a.obstacles);
  configureP8F(m, state(), false); assert.deepEqual(m.snapshot(25).obstacles, []);
});
test('actual multi-circle audit is sampled, independent of planner, and uses radius and buffer once', () => {
  const s = state(), m = new ObstacleManager(), f = configureP8F(m, s);
  s.timestamp += P8F_AR10.crossingTime; s.pose.position = plannerToEnu(f, 50, 0);
  const a = p8fActualClearance(s, f);
  assert.equal(a.certification, 'ACTUAL_50HZ_SAMPLED_ONLY');
  close(a.minimum.raw, -Math.hypot(3.2 / 3, 1) - 2.5);
  close(a.minimum.raw - a.minimum.buffered, .5);
  close(a.bankMinimum.bankBuffered, 10 - Math.hypot(3.2 / 3, 1) - .5);
});
