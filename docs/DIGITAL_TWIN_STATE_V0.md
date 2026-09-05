# Digital Twin State v0

USV-1 is a one-way observation layer, not a renderer rewrite or a network client.

```text
DriveController → existing Boat (240 Hz native physics)
                           ↓ after Boat.update(frameDt)
                  SimulationStateSource
                           ↓
                  reusable VesselState v0
                           ↓
               debug HUD / requested snapshot
```

Camera, audio, ocean and effects retain their existing Boat dependencies. State
projection never steps physics or sends commands. No LIVE, REPLAY, WebSocket,
Qt, ROS, sensors or new plant is implemented.

## Complete contract

All vectors and quaternions are plain objects. No Three.js, scene, DOM, callbacks
or Boat references occur in the state. Numeric values use SI units.

| Field | Meaning / units / frame |
| --- | --- |
| schemaVersion | Integer 0 |
| vesselId | `usv001` by default; constructor override supported |
| source | `SIM` only in this version |
| sequence | Monotonic projection counter, including pre-start render frames |
| timestamp | WaveField simulation time, seconds, not Unix time; pauses before Start |
| pose.position.{x,y,z} | Absolute local-world ENU position, metres |
| pose.orientation.{x,y,z,w} | Unit quaternion, ENU-basis rotation; identity points north |
| pose.headingRad | Navigation heading, north 0, east +π/2, clockwise, [-π,π] |
| velocity.linear.{x,y,z} | Ground velocity, ENU m/s, not water-relative |
| velocity.angular.{x,y,z} | World angular velocity, right-hand ENU, rad/s |
| velocity.body.{surge,sway,heave} | Named body scalars, forward / starboard / up, m/s |
| velocity.body.{rollRate,pitchRate,yawRate} | Body angular components with nautical signs: starboard-down / bow-up / clockwise, rad/s; not Euler derivatives |
| control.throttleCommand, steeringCommand | Original Boat commands, [-1,1] |
| control.actualSteeringRad | Original speed-reduced `_effSteer`, radians; visual smoothing remains separate |
| control.propulsion.type | `single_outboard` (one equivalent physical thrust source) |
| control.propulsion.thrustN | Signed actual thrust after immersion, heel and advance reductions, N |
| control.propulsion.ventilationFactor | Original `propWet`, 0 dry/no thrust to 1 immersed; does not include heel or advance reduction |
| attitude.rollRad, pitchRad | Starboard-down roll / bow-up pitch, radians |
| attitude.yawRad | Same navigation heading as pose.headingRad; not ENU rotation about +Z |
| environment.seaState | Original preset index: 1 Calm, 2 Moderate, 3 Rough, 4 Storm; 0 before first projection |
| environment.localWaterHeight | Surface elevation at COM, metres up |
| environment.waterVelocity | Total sampled orbital + current velocity, ENU m/s |
| environment.current, wind | Original current / true wind vectors, ENU m/s |
| dynamics.planingForceN | Actual last-substep upward planing force, N |
| dynamics.centerOfPressure | Actual last-substep planing application point, absolute ENU metres; when force is zero, COM reference only |
| dynamics.submergedPoints | Count of positive-depth hull points in last substep, 0–8 for Zodiac |

Force diagnostics are sampled before the final native integration substep;
pose/velocity are sampled after it. They can differ in timestamp by at most one
physics step. Reset clears diagnostics. Before simulation starts, the initialized
diagnostics and cached environment velocities may still be zero.

## Coordinates and signs

Open Water stays X east/starboard, Y up, Z north/bow. Nothing inside physics is
axis-swapped. Let P exchange Y and Z; det(P) = -1:

```text
polar:      (x,y,z) → (x,z,y)           position, linear velocity
axial:      (x,y,z) → (-x,-z,-y)        angular velocity, torque
quaternion: (x,y,z,w) → (-x,-z,-y,w)    R_ENU = P R_OW P^-1
```

All three transformations are their own inverses. Quaternion conversion changes
both body and world basis: the identity ENU-local axes are starboard +X, bow +Y,
up +Z. It is **not** a quaternion with an assumed +X-forward vehicle frame. A
future FRD telemetry producer must explicitly adapt its body basis.

OW body angular velocity is first rotated into OW world, then converted as an
axial vector. Treating angular velocity like position would reverse turn signs.
Navigation yaw rate is clockwise and therefore opposite ENU world angular Z
for a level vessel. At finite roll/pitch, a body yaw component is not exactly a
heading derivative. Body scalar mapping is surge=v.z, sway=v.x, heave=v.y;
rollRate=-omega.z, pitchRate=-omega.x, yawRate=omega.y.

Steering commands retain upstream signs: positive command produces transom +X
force and negative OW yaw. This layer does not reinterpret A/D or change forces.
Heading is geometrically ill-conditioned when the bow points vertically; no
navigation estimator or attitude fusion is claimed.

## API, lifetime and validation

`VesselStateSource` requires `update()` and `getState()` and provides `snapshot()`.
`SimulationStateSource(boat, waveField, vesselId)` reads injected dependencies;
it has no globals, renderer or network. `getState()` returns an internal mutable
object for read-only consumption. Nested objects are reused. Only explicit
`snapshot()` calls allocate a deep JSON-safe copy.

With `?debug`, `window.openWater.twin.getState()` returns a **snapshot**; changing
it cannot modify the source or Boat. The debug HUD reads internal state at 5 Hz.
The optional `?debug&validate=drive` acceptance driver records actual API snapshots
at its five sample events. No per-frame serialization is introduced.

`validateVesselState()` checks exact v0 shape, finite values, plain-object
prototypes, quaternion norm, identifiers and basic ranges. It rejects additional
fields, callbacks, Three objects and malformed states; it is opt-in, not run in
the production frame loop. Tests cover polar/axial inverses, quaternion headings
0/±90/180°, nonplanar rotation and cross-product consistency, source projection,
JSON round-trip, malformed values and snapshot isolation.

## Regression and cost

The original USV-0 fixture is untouched. Additional USV-1 CoP fixtures were
recorded from ee4698f before modifying Boat. Four 30-second deterministic runs
with live wake feedback compare **exactly**, with projection active every frame:
position, quaternion, linear/angular velocity, planing force, body CoP, wave
height and wake count. Maximum absolute difference is **0**.

On Node 24.12.0 / Windows x64, projection median was 1.479 μs over seven batches
of 200,000 calls. Post-GC retained heap change after another 200,000 calls was
-6,656 bytes (measurement noise, not an allocation rate). There are no explicit
per-frame arrays, vectors, deep clones or serialized strings in projection.
The same-process interleaved full CPU pipeline benchmark rose from 119.565 to
123.799 μs per 60 Hz frame (+3.54%), including the native 240 Hz plant and wake.
This excludes GPU rendering and does not claim a browser frame-time guarantee.
