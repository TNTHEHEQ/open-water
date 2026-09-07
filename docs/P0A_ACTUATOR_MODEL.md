# P0-A Single Outboard Actuator Model

Baseline: `3759330a4521fc8b7bcb9c928e2259a78a950793` (USV-1).
Development branch renamed in place to `test`. `main` remains unchanged.

## Motivation

Insert a formal actuator before the existing force model, with commands separated
from physical outputs. This is a generic plant improvement, not a claim of
real-vessel hydrodynamic validation or identified actuator accuracy.

```text
DriveController (human input shaping) / canonical command caller
  → Boat.setActuatorCommands
  → OutboardActuator.update(1/240)
  → existing OpenWater force model
  → native 6DOF integration
```

## Previous Behavior

Audited `drive-controller.js`, `boat.js`, `vessels.js`,
`vessel-animations.js`, `vessel-state.js`, `simulation-state-source.js`.
`DriveController` ramps keyboard commands; `Boat.setControls` previously only
clamped and immediately wrote throttle and normalized steer. `_step` computed
steer*maxSteerRad/(1+speed*0.045), and Tmax*throttle times immersion/heel/advance
factors. The rig then applied a separate exp(-9dt) visual lag.

**UI input shaping != actuator dynamics.** DriveController is unchanged.
`OutboardActuator` is a renderer-independent mechanical/propulsion state machine.

## Command vs Actual

Canonical API:

```js
boat.setActuatorCommands({ propulsionCommand: 0.55, steeringAngleRad: Math.PI/18 });
```

Both inputs must be finite. Steering uses mechanical radians, never normalized
steer internally. `setControls(throttle, steerNormalized)` remains a compatibility
wrapper, clamping normalized steer and multiplying by spec.maxSteerRad. Both paths
reach the same actuator. Compatibility Boat.throttle/steer still describe commands.
Direct writes to them bypass the canonical command API and are not supported.

`reset()` clears commands, propulsion actual, steering actual/rate/effective and
raw/effective thrust. Selecting a different mode or vessel resets actuator state;
it does not carry an old engine command into the new profile.

## Steering Model

`Tδ δdot + δ = δcmd`, with `|δdot| <= δdot_max`.

Each substep computes `(δcmd - δactual)/Tδ`, limits the rate, integrates forward
Euler and saturates the mechanical angle. For dt>Tδ, the increment is capped at
the remaining error to prevent overshoot; normal dt=1/240 is far smaller than Tδ.
No pure delay or command-history queue is implemented. Nonzero delay settings
fail explicitly rather than being silently ignored.

The single-outboard rig directly uses δactual. There is no extra visual smoothing
on the actual-actuator path. Historical rig tests without an actuator retain the
old fallback path. Propeller animation uses actualPropulsion as a visual proxy;
no mechanical RPM state is invented.

## Propulsion Model

`TT adot + a = acmd`, forward Euler at 240 Hz, saturation [-1,1].
The zero-time-constant ideal profile assigns the command exactly, avoiding
round-off from x+(target-x). Generic reversal naturally passes through zero;
there is no gearbox dwell, shaft inertia or reversal interlock.

## Saturation

Commands saturate before integration; actual states saturate after integration.
Tests exercise +50°→+30°, -50°→-30°, full forward/reverse, repeated rate-limited
reversals, finite-input validation and reset. Parameters are copied/frozen at
construction; changing a profile requires reconfiguring the actuator.

## Hydrodynamic Effective Steering

`δeffective = δactual / (1 + relativeWaterSpeed * 0.045)`.
There is exactly one original speed-effectiveness correction. δcmd is requested
mechanical angle, δactual is the achieved angle, δeffective is the force-model
angle. `_effSteer` remains an internal effective-angle alias, not actual steering.

## Raw vs Effective Thrust

```text
a >= 0: rawThrustN = 10500 * a
a <  0: rawThrustN = 2700 * a
effectiveThrustN = rawThrustN * propWet * heelCut * advanceRatio
```

Immersion smoothstep, heel cut, advance ratio and the original sin/cos vector
are unchanged. Force acts at the original propPos (0,-0.343,-2.585) m; torque is
the original r×F. No direct yaw torque was added. Original `rudderLift` remains
an empirical additional lateral force of the steering outboard/transom system,
not a second independently actuated traditional rudder.

`Boat.diagnostics` exports commands, actual states, raw/effective thrust,
mechanical/effective angle and rate, and ventilationFactor. `thrustN` is retained
only as an alias for effectiveThrustN. TwinState reads these authoritative values
without reconstructing forces.

## 240 Hz Integration

The first operation in `Boat._step(h)` is `outboardActuator.update(h)`; buoyancy,
drag, planing, propulsion and state integration follow. Nothing steps the
actuator in the render loop. A 60 Hz frame normally integrates four actual steps.

