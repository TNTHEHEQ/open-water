import test from 'node:test';
import assert from 'node:assert/strict';
import { KinematicCrossingTarget } from '../site/js/integration/kinematic-crossing-target.js';
const contract = { scenario: 'H2_DYNAMIC_CROSSING', prediction_model: 'CONSTANT_VELOCITY',
  s_conflict_m: 25, t_conflict_episode_sec: 11.4, target_velocity_planner_mps: [0, 1], target_radius_m: 2.5,
  collision_buffer_m: .5, target_id: 'one', ownship_footprint: [{ x: -2, y: 0, radius: 1.4 }, { x: 0, y: 0, radius: 1.4 }, { x: 2, y: 0, radius: 1.4 }] };
const frame = { E_ref: 12, N_ref: 35, H_ref: .7 };
test('truth uses episode time and ENU velocity with exact paired physical timestamp', () => {
  const source = new KinematicCrossingTarget(contract, frame, 19.2);
  const a = source.truth(19.2), b = source.truth(19.22), crossing = source.truth(30.6);
  assert.ok(Math.abs(crossing.l_world) < 1e-12);assert.equal(a.episode_time, 0);
  for (const axis of ['x', 'y']) assert.ok(Math.abs(b.obstacle.position[axis] - a.obstacle.position[axis] - .02 * a.obstacle.velocity[axis]) < 1e-12);
  assert.deepEqual(source.truth(19.2), a);assert.equal(b.simulation_time, 19.22);
});
test('actual safety uses all heading-dependent body circles and same target at physical time', () => {
  const source = new KinematicCrossingTarget(contract, frame, 19.2);
  const margin = source.actualClearance({ s_world: 23, l_world: 0, psi: 0 }, 30.6);
  assert.ok(Math.abs(margin + 4.4) < 1e-12);
  assert.ok(source.actualClearance({ s_world: 25, l_world: 6, psi: 0 }, 30.6) > 0);
  assert.ok(source.actualClearance({ s_world: 25, l_world: 6, psi: Math.PI / 2 }, 30.6) < 0);
});
