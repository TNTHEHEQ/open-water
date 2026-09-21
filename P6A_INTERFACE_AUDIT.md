# P6A interface audit (before implementation)

Planner base: `35d353dc7a7d960bf356b261a88f85bf9d993201`, WSL `/home/zy/work/all-in-planner`, branch `codex/p6a-openwater-visual-integration`.
OpenWater base: `test`, `cdefdd6643a64b6c0d183fd7261e07ba3df7192f`, WSL `/home/zy/work/open-water`, branch `codex/p6a-planner-visualization`. No main changes. Initial network clone stalled; Windows Git protocol v1 sparse clone verified the requested commit and clean source tree, then copied to WSL. Remaining baseline assets will be content-hash verified. No AGENTS.md found in either repository or WSL parent directories.

## Actual interfaces

|OpenWater file|Contract|
|---|---|
|site/js/bridge/planner-bridge.js|PlannerBridge(mux,options), browser WebSocket CLIENT via new WebSocket(endpoint). Sends hello and simulation_state at configured 50 Hz, drops missed slots/backpressure; no historical queue. receive parses then can claim EXTERNAL in legacy mode.|
|site/js/bridge/protocol.js|v1 strict field validation for set_control_mode/control_command, original small-frame 4096 character cap. New trajectory budget must be type-specific, retaining small control budget.|
|site/js/twin/simulation-state-source.js|SimulationStateSource(boat,waveField).update() projects Boat diagnostics into reusable TwinState; timestamp=waveField.time. snapshot only on demand.|
|site/js/twin/vessel-state.js; docs/DIGITAL_TWIN_STATE_V1.md|Exact TwinState v1 schema; finite SI fields, schemaVersion=1, source=SIM.|
|site/js/twin/coordinate-adapter.js|Polar position/velocity OW(x,y,z) -> ENU(x,z,y), axial vectors (-x,-z,-y); navigation heading atan2(forward.x,forward.z).|
|site/js/control/command-authority.js|CommandMux initializes MANUAL; setMode/ external.receive/apply owns command sink. Selection never steps physics. P6A visual-only bridge must reject control messages before this path; legacy default class semantics stay tested.|
|site/js/simulation/outboard-actuator.js|Normalized propulsion lag and mechanical steering lag/rate limit; not planner T/Tc model.|
|site/js/simulation/boat.js:625-639|raw/effective thrust distinguished; force direction uses (sin(effSteer),0,cos(effSteer)). No edits authorized to physics.|
|site/js/experiments/experiment-recorder.js|50 Hz bounded CSV recorder from TwinState, start/stop/downloadCsv. P6A separate bounded plan JSON log avoids trajectory duplication per row.|
|site/js/main.js|Bridge starts after Start Simulation; projected state published once per animation frame subject to 50 Hz due-time gate. Debug HUD/window.openWater available. resetBoat retains simulation clock.|

Future C++ executable is WebSocket SERVER on loopback port 8765. No existing WebSocket or JSON dependency found in planner CMake/C++ sources. Boost.Beast headers and nlohmann JSON absent from host at audit. Proposed minimal distro packages: libboost-dev (header-only Beast/Asio error-code mode), nlohmann-json3-dev. No Python networking proxy, embedded Node, or Socket.IO.

## PlannerFrameContract (source-derived)

`cpp/lifted_stp/include/lifted_stp/core/types.hpp::rotate` implements R(psi)=[[cos,-sin],[sin,cos]]. `src/physics.cpp::time_rhs` uses p_dot=R(psi)[u,v], psi_dot=r; `outboard` uses [T cos(delta),T sin(delta),xp*T sin(delta)-yp*T cos(delta)]. `src/geometry.cpp::straight/frenet` uses tangent R(heading)[1,0], normal R(heading)[0,1].

The planner has **abstract Cartesian** global axes, not geographic labels: x is the straight reference advance direction, y its positive left normal when embedded into an east/north/up plane. psi=0 along +x; positive psi rotates +x toward +y (CCW about up in this embedding). u forward; v left/port; r positive same CCW rotation. Positive delta deflects positive thrust toward positive body y/port. With frozen xp=-1.2, yp=0 it creates negative r torque. This is a force-angle convention, not an OpenWater actuator command equivalence.

