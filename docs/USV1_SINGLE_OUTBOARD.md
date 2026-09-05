# USV-1 — Zodiac single outboard

Baseline: `ee4698fa69c888139af3cd1add633ba778bada15`, branch
`codex/usv-single-vessel-baseline`. Work branch:
`codex/usv-single-outboard-twin-state`. Original upstream:
`285b6ce32057c70191a7fe16c31d979fa383ac64`.

## Source audit: four separate systems

| System | Actual source / behavior before USV-1 | After |
| --- | --- | --- |
| Visual | `vessels.js` Zodiac `rig.regionMotors`; `VesselAnimationRig._rigRegionMotors` splits merged material meshes into two steering/propeller assemblies | `rig.singleOutboard.sourceMotors` describes original extraction regions; `_rigSingleOutboard` keeps one complete engine and centers it |
| Physics | `Boat._step`: one `propW`, one `thrustMag`, one force and r×F moment; equivalent rudder-lift force at same propPos also present | Exactly the same force math and integration |
| Effects | `BoatEffects.update` gets `_propPositions` from `getPropellerWorldPositions`; original two hubs emit two sources | Same code now receives one hub, including stern spray anchoring; no separate duplicate jet |
| Audio | `BoatAudio`: one selected `zefiro` engine bank, low/high RPM layers → engine filter/panner/bus | Same bank, pitch/gain and bus; these are RPM layers, not two engines |

The physical model was already a single equivalent outboard. Mass (1050 kg),
inertia, all eight buoyancy points, drag, planing, roll, thrust (10500/2700 N),
steer range (30°), propPos, ventilation, native integrator and 240 Hz budget are
unchanged. Only output assignments were added for actual diagnostics.

## Original model and real geometry audit

