# USV Open Water Simulator

A single-vessel marine simulation and digital-twin foundation based on
[bob6664569/open-water](https://github.com/bob6664569/open-water).

Phase **USV-0** runs one Zodiac RIB with the original Open Water physics, ocean,
wind, current, waves, wake, spray, weather, audio and cameras. No boat selection,
achievements, unlocks, missions, birds, fish or other wildlife run or download.
SIM/LIVE/REPLAY, Qt, network telemetry and single-outboard conversion are deferred.

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
their upstream meaning. Ultra uses 240 Hz physics; original adaptive render
profiles can lower the physics budget. `?quality=ultra&debug&validate=drive`
runs an optional 32-second real-keyboard-input acceptance sequence after Start.
Do not combine that test URL with `#auto`.

The original steering sign is retained in USV-0: positive steering vectors the
transom thrust toward local +X, producing negative yaw. This phase does not
change the propulsion model or convert the two visible motors to one.

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
Original GLB, rig, materials and vessel physics profile are unchanged.

This is a mixed-license repository. [Third-party notices](THIRD_PARTY_NOTICES.md)
and [audio licenses](site/assets/audio/LICENSES.md) still apply. Other boats and
wildlife assets remain on disk pending a later cleanup; they are not loaded by
this simulator. Inactive NC/SA assets are **not** relicensed to MIT.
