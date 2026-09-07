# Digital Twin State v1

P0-A intentionally breaks the v0 **control** schema. The old document remains
historical. `schemaVersion=1`; source remains SIM. P0-B/C/D finalizes v1 with
environment metadata and WebSocket transport; LIVE/REPLAY remain unimplemented.

## Command, actual, effective

```js
control: {
  propulsionCommand: 0,       // clamped [-1,1], requested normalized propulsion
  steeringCommandRad: 0      // clamped mechanical steering command, radians
},
actuator: {
  type: 'single_outboard',
  propulsionActual: 0,       // achieved normalized propulsion after lag
  rawThrustN: 0,             // signed Tmax * propulsionActual
  effectiveThrustN: 0,       // after ventilation, heel and advance effects
  steeringActualRad: 0,      // actual mechanical angle, also used by visual rig
  steeringEffectiveRad: 0,   // speed-attenuated force-model angle
  steeringRateRadPerSec: 0,  // actual mechanical increment / physics dt
  ventilationFactor: 1      // original propWet: 0 dry, 1 immersed
}
```

There is no `control.throttleCommand`, normalized `control.steeringCommand`,
`control.actualSteeringRad` or nested `control.propulsion`. Consumers must migrate
explicitly. In v0, actualSteeringRad incorrectly named an **effective** angle;
v1 removes that ambiguity. No fake RPM is output. The propulsion lag is not a
shaft RPM model. VentilationFactor excludes separate heel/advance factors.

`SimulationStateSource` copies authoritative Boat.diagnostics values. It does
not reconstruct actuator state or recalculate thrust. The command setter updates
command diagnostics immediately; actual/effective values represent the most
recent physical step. Force/CoP observations precede final substep integration;
pose follows it (at most one step offset).

## Remaining complete state

| Group | Fields / units |
| --- | --- |
| identity | schemaVersion=1, vesselId, source='SIM', sequence, timestamp (simulation seconds) |
| pose | position {x,y,z} ENU metres, orientation {x,y,z,w} unit quaternion, headingRad |
| velocity | linear {x,y,z} ENU m/s; angular {x,y,z} ENU rad/s; body {surge,sway,heave,rollRate,pitchRate,yawRate} |
| attitude | rollRad, pitchRad, yawRad |
| environment | seaState (preset index), localWaterHeight (m), waterVelocity/current/wind {x,y,z} ENU m/s |
| environment.wave | significantHeightM, peakPeriodSec (current blended spectrum, not target preset) |
| environment flow metadata | windSpeedMps, windDirectionRad, currentSpeedMps, currentDirectionRad |
| dynamics | planingForceN, centerOfPressure {x,y,z} absolute ENU metres, submergedPoints |

ENU is east/north/up. OW position/linear vectors map (x,y,z)→(x,z,y);
world angular vectors are axial and map →(-x,-z,-y). Quaternions map
(x,y,z,w)→(-x,-z,-y,w), conjugating both body/world bases. Identity points north
with ENU-local +Y as bow, +X starboard, +Z up. This is not an assumed +X-forward
FRD quaternion. Coordinate conversion remains unchanged and tested at 0/±90/180°
heading plus nonplanar attitude.

Named body scalars use surge forward, sway starboard, heave up; roll starboard-down,
pitch bow-up, yaw clockwise. Rates are body angular components, not Euler-angle
derivatives. Navigation heading/yawRad is north=0, east=+π/2, [-π,π]; it is opposite
ENU +Z rotation for a level vessel. Positive mechanical steering retains original
positive transom lateral thrust/negative navigation yaw; no command sign was flipped.

P0-B/C/D retains existing wind/current vector objects, adding adjacent metadata
instead of replacing them with a parallel environment schema. Flow speed is the
magnitude of the local sampled vector; direction is navigation bearing **toward**
flow, north=0/east=+π/2 (0 for zero flow), not meteorological wind-from bearing.
Hs/Tp read WaveField.significantWaveHeight/peakPeriod directly. Unit-test flat-water
adapters without spectrum fields report 0/0. Browser WaveField always supplies them.

## Lifetime and validation

All fields are finite plain JSON data, with SI units. The reusable internal object
and nested objects are updated in place; `getState()` is read-only by convention.
`snapshot()` allocates only on request. In `?debug`,
`window.openWater.twin.getState()` returns a snapshot. The debug HUD reads v1 at
5 Hz and shows commands, actuals, effective values, rate and both thrust values.

Strict `validateVesselState()` rejects v0/unknown fields, nonfinite values,
non-plain objects, wrong identifiers/types, malformed quaternion and invalid
propulsion/ventilation ranges. It is used by tests and on due network publishes,
not a deep walk in every animation frame. Steering bounds belong to the active vessel profile,
not a hardcoded ±30° protocol-wide validator.

Reset produces zero commands/actuals/rate/thrust, ventilation default 1. Before
Start or before the first physical step, cached water velocity/diagnostics can
still be initialized defaults. Sequence counts projections; timestamp is not UTC.

See [actuator equations, parameters and acceptance](P0A_ACTUATOR_MODEL.md).
