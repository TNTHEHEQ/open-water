# P6A validation — PASS

Date: 2026-09-21. This phase proves interface, coordinates and visualization, not OpenWater closed-loop tracking.

## Baselines and files

Planner branch: codex/p6a-openwater-visual-integration, base 35d353dc7a7d960bf356b261a88f85bf9d993201.
OpenWater branch: codex/p6a-planner-visualization, base **test** cdefdd6643a64b6c0d183fd7261e07ba3df7192f, not main.
The commits containing this report are the implementation commits; IDs are provided in delivery metadata to avoid self-referential hashes.

Planner existing-file change: optional CMake target integration only. New adapter/server/tests/docs in cpp/lifted_stp/openwater; evidence in research/lifted_stp/results/p6a.
OpenWater existing-file changes: main.js, bridge/protocol.js, bridge/planner-bridge.js, twin/coordinate-adapter.js. New scenario, visualization, separate planner log, tests and native loopback tools. Boat, actuator, CommandMux, TwinState source/schema, ExperimentRecorder, assets and vendor unchanged.

Repository-root P6A_INTERFACE_AUDIT.md was written before implementation. Native README and OpenWater docs/P6A_VISUAL_INTEGRATION.md contain exact launch commands and interface contracts.

## Protocol and runtime

Browser WebSocket CLIENT; native C++ SERVER. Ubuntu22.04/GCC11.4/CasADi3.8.1/IPOPT3.11.9/exact Hessian. Added Boost1.74 Beast/Asio and nlohmann-json3.10.5 distro headers. No Python proxy, embedded Node or Socket.IO. Network event loop receives latest state during snapshot solve; no parallel planner computation.

Retained v1 hello/simulation_state/control semantics. Added obstacle_state and planned_trajectory. Controls retain4096-byte limit; trajectories262144 bytes/256 points; native input65536 bytes; obstacles max32 on wire. Finite values, fields, sizes, positive radii, IDs, sequence/time/status validated. Native frozen problem supports zero or one obstacle; greater counts explicitly FAIL, never silently ignored.

Latest-only store freezes ownship/obstacle sequences/time. Receipt age limit2s, pair simulation skew0.1s; obstacle propagated to ownship source time. Enter/PLAN_ONCE only; no automatic timer. Reset reconnect invalidates generation and suppresses old-session result. Only outbound message is planned_trajectory. P6A browser rejects legacy controls before CommandMux; default standalone bridge semantics remain compatible.

## Coordinate gate — PASS

Source-verified planner abstract x is reference-forward, y port; psi0 along+x, psi/r counterclockwise about up. u forward, v port. Positive delta generates positive body-y thrust; frozen negative xp yields negative yaw torque. No actuator command equivalence is inferred.
OpenWater ENU east/north/up, heading north0/east+pi/2 clockwise, sway starboard and body yawRate clockwise. Freeze origin E0,N0 and heading H0:

    x = sin(H0)*(E-E0) + cos(H0)*(N-N0)
    y = -cos(H0)*(E-E0) + sin(H0)*(N-N0)
    psi = wrap(H0-H)
    u = surge; v = -sway; r = -yawRate
    E = E0 + sin(H0)*x - cos(H0)*y
    N = N0 + cos(H0)*x + sin(H0)*y
    H = wrap(H0-psi)

Obstacle velocity uses the same linear rotation. Existing renderer adapter maps ENU to Three(E,waterHeight+0.2,N). Cardinal golden positions, +/-90, round trips and sway/yaw signs PASS. Tilted body yawRate is not Euler heading derivative: planar projection only.

## Real Windows browser acceptance

Windows Codex In-app Browser rendered actual Three/WebGL OpenWater at http://127.0.0.1:8089/?debug&planner=ws://127.0.0.1:8765. WSL localhost forwarding PASS; no IP fallback or portproxy. Start Simulation then native CLI PLAN_ONCE. Final native evidence: final-native/plan-1.json.

| Metric | Observed |
|---|---:|
| State receive rate |49.977347 Hz|
| Obstacle receive rate |49.977347 Hz|
| Rate window |141.264s,7060 paired messages,0 invalid|
| Plan status |SUCCESS|
| Message bytes / points |11291 / 81|
| Planner workflow wall time |9.140851754s|
| Source bridge state sequence |998|
| Source simulation time |20.061000000s|
| Obstacle sequence |32159|
| Browser receipt sim time (rounded HUD) |29.38s|
| Plan age at receipt |approximately9.319s|
| Source-pose position / heading error |0m / 0rad|
| Objective |0.866108179160557|
| Planned minimum clearance |1.4316055008123385e-9m|
| Refinement rounds / added positions |2 / 4|

