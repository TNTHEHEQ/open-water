// Interleaved same-process before/after measurement; temporary baseline stays ignored.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { WaveField } from '../site/js/simulation/waves.js';
import { WakeField } from '../site/js/simulation/wake-field.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
import { SimulationStateSource } from '../site/js/twin/simulation-state-source.js';
globalThis.window ??= { location: { search: '' } };
globalThis.matchMedia ??= () => ({ matches: false });
const { Boat } = await import('../site/js/simulation/boat.js');
const base = execFileSync('git', ['show', 'ee4698f:site/js/simulation/boat.js'], { encoding: 'utf8' })
  .replace(/from '(\.\.?\/[^']+)'/g, (_, path) => `from '${new URL(path, new URL('../site/js/simulation/boat.js', import.meta.url)).href}'`);
mkdirSync('artifacts/usv1', { recursive: true });
writeFileSync('artifacts/usv1/baseline-boat.mjs', base);
const { Boat: BeforeBoat } = await import('../artifacts/usv1/baseline-boat.mjs');
function run(Class, project) {
  const water = new WaveField(), wake = new WakeField(); water.setWakeField(wake);
  const boat = new Class(water, new THREE.Scene(), .37);
  boat.setSpec(VESSEL_SPECS.zodiac_boat); boat.reset(); boat.setControls(.8, .2);
  const source = project ? new SimulationStateSource(boat, water) : null;
  const start = performance.now();
  for (let i = 0; i < 3000; i++) {
    water.update(1 / 60, boat.pos.x, boat.pos.z); wake.update(1 / 60, boat, water);
    boat.update(1 / 60); source?.update();
  }
  return { usPerFrame: (performance.now() - start) * 1000 / 3000, position: boat.pos.toArray() };
}
run(BeforeBoat, false); run(Boat, true);
const before = [], after = [];
for (let i = 0; i < 9; i++) {
  if (i % 2) { after.push(run(Boat, true)); before.push(run(BeforeBoat, false)); }
  else { before.push(run(BeforeBoat, false)); after.push(run(Boat, true)); }
}
const median = a => a.map(v => v.usPerFrame).sort((a, b) => a - b)[4];
console.log(JSON.stringify({ baseline: 'ee4698f', before, after,
  beforeMedianUs: median(before), afterMedianUs: median(after),
  differencePercent: (median(after) / median(before) - 1) * 100,
  note: 'CPU water+wake+240Hz plant per 60Hz frame; excludes GPU; after includes TwinState projection',
}, null, 2));