`site/assets/boats/zodiac_boat.glb` by **RedC130**, [Zodiac boat](https://sketchfab.com/3d-models/zodiac-boat-a10b7997f1514bd7829ece74f68c681c),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Binary unchanged.

Modified from the original twin-outboard visual configuration to a single centerline outboard configuration.

The original has 15 material meshes, 93,498 stored vertices and 121,490
triangles. It does **not** contain clean separately named motor nodes. Shared
`Collada_visual_scene_group` meshes use raw SketchUp coordinates. Original
connected-component region extraction is reused; no new geometric primitive or
negative scale substitutes for a motor.

Retained original first engine (raw X≈56, vessel starboard side):

| Mesh / material | Body triangles | Propeller triangles |
| --- | ---: | ---: |
| Material3 / Zodiac_NEUTRE | 1865 | 844 |
| Material3_1 / Zodiac_gris_fonc | 779 | 264 |
| Material3_2 / Zodiac_Gris | 1030 | 0 |
| Material3_3 / Zodiac_Blanc | 44 | 0 |
| Material3_4 / Zodiac_Noir | 12 | 0 |
| Material3_12 / Zodiac_Beige_sombre | 0 | 580 |

Both original motors are first extracted from the fixed meshes. The second is
removed from the scene, its derived geometry disposed, and its animation entries
removed. Shared materials remain valid. The complete first assembly (5,418
triangles, including 1,688 propeller triangles) is moved, not mirrored. Cloned
geometry contains unused hull vertices: extracted bounds now use rendered
indices, avoiding a false whole-hull bounding box and bad culling after centering.

Normalization remains the original Boat.loadModel operation, target length
5.5 m, reversed model, scalar 0.013306549449072351. Final bounds remain
2.067484 m beam × 1.874207 m height × 5.5 m length.

## Measured anchors

All vessel coordinates below are the unchanged **OW local** X starboard/Y up/Z bow.

| Anchor | Original first | Original second | Centered |
| --- | --- | --- | --- |
| Raw steering pivot | (56,38,48) | (100,38,48) | **(78,38,48)** |
| Raw propeller hub | (56,2,20) | (100,2,20) | **(78,2,20)** |
| Local steering pivot m | (0.288575,0.038714,-2.245093) | (-0.296913,0.038714,-2.245093) | **(-0.004169,0.038714,-2.245093)** |
| Local propeller hub m | (0.288575,-0.333869,-2.724128) | (-0.296913,-0.333869,-2.724128) | **(-0.004169,-0.333869,-2.724128)** |

The 4.17 mm residual X follows the original engine average instead of inventing
a visual alignment. Retained motor bounds are X[-0.150454,0.154597],
Y[-0.488656,0.493517], Z[-2.750000,-2.165265] m.

The **physical** equivalent force anchor remains (0,-0.343,-2.585) m; it is not
silently relocated to the visual hub. In Calm equilibrium the visual hub stays
near its original immersion depth. Wave/planing ventilation is still possible.
No physics waterline or ride-height adjustment was made.

```text
model / Collada_visual_scene_group
├── fixed original hull material meshes (both motors extracted)
└── SingleOutboard
    └── SteeringPivot
        ├── original body/lower-unit material fragments
        └── PropellerPivot
            └── original propeller material fragments
```

Steering retains `_effSteer` and the original exp(-9 dt) visual smoothing. Raw
SketchUp +Z is the steering axis (maps to vessel +Y); propeller raw +Y maps to
vessel +Z. Spin remains throttle × (8+42|throttle|) × dt, original handedness +1;
reverse reverses spin, zero throttle stops it. There is no hidden second propeller
in the update arrays. Hull wake, Kelvin wake, foam trail and wave physics code
are unchanged.

## Regression and browser acceptance

Previous tests: **175/175**. Final USV-1 suite: **192/192**, zero failures or skips.
JS and HTML lint pass. `npm run check` fails only its existing coverage gate:
line coverage 31.22% / required 60%, function coverage 37.83% / required 50%.
Coverage mode runs 190 passes and two pre-existing isolated-integration skips;
those two integration suites run in the normal 192-test invocation. The gate
already failed at baseline and was not relaxed to produce a green check.

Original USV-0 fixture remains unchanged. New CoP-inclusive fixture was recorded
before editing Boat, with seed 987654321, four seas, 30 seconds each, 60 Hz frames,
240 Hz physics and live wake feedback. State projection enabled after every frame:
**position/quaternion/linear/angular/planing/CoP/wave/wake max error = 0**.
Real-GLB tests compare retained triangle indices and materials with the original
first engine, fixed hull indices with the original two-engine extraction, exactly
one steering pivot/propeller/effect hub, positive scales, spin and steering signs.

Actual browser, Ultra / 240 Hz, optional real DriveController key sequence:

| Event | u m/s | OW yaw rate rad/s | Root Y m | Wake sources |
| --- | ---: | ---: | ---: | ---: |
| Forward t≈5 | 15.0749 | -0.0009 | 0.0417 | 10 |
| D / positive steering t≈9 | 6.5417 | -0.8211 | 0.1707 | 31 |
| A / negative steering t≈14 | 6.7980 | +0.8157 | 0.1236 | 56 |
| Neutral/coast t≈20 | 5.2824 | -0.0022 | 0.1872 | 90 |
| Reverse t≈32 | -5.5451 | -0.0002 | -0.0213 | 96 |

These browser samples are real-time rather than deterministic fixed-frame runs;
the exact zero-delta evidence comes from the fixtures, not rounded browser values.
The upstream A/D yaw sign is retained and explicitly not relabeled as a different
physical steering law. Original 30° limit remains, reduced at speed. Screenshots
show visual +0.286 / -0.277 rad during positive/negative full command, tracking
the physical +0.301 / -0.322 rad with original smoothing.

Calm static remains finite near Y≈0.18 m. Further no-throttle browser samples:
Moderate t103.57 s, Y0.230 m; Rough t188.09 s, Y0.982 m; Storm t238.09 s,
Y-0.775 m. All modes rendered without NaN or application errors, with one
steering pivot, propeller and jet anchor. Drift follows existing wind/current.
Console observed **0 errors / 0 warnings**.

The final clean-origin browser load also recorded all five samples through the
actual `window.openWater.twin.getState()` API. All snapshots passed the strict
v0 validator. Forward thrust was 7954.13 N; reverse -2467.63 N; neutral 0 N.
The single propeller accumulated 104.68→304.64→554.62 rad through forward/turns,
stayed at 604.65 rad while neutral, then reversed to 39.87 rad. These are visual
animation angles, not measured shaft RPM. Captured in ignored
`artifacts/usv1/drive-with-twin.json`.

Ignored screenshots: `artifacts/usv1/single-outboard-{center,port,starboard,running}.png`.
Ignored metrics include drive-calm.json, four-sea debug text, model-before/after
geometry audits and benchmark reports. No assets were downloaded or altered.

## Performance and limitations

One-off `npm run benchmark` wave-only samples changed 2044→2555 ns and spectrum
455→558 ns while browser load differed. Wave code is byte-identical; these
isolated wall-clock measurements cannot attribute that noise to this patch.
The paired same-process benchmark alternates ee4698f and the modified plant nine
times, with identical water/wake and states: 119.565→123.799 μs per simulated
frame, **+3.54%**, including state projection. Reproduce using
`node --import ./tests/register-three.mjs tools/usv1-benchmark.mjs`.

This is still the original generic hand-rolled physics, not a calibrated real
single-engine vessel. No new RPM/KT/KQ/differential-thrust law was invented.
The visual mask and physical propPos are unchanged approximations. Model detail
does not imply hydrodynamic accuracy. Renderer decoupling, LIVE/REPLAY and
WebSocket/Qt are future work; this phase only establishes one-way SI/ENU state.