Plan starts at frozen source pose, not later drifting vessel position after latency. Age remains visible. Screenshot browser-acceptance.jpg records a separate successful rendering run (plans/plan-7.json,11.36s); final-native-dom.txt records the final detailed-log run above. Different IDs/metrics are distinct evidence, not a single run.

## Visuals, truth, recording

All five observed: Zodiac ownship, red moving circular obstacle, orange prediction, yellow actual trail, cyan plan. Simulator owns constant-velocity truth driven by simulation time; planner cannot mutate it. Physical radius and radius+0.5m safety ring are distinct; no ownship-circle radius represented as obstacle truth.

Fixed plan256-point buffer, updated on replacement. Actual trail2000 capacity at10Hz, keeps collecting while hidden. Obstacles/predictions10Hz; deletion/disposal bounded. No physics collider or shadows. Prediction overlays ocean. Group visibility/reset/disposal supported. Reset clears trail/plan, reseeds truth at current simulation time, reconnects explicitly; plan failures preserve actual track. Per-plan log max100 records, separate from50Hz CSV. Native-only records contain decisions,constraints,multipliers,command intervals,KKT,round timings and effective solver options.

## Tests and frozen evidence

- C++ adapter/protocol GTest9/9 PASS (gtest.txt).
- Selected integrated CTest6/6 PASS: P5A kernel, P5A fixture parity, P5C runtime, P5D template, P5D instance, P6A (ctest.txt). This is the selected regression set, not all legacy CTest targets.
- OpenWater npm243/243 PASS,0 failures,0 skipped; existing bridge/control,TwinState/physics included.
- ESLint PASS (lint.txt empty,exit0).
- Native loopback PASS: Windows Node->isolated WSL C++server, hello/state/obstacle/STALE_INPUT/real trajectory,81points,3.436144041s. Node is test client only.
- Tests cover malformed/oversize/nonfinite,sequence/stale,serializer/no control,cardinals,replacement,bounded trail,truth/update/delete/prediction,reset-before-start and hidden-history behavior.
- Visualization ON/OFF regression compares identical plant evolution; protected physics source diff empty.
- 847 frozen Python reference/result hashes and P5D source/report manifests unchanged. Original P3O known failures retained. P5B historical full solves were not rerun for visualization-only changes.
- Successful new C++ build has no warnings. Initial duplicate GTest macro label compile error was fixed; attempt evidence retained in build.txt. Existing ocean shader X3595 warning observed, no JS runtime failure; vendor unchanged.

## Cost (record only)

ON2.574ms/frame over5180 frames; OFF2.376ms/frame over17338; difference+0.198ms. Visual update mean0.002ms.81plan points,1obstacle,1206actual points at measurement(capacity2000). Sequential full-application observations affected by scene/load, not isolated benchmark or real-time certification. No planner performance optimization.

## Limits and final gate

VISUALIZATION_ONLY_MODEL_MISMATCH. ACTUATOR_COMMAND_MAPPING_DEFERRED_TO_P6B. Actual pose/heading anchor plan. Observed transformed u/v/r and actuator values logged separately. Explicit SYNTHETIC_CRUISE_2_MPS uses frozen synthetic u2,v=r0,T82,Tc82/1.1,delta=deltac0. This is not conversion of normalized OpenWater propulsion and not physical parity. Native one-obstacle limitation explicit. No independent OpenWater rollout/closed-loop tracking claim.

**P6A PASS**: actual TwinState and obstacle truth reached C++; real snapshot solve returned; browser rendered verified-coordinate plan/scenario; MANUAL retained; no planner commands; regressions/preservation PASS.

Explicit: MANUAL only; no EXTERNAL claim; no actuator mapping; no Boat physics edit; no planner formulation/model/objective/weights/threshold/footprint/bank/mesh change. Implicit midpoint and exact Hessian unchanged. No HS,inverse dynamics or P6B work. No push.

P6B remaining: validate physical model/actuator correspondence, observed-state initialization and thrust/steering units/signs, then separately design command authority and trajectory tracking acceptance. Work stops at P6A.
