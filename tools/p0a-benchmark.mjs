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
const actuator = new Boat(new WaveField(), new THREE.Scene()).outboardActuator;
actuator.setCommands(.8,.3);
for(let i=0;i<100000;i++) actuator.update(1/240);
const costs=[]; let actuatorChecksum=0;
for(let j=0;j<9;j++) {
  const start=performance.now();
  for(let i=0;i<500000;i++) { if(i%240===0)actuator.setCommands(i%480===0?.8:-.3,i%480===0?.3:-.2); actuator.update(1/240); actuatorChecksum+=actuator.actualPropulsion+actuator.actualSteeringRad; }
  costs.push((performance.now()-start)*1e6/500000);
}
const actuatorMedianNs=[...costs].sort((a,b)=>a-b)[4];
const base = execFileSync('git', ['show', '3759330:site/js/simulation/boat.js'], { encoding: 'utf8' })
  .replace(/from '(\.\.?\/[^']+)'/g, (_, path) => `from '${new URL(path, new URL('../site/js/simulation/boat.js', import.meta.url)).href}'`);
mkdirSync('artifacts/p0a', { recursive: true });
writeFileSync('artifacts/p0a/baseline-boat.mjs', base);
const { Boat: BeforeBoat } = await import('../artifacts/p0a/baseline-boat.mjs');
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
run(BeforeBoat, false); run(Boat, false);
const before = [], after = [];
for (let i = 0; i < 9; i++) {
  if (i % 2) { after.push(run(Boat, false)); before.push(run(BeforeBoat, false)); }
  else { before.push(run(BeforeBoat, false)); after.push(run(Boat, false)); }
}
const median = a => a.map(v => v.usPerFrame).sort((a, b) => a - b)[4];
console.log(JSON.stringify({ baseline: '3759330', actuatorMedianNs, actuatorChecksum, actuatorSamplesNs: costs, before, after,
  beforeMedianUs: median(before), afterMedianUs: median(after),
  differencePercent: (median(after) / median(before) - 1) * 100,
  note: 'CPU water+wake+240Hz plant per 60Hz frame; excludes GPU; after includes generic actuator and diagnostics; excludes state projection',
}, null, 2));
