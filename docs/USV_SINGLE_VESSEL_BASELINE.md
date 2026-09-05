# USV Single Vessel Baseline

## Upstream

Full-history fork: https://github.com/TNTHEHEQ/open-water, based on
`bob6664569/open-water` commit `285b6ce32057c70191a7fe16c31d979fa383ac64`.
Branch: `codex/usv-single-vessel-baseline`. See `USV0_BASELINE.md` for original
tests, benchmark and browser evidence. DT-1 work is paused in a separate Git
stash on its original branch; no SIM/LIVE/REPLAY modules are part of USV-0.

## Scope

One Zodiac + sea + wind/waves/current + original physics + wake + basic driving.
No physics rewrite, no single-outboard conversion, no Qt, ROS, network protocol
or digital-twin state layer in this phase.

## Retained Systems

`main.js` composes EnvironmentController, WaveField, WakeField, Ocean, Boat,
DriveController, CameraController, BoatEffects, FoamTrail, WeatherEffects,
PerceptualEffects, color grading, audio, water passes and performance management.
`SingleVesselLoader` applies the existing profile and loads exactly one model.
`SimulationStartup` coordinates boat/sky/three rendered frames and the optional
audio/start gesture. There are no dummy achievements or fauna managers.

## Removed Systems

Runtime boat selector, catalog fetch, stored fleet selection, B/Shift+B switching,
L/log shortcut, achievements, rewards, unlocks, First Voyage, missions, fauna
creation/updates and all bird/animal audio prefetch are removed.

Deleted unused source: `controllers/vessel-controller.js`, `ui/achievements.js`,
`ui/first-voyage.js`, `ui/experience-controller.js`. Camera and quality controllers
no longer depend on achievements. Fauna library files and media remain on disk
for a separate cleanup, but there is no import path from the runtime entry point
to them. No birds, fish, whales, dolphins, turtles, mantas or seabed creatures
are created, rendered, sounded or fetched.

## Zodiac Vessel

ID `zodiac_boat`, model `site/assets/boats/zodiac_boat.glb`, RedC130, CC BY 4.0.
Length 5.5 m; original `makeSpec`/`VESSEL_SPECS` architecture and complete original
profile retained. Visual shows the **original two outboards**. Single-outboard
visual/propulsion conversion is explicitly deferred to USV-1.

## Sea Simulation

All four upstream presets retained: Calm Hs .35 m / Tp 4.5 s; Moderate (upstream
label Rolling) .9 / 5.4; Rough 2.4 / 6.1; Storm 5.2 / 6.4. UI naming alone changes.
Deterministic seed 987654321, JONSWAP, 16 Gerstner components, cross swell,
gusts and procedural surface current remain unchanged. All sea controls are
available without progression. Upstream gradual preset interpolation remains.

## Physics

`simulation/boat.js` is byte-for-byte unchanged from upstream, as are
`waves.js`, `wake-field.js`, `vessels.js`, and `vessel-animations.js`.
6DOF, 8 buoyancy points, point-relative-water response, drag, planing lift,
moving CoP, heel restoring, wind, current, propeller ventilation and transom
vectored thrust all remain. Root +Z is forward, +X right, +Y up.
The default native integration capability is 240 Hz. Original render quality
budgets remain: Ultra 240 Hz, High 180 Hz, lower/adaptive profiles can reduce
the rate. Browser acceptance used locked Ultra (240 Hz); no global math changes.

## Wake

The original persistent CPU/GPU WakeField, advection, FoamTrail, bow displacement,
Kelvin crests and older-wake interaction are unchanged. Browser driving produced
10–96 active wake sources and visible curved wake/foam. Deterministic runs use
real wake feedback; a separate integration test places Zodiac across a 3-second
old wake and proves its actual 6DOF velocity response differs from no-wake water.
That isolated old-wake response is a numerical test; browser wake validation
observes the retained visual trail and vessel response during turns, rather than
claiming an instrumented browser measurement of a specific old crest crossing.

## Rendering

Ocean shaders, reflections/refractions, water masks, spray, mist, propeller jets,
impact effects, foam, rain and lightning are unchanged. Existing Chase, Helm,
Top and Cinematic cameras remain. UI is now only loading/start, speed, heading,
throttle, steering, sea state, quality and help. `?debug` adds numerical readout.

## Runtime Assets

Fresh browser load on local port 8089, HTTP access log `artifacts/usv0-http.log`:

| Request class | Per-startup requests |
|---|---:|
| Zodiac GLB | 1 |
| Other vessel GLB | 0 |
| Fleet catalog JSON | 0 |
| Wildlife GLB / fauna modules | 0 |
| Bird/animal sounds | 0 |