Browser composition pins Boat's physics budget to 240 Hz / 12 maximum steps,
even when quality switches to low/medium. The low-level budget API remains for
existing tests and explicit offline callers; it is not a browser actuator-mode
control. Original accumulator/drop-backlog behavior is unchanged: overloaded
rendering can slow simulated time relative to wall time. All response times here
are simulation time. 30/60/120/**144** FPS produce identical actuator states after
two seconds (30°/45° saturation tested separately).

## Generic Parameters

| Parameter | Zodiac value |
| --- | --- |
| steeringMinRad / steeringMaxRad | -0.5235987755982988 / +0.5235987755982988 rad |
| steeringRateRadPerSec | 0.7853981633974483 rad/s (45°/s) |
| steeringTimeConstantSec | 0.35 s |
| propulsionMin / propulsionMax | -1 / +1 |
| propulsionTimeConstantSec | 0.6 s |
| steeringDelaySec / propulsionDelaySec | 0 / 0 |
| maxThrustFwd / maxThrustRev | unchanged 10500 / 2700 N |

`makeSpec()` creates defaults from each vessel's original maximum angle plus
the generic time/rate constants. `config.actuator` can override them. These are
**generic simulation actuator parameters, not identified real-vessel parameters**.

## Ideal Regression Mode

`boat.setActuatorMode('ideal')` uses `IDEAL_ACTUATOR`: zero time constants and
unbounded steering rate, retaining vessel angular saturation. Default browser
config is `actuatorMode: 'generic'`; ideal is for tests only.

USV-0 and USV-1 fixture files are unchanged. Their existing runner now explicitly
selects ideal mode; all assertions remain. Four seas × 30 seconds with original
seed, control sequence and wake feedback compare **exactly**:
position, quaternion, linear/angular velocities, planing force, CoP, wave height
and wake count all have max absolute error **0**. Diagnostics CoP/planing are also
compared against the independent accumulator/worldPoint observer. Generic-mode
trajectories intentionally differ because force establishment is no longer instant.

## Step Tests

Run each with `node --import ./tests/register-three.mjs tools/<name>.mjs`.
The standalone tools write only ignored `artifacts/p0a/` CSV and summary JSON;
no recorder is added to the browser runtime. Sampling interval is 1/240 s.

| Tool | t10 | t50 | t90 | 10–90 rise | 2% settling |
| --- | ---: | ---: | ---: | ---: | ---: |
| p0a-steering-step (0→10° at t=1s) | 0.037500 | 0.241667 | 0.804167 | 0.766667 | 1.362500 |
| p0a-propulsion-step (0.2→0.8 command) | 0.066667 | 0.416667 | 1.379167 | 1.312500 | 2.341667 |

Times are relative to the step, not process startup. Propulsion actual at t=1s
is 0.162443866 because the initial 0.2 command has not settled; step percentages
use that measured initial value and the final 0.8 target.

The 10° steering test's max rate is **0.498665501 rad/s (28.5714°/s)**.
It cannot hit the 45°/s cap: 10°/0.35s is only 28.57°/s. A separate 30° step
and repeated ±30° unit-test reversals reach **0.7853981634 rad/s**, within floating
precision of the cap. No parameters were adjusted to force an artificial plateau.

`p0a-turning-circle`: deterministic flat water, no wind/current/wake; 20 s straight
then 70 s with propulsion=0.55 and steering=10°. Final 10-second mean:
u=**11.683608 m/s**, v=**6.272478 m/s**, r=**-0.287111 rad/s**,
approximate radius `hypot(u,v)/abs(r)`=**46.187212 m**. Positive steering retains
upstream negative-yaw behavior. The substantial sideslip is a result of the
uncalibrated upstream model, not a validated real-boat turning circle.

## Runtime and tests

Existing 192 tests retained, including intentional migration of the state
contract to v1; total **204/204 PASS**. Original hull regression explicitly uses
ideal mode; new actuator tests use generic mode. JS/HTML lint pass. Coverage
remains below the existing gate: 31.42% lines/60% and 38.43% functions/50%; normal
tests pass, coverage mode has two pre-existing isolated-suite skips. Thresholds
were not changed.

Browser real-key sequence recorded v1 snapshots. Forward command=1 gave actual
0.972705 and raw/effective 10213.40/8180.24 N. Positive steering commanded
0.523599 rad; actual/visual=0.523588, effective=0.339324. Reverse raw/effective
-2700.00/-1995.97 N. Low quality also showed 240 Hz. No runtime errors; one
shader compiler warning entry from vendored Three.js: **X3595: gradient instruction
used in a loop with varying iteration; partial derivatives may have undefined
value** (message repeats the compiler line). Shader code was not changed.

## Performance

`p0a-benchmark.mjs` measures 9 batches × 500,000 actuator updates, varying commands
and accumulating an observed checksum. Median **7.729 ns/update**, ~1.855 μs per
simulated second at 240 Hz. No object/array allocation, queue, serialization or
component lookup occurs in the valid update path. Construction and invalid-input
exceptions may allocate.

Same-process alternating original 3759330 vs current generic plant, water+wake+
240 Hz integration per 60 Hz frame, nine runs: **173.270→173.594 μs (+0.187%)**.
GPU and TwinState projection are excluded. Different transient trajectories and
JIT/system load make small differences noise; this does not claim a speedup or
real-time hardware guarantee. `npm run benchmark` was also executed unchanged.

## Known Limitations

- Generic parameters have not been identified from real boat data.
- No pure delay, physical shaft RPM, KT/KQ, gearbox/reversal interlock or propeller map.
- OpenWater hull/force coefficients and integrator are unchanged; they remain hand-rolled empirical physics.
- Existing visual spray/audio shaping is not a shaft/actuator sensor model; use authoritative diagnostics for validation.
- No planner, controller, WebSocket, runtime CSV bridge, trajectory UI or obstacles were added.
- Native time advances in discrete substeps; reported actual rate has ordinary floating-point rounding.
