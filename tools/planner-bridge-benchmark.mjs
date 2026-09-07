import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { validateVesselState, snapshotVesselState } from '../site/js/twin/vessel-state.js';
const path = process.argv[2] ?? 'artifacts/p0b/suite/telemetry.json';
const messages = JSON.parse(readFileSync(path)), message = messages[Math.floor(messages.length / 2)];
let checksum = 0;
function measure(fn) {
  const samples = [];
  for (let i = 0; i < 1000; i++) checksum += fn();
  for (let batch = 0; batch < 9; batch++) {
    const start = performance.now(); for (let i = 0; i < 3000; i++) checksum += fn();
    samples.push((performance.now() - start) * 1000 / 3000);
  }
  return samples.sort((a, b) => a - b)[4];
}
const report = { typicalBytes: Buffer.byteLength(JSON.stringify(message)),
  serializationMedianUs: measure(() => JSON.stringify(message).length),
  validateAndSerializeMedianUs: measure(() => { validateVesselState(message.state); return JSON.stringify(message).length; }),
  explicitSnapshotAndSerializeMedianUs: measure(() => JSON.stringify({ ...message, state: snapshotVesselState(message.state) }).length), checksum };
mkdirSync('artifacts/p0b', { recursive: true });
writeFileSync('artifacts/p0b/performance.json', JSON.stringify(report, null, 2)); console.log(report);