Desktop audio after Start requests 2 Zodiac engine samples and 11 sea/weather
samples, plus 1 HDR environment at startup. No racer/yacht/jetski/assault engine
bank is requested. Reloads repeat/cache-revalidate Zodiac; these are distinct
startup sessions, not multiple vessels. Final favicon is inline (no 404 request).
Original media files are intentionally not physically deleted in this phase.

## Controls

W/Up increase throttle; S/Down reduce and reverse; A/D or arrow keys steer;
Space neutral; R reset vessel and wake; C cycles cameras; mouse orbit/wheel zoom;
touch hold/slide; 1–4 or Sea State buttons select sea. No B, Shift+B or L actions.
URL `?quality=`, `?perf`, `?debug`, `?masks` and original `#auto` work.

## Tests

- Before: 184 passed / 0 failed. After: **175 passed / 0 failed**.
- Lint: PASS (JavaScript and HTML).
- `check`: lint/tests pass, coverage gate remains FAIL (26.98% lines, 30.25%
  functions; unchanged gates 60% / 50%). Coverage run 173 pass + 2 existing skips.
- Intentional product scope removal: 7 fleet tests, 5 experience/progression
  tests, 6 achievement tests removed with their deleted modules. Performance
  tests from the combined file were retained in `performance.test.mjs`.
- Camera/quality tests retain behavior assertions and remove only reward-event
  assertions. Fauna code tests remain as protection for retained inactive files;
  the runtime integrity assertion now forbids fauna in `main.js`.
- Physics/wave/wake/render/spec/performance tests retained. New tests cover
  startup readiness, single-model loading, no game wiring, audio request scope,
  four-sea deterministic physics and actual aged-wake response.
- 4 sea × 30 s Zodiac regression: position, quaternion, linear/angular velocity,
  planing force, height and wake count **exactly equal** to pristine fixture;
  maximum absolute error **0** across all recorded fields.

### Actual browser acceptance

Startup loads Zodiac, no selector/tasks/creatures. All four sea buttons and
all four cameras exercised. 240 Hz manual key sequence in Calm:

| Stage | Time s | Body surge m/s | Steering | Throttle | Yaw rate rad/s | Y m |
|---|---:|---:|---:|---:|---:|---:|
| Forward | 5.01 | 15.0916 | 0 | 1 | -0.0009 | .0414 |
| D input | 9.00 | 6.5461 | 1 | 1 | -.8208 | .1700 |
| A input | 14.01 | 6.7977 | -1 | 1 | .8161 | .1256 |
| Coast | 20.00 | 5.2844 | 0 | 0 | -.0022 | .1872 |
| Reverse | 32.02 | -5.5426 | 0 | -1 | -.0001 | -.0203 |

`?quality=ultra&debug&validate=drive` runs this optional sequence by calling the
real DriveController press/release methods; it never writes Boat transforms,
forces or physics parameters. Normal startup never imports that driver.
Browser snapshots also recorded sea 2 at 20.332 m/s with 96 wakes, sea 3 at
19.366 m/s and sea 4 at 18.032 m/s under original full-throttle auto input;
these are observations, not calibrated top speeds. No NaN or runtime exception
observed. Final tested Console: **0 errors, 0 warnings**.

Evidence (ignored): `artifacts/usv0/drive-calm.json`, `forward.png`, `calm.png`,
`rough.png`, `storm.png`, and final `USV-Zodiac.png`.

## Performance

See `USV0_BASELINE.md`: full wave benchmark +3.33% sample query / -6.94%
spectrum update median cost; checksums identical. A steady browser observation
at Ultra showed frame p95 21.1 ms, CPU p95 5.3 ms, GPU p90 5.0 ms, 270 draw calls,
1.62 M rendered triangles. Original same-scene browser memory and timing were
not sampled comparably, so no unsupported improvement percentage is claimed.

## License

Source MIT, original author notice retained; Zodiac CC BY 4.0; runtime HDR and
selected audio CC0. Full mixed-media inventory remains intact. Inactive NC/SA
files keep their restrictions; see `LICENSE_AUDIT.md`.

## Known Limitations

- The original hand-rolled hydrodynamics are uncalibrated to a real USV.
- Original dual-outboard visuals and propulsion profile remain.
- Upstream steering sign retained: D/positive command gives negative yaw through
  positive-X stern force. User-facing sign changes belong in an isolated USV-1
  change, with regression expectations updated explicitly.
- Initial sea transitions, automatic recovery and quality-dependent physics
  budgets are upstream behavior, not new USV dynamics.
- Coverage gate fails in this Node environment before and after cleanup.
- Inactive fleet/fauna code and licensed media remain on disk pending cleanup.
- No LIVE/REPLAY, telemetry, Qt, WebSocket, ROS or real-vessel calibration.

Next recommendation only: **USV-1 — Zodiac Single-Outboard Conversion**, then
begin defining a Digital Twin State contract in a separately tested change.
