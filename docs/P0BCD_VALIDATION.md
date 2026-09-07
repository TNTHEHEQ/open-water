# P0-B/C/D Validation

Baseline: `392aecff8c3a5780fc1a89eb353f0871014fec58`. Branch `test` only; no main merge.

## Tests

All prior P0-A tests retained. Current `npm test`: **225/225 PASS**, zero skipped/failed.
Additional authority/protocol/socket/recorder tests include actual loopback WebSocket
with the native Boat plant, actuator response, receipt-time failsafe, ownership,
sequence rejection, reconnect, backpressure, recorder isolation and exact plant
observer-on/off regression (pose, quaternion, velocity, angular velocity, step count).
USV-0/USV-1 existing ideal fixtures remain unchanged and pass exactly.

`npm run lint`: JavaScript and HTML PASS, zero errors/warnings.
`npm run check`: normal tests pass, coverage run **223 PASS / 2 existing isolated
suite skips / 0 FAIL**; the coverage gate still fails, **31.82% lines vs 60%** and
**40.23% functions vs 50%** (branches 82.03%). Thresholds and script semantics unchanged.

## Browser

Native browser client to real Node/ws loopback server, nominal publisher 50 Hz,
native plant 240 Hz, low rendering quality. External suite collected 5451 complete
validated v1 states across two real socket connections. Steering/propulsion steps,
constant turning, command timeout, disconnect, reconnect-safe hold and fresh-command
resumption exercised. Full numerical results in
[protocol acceptance](PLANNER_BRIDGE_PROTOCOL_V1.md#acceptance-results).

The browser recorder generated 3985 rows × 35 columns, strictly increasing times,
finite numbers, ENU/SI. getCsv/preview inspected and saved to ignored artifacts.
Native OS file-download interaction was not used as automated acceptance.

No-server standalone keyboard sequence via DriveController→CommandMux:

| Stage | u m/s | r rad/s | Active wake sources |
| --- | ---: | ---: | ---: |
| Forward | 12.5966 | -0.0007 | 8 |
| D input | 6.5388 | -0.7789 | 28 |
| A input | 7.2099 | 0.8072 | 54 |
| Coast | 6.1761 | -0.0054 | 87 |
| Reverse | -5.3637 | 0.0014 | 96 |

Standalone has no connection attempts, remains MANUAL and does not require a server.
Browser console during connected suite and standalone: **0 errors, 0 warnings**.
The deliberately unavailable endpoint after stopping the server can generate native
browser connection-failed log entries during 2 s retries; this is expected and does
not stop simulation. Captured HUD: DISCONNECTED / EXTERNAL / Failsafe YES.

## Performance

Actual telemetry median-sized sample: 1965 UTF-8 bytes, measured ~49.537 states/s
over the suite (includes reconnect pause). Median JSON serialization **7.624 μs**;
validation+serialization **11.770 μs**; explicit snapshot+serialization **22.730 μs**
(not used by bridge). Runtime serializes the current state synchronously without
deep clone. No plant-step network writes. Native socket transport/GPU excluded.

`npm run benchmark` executed: waves.sampleSurface **2967 ns/op**, updateSpectrum
**605 ns/op**, while the browser was active. These unchanged-wave benchmarks are
system-load dependent and are not evidence that the wave algorithms changed.

`npm install` added only ws as a dev dependency. Audit also reports existing
development dependency findings in brace-expansion and fast-uri; unrelated packages
were not mass-upgraded as part of the bridge implementation.

## Artifacts (ignored, not committed)

```text
artifacts/p0b/suite/telemetry.json
artifacts/p0b/suite/summary.json
artifacts/p0b/browser-turning.csv
artifacts/p0b/fault-recorder-validation.json
artifacts/p0b/disconnect-hud.txt
artifacts/p0b/standalone-manual.json
artifacts/p0b/performance.json
artifacts/p0b/benchmark.txt
artifacts/p0b/check.txt
```

This proves a bidirectional plant-command/telemetry loop with an external **test
substitute**, not a completed C++ planner or hydrodynamically validated real boat.
