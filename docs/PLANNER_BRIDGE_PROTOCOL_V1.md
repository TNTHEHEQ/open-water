# Planner Bridge Protocol v1

P0-B/C/D, based on P0-A `392aecff8c3a5780fc1a89eb353f0871014fec58`.
Development stays on `test`; `main` and the entire ocean/6DOF/actuator mathematics are unchanged.

## Architecture

```text
External test program / future C++ Planner
  ⇅ native WebSocket JSON
PlannerBridge → ExternalCommandSource
                       ↓
DriveController → CommandMux (MANUAL / EXTERNAL)
                       ↓
Boat.setActuatorCommands → OutboardActuator (240 Hz) → original 6DOF
                       ↓
SimulationStateSource → finalized TwinState v1 → Bridge / ExperimentRecorder
```

DriveController still shapes human keyboard/touch/auto input. It now holds a command
sink (the mux), not Boat. The mux converts normalized manual steering to mechanical
radians. It selects commands only; there is no second actuator or force model.
No code changes to Boat, OutboardActuator, waves, wake, hull coefficients or integration.

## Connection Direction

**C++ Planner = WebSocket Server. OpenWater Browser = WebSocket Client.**
The browser uses native `WebSocket`, with no Socket.IO/build framework.
Default development endpoint: `ws://127.0.0.1:8765`.
Configuration: `SIMULATOR_CONFIG.plannerUrl`, `plannerBridgeEnabled` (default false).
An explicit `?planner=ws://127.0.0.1:8765` enables it; `?planner=` disables it.
Invalid endpoint configuration falls back to standalone manual with a warning.
Connection starts after the user starts the simulation, independently of asset loading.
No server is needed for normal standalone operation. HTTPS hosting would require WSS.

## Units

UTF-8 JSON text, `protocol_version: 1` on every message. Numbers must be finite.
SI: seconds, metres, m/s, rad, rad/s, N. No normalized steering on the wire.
No undefined, Three objects, binary payloads, RPM proxy or callbacks.

## Coordinates

State vectors and positions are ENU: X east, Y north, Z up.
The existing coordinate adapter is unchanged. Heading is **navigation heading**:
north=0, east=+π/2, clockwise. Body scalars: u forward, v starboard, w up;
p starboard-down, q bow-up, r clockwise (body rates, not Euler derivatives).
Quaternion/body basis and axial-vector mapping are fully specified in
[TwinState v1](DIGITAL_TWIN_STATE_V1.md). Do not assume conventional X-forward FRD
quaternions or equate yawRate with ENU angular.z.
Positive mechanical steering preserves the upstream negative-yaw turning sign.

## Control Ownership

Default MANUAL, including after connecting. A connection alone never owns commands.

```json
{"protocol_version":1,"type":"set_control_mode","mode":"EXTERNAL"}
```

Every ownership request invalidates the previous external command. Send a fresh
command after claiming. `mode:"MANUAL"` restores the current manual source.
EXTERNAL blocks keyboard/touch/auto command overwrites; their UI state can continue
changing. The local R reset key is disabled during EXTERNAL ownership. No network
reset is implemented. Switching to MANUAL may expose the current manual throttle;
the actuator still applies its lag/rate/saturation.

## Control Command

```json
{"protocol_version":1,"type":"control_command","sequence":123,"timestamp":10.52,"propulsion_command":0.55,"steering_angle_rad":0.174532925}
```

Only these exact fields are accepted. State commands such as x/y/yaw/u/r, missing
fields, extra fields, wrong types, unknown versions, bad JSON and nonfinite values
are rejected and counted. Input text is limited to 4096 characters.
Finite out-of-range propulsion/steering is intentionally accepted: **the existing
actuator saturates** to [-1,1] and its vessel mechanical angle limits.
Commands are accepted only after a valid ownership request on this connection.
Receiving commands updates targets, never Boat position/velocity or physics time.

## State Message

```json
{"protocol_version":1,"type":"simulation_state","sequence":456,"simulation_time":10.54,"state":{"schemaVersion":1,"vesselId":"usv001","source":"SIM"}}
```

The shortened `state` above illustrates the wrapper only. Actual messages contain
the **complete** validated TwinState v1: identity/time/sequence, pose, velocity,
body velocities/rates, attitude, control, actuator, environment and dynamics.
`simulation_time === state.timestamp`. There is no parallel bridge physics schema.
State control fields are the saturated authoritative actuator commands; raw received
commands may exceed those limits. No planner commands can set state.

## Sequence

Control sequence must be a nonnegative JavaScript-safe integer (0…2^53−1).
Duplicates and older sequences are rejected, counted, and do not refresh receipt time.
Ordering is scoped to the current connection; reconnection resets received sequence
to -1. State transport sequence is separate from the projection sequence inside state.

## Timestamps

Command timestamp is opaque sender time, retained for diagnostics only. Timeout uses
**browser monotonic receipt time** (`performance.now()/1000`), never sender time/UTC.
State timestamp remains existing WaveField simulation time. Frame-time accumulation
and original plant substep backlog policy are unchanged; state time is not a UTC
timestamp or a new exact substep clock. Force diagnostics can precede the final pose
by one substep, as in P0-A.

## Timeout / Failsafe

