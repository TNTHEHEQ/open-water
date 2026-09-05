# USV-0 upstream baseline

- Repository: https://github.com/bob6664569/open-water
- Commit: `285b6ce32057c70191a7fe16c31d979fa383ac64`
- Commit date: 2026-07-14T13:57:34+02:00
- Source: MIT, Copyright (c) 2026 bob6664569. Media have separate licenses.
- Local project: `C:/Users/49566/Desktop/OpenWater-USV` (full clone, not a source snapshot).
- Fork: https://github.com/TNTHEHEQ/open-water
- `origin`: fork; `upstream`: original; branch `codex/usv-single-vessel-baseline`.
- Git 2.52.0.windows.1, Node v24.12.0, npm 11.6.2.

## Original tests

`npm ci` succeeded. `npm test`: **184 passed, 0 failed**.
`npm run check`: lint and tests passed; coverage command failed with upstream
line coverage **28.29% < 60%** and function coverage **33.25% < 50%**.
Coverage run: 182 passed, 2 intentionally skipped integration cases.
No coverage thresholds were lowered in USV-0.
Installation reported 2 high-severity development dependency advisories;
dependency versions were not changed during this scope reduction.

Logs: ignored `artifacts/dt1/baseline-check.txt` and `baseline-benchmark.json`.
These were captured on the same pristine commit before the earlier DT-1 attempt.
That uncommitted attempt was paused in a named Git stash before USV-0; none of
its TwinRuntime, state sources or physics/visual extraction is in this branch.

## Original browser

Original page loaded successfully on localhost. Started the voyage, observed
Smolbot moving with visible ocean, waves and wake; used upstream's keyboard
unlock sequence and boat selector to load Zodiac (catalog position 09/09).
Zodiac GLB, original rig, camera and wake rendered successfully.
Screenshots: `artifacts/dt1/baseline.png`, `artifacts/dt1/upstream-zodiac.png`.
An initial WebGL shader compilation warning on this Windows driver was observed:
`X3595: gradient instruction used in a loop with varying iteration; partial
derivatives may have undefined value`. No original application exception observed.

## Original deterministic fixtures

`tools/usv0-regression.mjs --record` ran BEFORE USV-0 changes. Fixture:
`tests/fixtures/usv0-regression.json`. Zodiac; seed 987654321; each sea preset
settled for 30 s; 30 s measured run; 60 Hz frame, 240 Hz physics, real WakeField
feedback enabled. Controls: 0–5 s neutral, 5–20 s throttle 0.8, 10–16.667 s
steering 0.4, 20–30 s throttle -0.3. Sample every 5 s.

Captured position, quaternion, linear/angular velocity, actual planing-force
accumulator contribution, wave height and wake count. The test-only planing
observer wraps the existing accumulator's `add`; it does not alter forces.
WaveField, Boat, all physics sheets and wake implementations are unchanged.

## Benchmark comparison

Full upstream benchmark, 30 batches × 2,000 iterations; median nanoseconds/op:

| Case | Before | USV-0 after | Difference |
|---|---:|---:|---:|
| waves.sampleSurface | 2710.20 | 2800.45 | +3.33% |
| waves.updateSpectrum | 638.55 | 594.25 | -6.94% |

Both checksums match exactly. No >15% regression. This benchmark measures wave
CPU hot paths, not total GPU load or startup memory. Concurrent desktop load
affects timings. Original browser memory/startup metrics were not instrumented;
no percentage improvement is claimed for those metrics.
