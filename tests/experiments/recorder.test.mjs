import test from 'node:test';
import assert from 'node:assert/strict';
import { ExperimentRecorder } from '../../site/js/experiments/experiment-recorder.js';
import { CSV_COLUMNS } from '../../site/js/experiments/csv-export.js';
import { createVesselState } from '../../site/js/twin/vessel-state.js';
test('recorder samples simulation time, finite ENU values, snapshots rows without retaining state', () => {
  const r = new ExperimentRecorder(), s = createVesselState(); r.start('turning'); s.pose.position = { x: 12, y: 34, z: 5 };
  for (let i = 0; i < 1000; i++) { s.timestamp = i / 1000; r.update(s); }
  assert.equal(r.rows.length, 50); s.pose.position.x = 900; assert.equal(r.rows[0][1], 12);
  const csv = r.getCsv().trim().split('\n'); assert.equal(csv[0], CSV_COLUMNS.join(',')); assert.equal(csv.length, 51);
  for (let i = 1; i < csv.length; i++) { const row = csv[i].split(',').map(Number); assert.equal(row.length, 35); assert.ok(row.every(Number.isFinite)); if (i > 1) assert.ok(row[0] > Number(csv[i - 1].split(',')[0])); }
  r.stop(); s.timestamp = 2; r.update(s); assert.equal(r.rows.length, 50); r.clear(); assert.equal(r.rows.length, 0);
});
test('slow frames skip slots, duplicate/paused times add no samples; memory limit stops recording', () => {
  const r = new ExperimentRecorder({ maxSamples: 3 }), s = createVesselState(); r.start(); r.update(s); r.update(s);
  s.timestamp = .1; r.update(s); assert.equal(r.skippedSlots, 4); assert.equal(r.rows.length, 2);
  s.timestamp = .2; r.update(s); assert.equal(r.recording, false); assert.equal(r.limitReached, true);
});
test('recorder rejects invalid/backward samples, never changes input; new recording starts new timeline', () => {
  const r = new ExperimentRecorder(), s = createVesselState(); r.start('unsafe/name'); assert.equal(r.name, 'unsafe_name');
  s.timestamp = 2; const before = JSON.stringify(s); r.update(s); assert.equal(JSON.stringify(s), before);
  s.timestamp = 1; r.update(s); s.timestamp = 3; s.actuator.rawThrustN = Infinity; r.update(s);
  assert.equal(r.invalidSamples, 2); assert.equal(r.rows.length, 1);
  assert.throws(() => new ExperimentRecorder({ sampleRateHz: 0 }));
});