`externalCommandTimeoutSec=0.5`, configurable. If age exceeds this threshold or the
source is invalid, EXTERNAL selects {propulsionCommand:0, steeringAngleRad:0}.
Only targets change: no actuator reset, teleport, velocity freeze or instant force cut.
Actuator actuals return via existing lag and rate limits. Invalid/duplicate packets
cannot keep a command alive. Timeout is checked before each frame's physics update;
socket close/error also invalidates the source and applies safe commands immediately.
Browser suspension stops JS/physics together; this is not a hard real-time safety device.

## Reconnection

First retry after 1 s, subsequent retries after 2 s; driven by the browser frame pump.
No telemetry queue; no busy retry loop. A reconnected EXTERNAL source remains invalid
until **a new ownership request and a new valid command**. Old command values are never
restored. `bridge.stop()` closes intentionally and disables reconnect until start().

## Publication / Backpressure

`plannerStateRateHz=50`, supported 10–100. Uses a separate monotonic deadline, not
physics dt. At most one current state per frame, no catch-up duplicate bursts. Actual
rate is bounded by render/state projection FPS. `bufferedAmount > 65536` skips that
publish; latest state wins. There is no stale state queue. Validation and synchronous
serialization happen only on due publishes, not every render or 240 Hz substep.
The reusable state is serialized synchronously; no deep-copy snapshot is needed.

## Example Messages

On connection, browser sends:

```json
{"protocol_version":1,"type":"hello","role":"openwater_plant","vessel_id":"usv001"}
```

Then external sends ownership, then increasing-sequence control commands at e.g.
40 Hz; browser returns state at nominal 50 Hz. `?debug` exposes
`window.openWater.bridge` (start/stop/diagnostics) and recorder APIs.
Diagnostics include connected, controlMode, lastCommandSequence, lastCommandAgeMs,
stateSequence, received/sent/invalid counts, dropped states and failsafe.

## Run the external smoke substitute

```sh
npm ci
npm run planner:smoke -- --experiment steering-step
# Alternatives: propulsion-step, turning, suite
# Serve site/ using your local HTTP server, then open:
# http://127.0.0.1:8091/?debug&planner=ws://127.0.0.1:8765
```

The smoke server binds loopback only; `ws` is a dev dependency, absent from browser
imports. Start Simulation; for recorder acceptance click REC start after startup.
`suite` performs 6 s steering, 8 s propulsion, 90 s straight/turn, timeout, real
disconnect, reconnect-safe hold, new command, then neutral. Artifacts go to ignored
`artifacts/p0b/<experiment>/`. Commands are a test schedule, not an implemented planner
or feedback controller. The server validates returned telemetry and writes summaries.

## Acceptance Results

Actual browser/native WebSocket suite: 5451 states, 110.0183 simulated seconds,
49.537 states/s, two connections. Calm sea retains wind/current/waves/wake; it is
not the flat-water P0-A offline environment.

| Response | t10 | t50 | t90 | 2% settling |
| --- | ---: | ---: | ---: | ---: |
| External steering 0→10° | 0.0417 | 0.2584 | 0.8215 | 1.3794 |
| External propulsion 0.2→0.8 | 0.0792 | 0.4422 | 1.4022 | 2.3589 |

Times are measured from the last pre-change telemetry sample; command observation
intervals are 0.0215/0.0209 s, so these are sampled responses, not substep-exact
latencies. Observed maximum steering rate 0.481067 rad/s (27.563°/s). The unsampled
first substep can be higher; P0-A's exact offline 10° response remains 28.571°/s.

Turn final 10 s mean: u=11.765114 m/s, v=6.383784 m/s, r=-0.264756 rad/s;
radius≈50.557794 m. One actual state: ENU (335.374416,183.300633,0.176177) m,
yaw=1.419917 rad, u/v/r=11.855858/6.453022/-0.218785,
steering cmd/actual=0.174533/0.174533 rad, propulsion cmd/actual=0.55/0.55,
raw/effective thrust=5775/4255.473 N.

At timeout first observed safe command, t=104.6229 s: both commands=0, but propulsion
actual=0.538621 and steering actual=0.168374 rad, proving no instantaneous reset.
19 post-reconnect safe samples precede the fresh command; 50 later samples confirm
new command reception. Stopping the server separately produced browser HUD
DISCONNECTED / EXTERNAL / Failsafe YES. No-server manual driving also passed.
Recorder: 3985 finite rows, 35 columns, strictly increasing simulation time.

Measured typical state message 1965 UTF-8 bytes; median JSON serialization 7.624 μs,
validation+serialization 11.770 μs. Optional explicit snapshot+serialization 22.730 μs
(not used in the publish path). At 50 Hz this is ~0.589 ms CPU/s for validation+JSON,
excluding native socket work/GPU. Hardware/JIT dependent. Tools/benchmark results and
full recordings remain ignored artifacts. Publisher/recorder ON/OFF ideal regression
is bit-identical, including native step count; neither module imports Boat or WaveField.

## Future Extensions / Limitations

- JSON/WebSocket only; browser is a client, no real C++ Planner integration yet.
- Loopback development protocol, no authentication/public hosting service added.
- Recorder/state observer is frame-level, not deterministic 240 Hz substep logging.
- Trajectory, obstacles, reset and scenario messages are future extensions, rejected now.
- No physical RPM/KT/KQ, pure actuator delay or real-vessel calibration.
- OpenWater remains empirical hand-rolled physics; successful transport is not hydrodynamic validation.
- P1-A recommendation only: real C++ connection, trajectory visualization and identification experiment runner.