OpenWater source confirms ENU E/N/U, heading H north=0/east=+pi/2 clockwise, u=surge forward, v_OW=sway starboard, r_OW=yawRate clockwise body component. For tilted vessels body yawRate is not an Euler heading derivative; P6A is a planar visualization-only projection, not six-DOF model parity.

### Unique adapter equations

Freeze ENU origin (E0,N0) and navigation reference heading H0 at snapshot. Planner x aligns with snapshot bow, y points port. Let dE=E-E0,dN=N-N0:

- x=sin(H0)*dE+cos(H0)*dN; y=-cos(H0)*dE+sin(H0)*dN.
- psi=wrap(H0-H); u=surge; v=-sway; r=-yawRate.
- E=E0+sin(H0)*x-cos(H0)*y; N=N0+cos(H0)*x+sin(H0)*y.
- H=wrap(H0-psi). Obstacle velocities use the same linear rotation without translation.
- renderer uses existing enuPositionToOpenWater({x:E,y:N,z:waterHeight+0.2}) -> (E,height,N).

Coordinate semantics resolved from source; connection gate additionally requires North/East/South/West and +/-90 tests, including lateral/yaw signs and round trips. No connection before those pass.

## Runtime and model boundary

`runtime/planner_workspace.hpp::solve_instance` accepts a Cartesian-consistent initial NodeState and previous solver state. Canonical P5D: N80, straight 100 m reference, synthetic marine model, exact Hessian, implicit midpoint, frozen footprint_v2/banks/weights/safety buffer. Native runtime supports one optional moving circle (or static representative); protocol can carry <=32 but adapter must reject unsupported multiple-obstacle solves rather than silently ignore obstacles. Rebuild only runtime problem data, no kernel or NLP formulation edits.

ACTUATOR_COMMAND_MAPPING_DEFERRED_TO_P6B. Directly available: position, heading, body u/v/r, normalized actual/requested propulsion, raw/effective thrust N, mechanical/effective steering and commanded steering radians. Unresolved physical mapping: OpenWater raw/effective thrust versus planner T, normalized command versus Tc, mechanical versus force delta and Kdelta. P6A explicit synthetic initialization may use frozen model cruise equilibrium (u=2 m/s,T=82 N,Tc=82/1.1 N,delta=deltac=0), logged separately from observed state; never present as plant parity. Pose/heading always originate from the real snapshot. Native planar projected state is available separately; unsupported low-speed states can use explicitly selected synthetic-visualization profile. No propulsion mapping, no actuator command output.

VISUALIZATION_ONLY_MODEL_MISMATCH: P6A proves interface/coordinate/visualization, not OpenWater closed-loop tracking. Snapshot planning only, manual PLAN_ONCE. No periodic replanning. OpenWater owns deterministic simulation-time obstacle truth; server has no truth mutation message. Reset invalidates pending/old plans locally and must explicitly invalidate server snapshot via reconnect/hello.

## Implementation gates

1. New adapter tests before connection.
2. Protocol limits and invalid/sequence/stale tests; visual-only mode blocks both legacy control types, while standalone legacy class tests remain unchanged.
3. Independent visualization group never registered with Boat/collision/physics; bounded buffers, plan replacement, reset/dispose.
4. Real Windows browser -> WSL loopback -> real C++ snapshot solve -> rendered cyan path, yellow actual trail, red obstacle and orange prediction. MANUAL owner throughout.
5. Existing npm, bridge, TwinState/physics regression; unchanged planner mathematics/history hashes. Record time/rates/bytes/CPU and no tracking/real-time claim.

## Completion evidence

OpenWater test baseline fully restored; 216 Git blobs verified against object IDs. Cardinal tests passed before connection. Real Windows browser/WSL localhost and native snapshot solve passed. See P6A validation report for measurements and model limitations. Initial audit findings above are retained.
