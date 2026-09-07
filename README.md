# USV Open Water Simulator

A single-vessel marine simulation and digital-twin foundation based on
[bob6664569/open-water](https://github.com/bob6664569/open-water).

Phase **P0-A** runs one Zodiac RIB with a single centerline outboard visual
and a one-way SI/ENU Twin State v1 observer. A 240 Hz actuator adds lag,
saturation and rate limits before the original Open Water force model.
Ocean, wind, current, waves, wake, spray, weather, audio and cameras remain.
No boat selection,
achievements, unlocks, missions, birds, fish or other wildlife run or download.
LIVE/REPLAY, Qt, network telemetry and renderer decoupling are deferred.

## Run

No build step. Requires a WebGL2 browser. From the repository root:

```sh
python -m http.server 8089 --bind 127.0.0.1 --directory site
```

Open http://127.0.0.1:8089/ and click **Start Simulation** after loading. This
button also provides the user gesture needed by Web Audio. The original
`docker compose up -d` static nginx setup remains available on port 8930.

## Controls

- W / Up: increase throttle; S / Down: reduce throttle, then reverse.
- A / D or Left / Right: steering command; release to recenter.
- Space: throttle to neutral (does not instantly stop motion).
- R: reset vessel and wake. C: Chase / Helm / Top / Cinematic cameras.
- Mouse drag: orbit; wheel: zoom. Touch: hold and slide the drive pad.
- 1–4 or **Sea State** buttons: Calm / Moderate / Rough / Storm, always available.

`?quality=low|medium|high|ultra`, `?perf`, `?debug`, `?masks`, and `#auto` retain
their upstream meaning. All browser rendering quality profiles retain the P0-A 240 Hz plant. `?quality=ultra&debug&validate=drive`
runs an optional 32-second real-keyboard-input acceptance sequence after Start.
Do not combine that test URL with `#auto`.

The original steering sign is retained: positive steering vectors the
transom thrust toward local +X, producing negative yaw. P0-A adds actuator
dynamics while retaining the hull/force coefficients and the centered motor.
Generic trajectories intentionally change; ideal mode restores the old plant.
With `?debug`,
`window.openWater.twin.getState()` returns an isolated, JSON-safe ENU snapshot.
See [single-outboard audit](docs/USV1_SINGLE_OUTBOARD.md) and
[state v1 schema and coordinate signs](docs/DIGITAL_TWIN_STATE_V1.md).

## Validate

```sh
npm ci
npm test
npm run check
npm run benchmark
```

See [baseline measurements](docs/USV0_BASELINE.md),
[scope and validation](docs/USV_SINGLE_VESSEL_BASELINE.md), and
[license audit](docs/LICENSE_AUDIT.md). Upstream's coverage gate already fails
on the recorded Node 24 environment; it is not disguised as a passing check.
All physics, wave, wake, rendering and performance tests are retained. The
removed reward/fleet tests are documented as intentional product scope removal.

## Attribution and licenses

Original project: **Open Water**, original author **bob6664569**, copyright 2026.
Application source remains [MIT](LICENSE); vendored Three.js has its own MIT notice.
The [original README](docs/UPSTREAM_README.md) is preserved as historical documentation.

**Zodiac boat** by **RedC130**, [original model](https://sketchfab.com/3d-models/zodiac-boat-a10b7997f1514bd7829ece74f68c681c),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Original GLB and hull/force coefficients are unchanged; actuator parameters are generic and uncalibrated. The rig follows actual mechanical steering.
Modified from the original twin-outboard visual configuration to a single centerline outboard configuration.

This is a mixed-license repository. [Third-party notices](THIRD_PARTY_NOTICES.md)
and [audio licenses](site/assets/audio/LICENSES.md) still apply. Other boats and
wildlife assets remain on disk pending a later cleanup; they are not loaded by
this simulator. Inactive NC/SA assets are **not** relicensed to MIT.

## P0-A actuator acceptance

Develop on `test`; `main` is retained without merging. See
[actuator model and acceptance results](docs/P0A_ACTUATOR_MODEL.md).
Canonical command API (radians):

```js
boat.setActuatorCommands({ propulsionCommand: 0.55, steeringAngleRad: Math.PI / 18 });
```

The default is `generic` (steering ±30°, 45°/s, T=0.35s; propulsion T=0.6s).
`boat.setActuatorMode('ideal')` is for regression only; changing mode resets actuator
commands/state. Manual UI still uses the compatibility `setControls()` wrapper.

Offline acceptance commands, from the repository root:

```sh
node --import ./tests/register-three.mjs tools/p0a-steering-step.mjs
node --import ./tests/register-three.mjs tools/p0a-propulsion-step.mjs
node --import ./tests/register-three.mjs tools/p0a-turning-circle.mjs
node --import ./tests/register-three.mjs tools/p0a-benchmark.mjs
```

These tools write ignored `artifacts/p0a/` CSV/JSON outputs only. There is no
runtime CSV recorder, bridge, planner or network service.
