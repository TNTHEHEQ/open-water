# P6A OpenWater visualization adapter

**MANUAL, visualization-only snapshot planning.** No control-mode or actuator-command output. No tracking, plant-model parity, periodic replanning or real-time claim.

## Build and run in WSL Ubuntu-22.04

Added distro dependencies: libboost-dev / Boost 1.74 headers and nlohmann-json3-dev 3.10.5. Beast/Asio uses header-only Boost.System and standard threads. One network event loop receives latest data while the calling thread runs one manual solve; no parallel planner/collision evaluation.

    cd ~/work/all-in-planner
    /home/zy/deps/p5b-venv/bin/cmake -S . -B build/p5b-linux -DLIFTED_STP_BUILD_OPENWATER=ON
    /home/zy/deps/p5b-venv/bin/cmake --build build/p5b-linux --target lifted_stp_openwater_server p6a_openwater_tests
    export LD_LIBRARY_PATH=$HOME/.local/casadi-3.8.1-gcc/lib
    export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
    build/p5b-linux/cpp/lifted_stp/openwater/lifted_stp_openwater_server 8765 build/p6a-records

Second WSL terminal:

    cd ~/work/open-water
    /home/zy/deps/p5b-python312/bin/python -m http.server 8089 --bind 127.0.0.1 --directory site

Windows browser: http://127.0.0.1:8089/?debug&planner=ws://127.0.0.1:8765

Click Start Simulation. OpenWater owns the deterministic moving-circle scenario and publishes paired snapshots. In native terminal type PLAN_ONCE or press Enter. STATUS prints accepted counts; QUIT stops. No timer triggers planning. Port and record directory are positional arguments. Loopback only; Windows/WSL localhost was tested, no portproxy needed.

Native store retains only latest ownship/obstacles. A new session invalidates the old snapshot. A plan freezes source state/time and obstacle sequence. Receipt age >2 s or ownship/obstacle simulation-time difference >0.1 s gives STALE_INPUT. Obstacle position is predicted to exactly ownship time. Reset/reconnect during solve suppresses the old-session result.

## Model scope

VISUALIZATION_ONLY_MODEL_MISMATCH. Observed ENU position/heading define the local reference origin/heading. Observed u/v/r and actuator actual/command fields are parsed, transformed and logged separately.

Explicit P6A initialization profile SYNTHETIC_CRUISE_2_MPS: u=2 m/s, v=r=0, T=82 N, Tc=82/1.1 N, delta=deltac=0. It is not a conversion from normalized propulsion or measured thrust. 82 N is frozen synthetic cruise equilibrium (25*2+4*2^3). Pose always originates from the actual snapshot. This permits visual planning for a stationary/drifting/manual boat using a different plant. It is not physical parity.

ACTUATOR_COMMAND_MAPPING_DEFERRED_TO_P6B: normalized propulsion, raw/effective thrust and mechanical/effective steering have no validated correspondence to T/delta/Tc/deltac. No inverse chain.

Unchanged P5D runtime: N80, straight 100 m local reference, implicit midpoint, exact Hessian, synthetic physical model, footprint_v2, full-hull banks, 0.5 m obstacle buffer, original objective/weights/options and automatic enrichment. Zero or one obstacle is supported; >1 returns FAIL explicitly, never silently ignores obstacles. Wire transport accepts <=32.

## Coordinate contract

See repository-root P6A_INTERFACE_AUDIT.md and frame_adapter.hpp. H0 is snapshot navigation heading; E0,N0 is ENU origin:

    x = sin(H0)*(E-E0) + cos(H0)*(N-N0)
    y = -cos(H0)*(E-E0) + sin(H0)*(N-N0)
    psi = wrap(H0-H)
    u = surge; v = -sway; r = -yawRate
    E = E0 + sin(H0)*x - cos(H0)*y
    N = N0 + cos(H0)*x + sin(H0)*y
    H = wrap(H0-psi)

Planner y is port; psi/r counterclockwise about up. Positive delta produces positive body-y force, not an OpenWater mechanical-angle mapping. OpenWater yawRate is a body component under roll/pitch, not an Euler heading derivative; P6A is only a planar projection.

## Wire contract and budgets

Browser -> server: exact v1 hello, simulation_state/full TwinState v1, obstacle_state. 65536 input bytes, <=32 obstacles, finite SI values, unique IDs <=64 chars, positive radius, CONSTANT_VELOCITY. Ownship/obstacle sequences independently increase; backward time rejected.

Server -> browser: only planned_trajectory, with:
- protocol_version=1; type=planned_trajectory; sequence; bounded plan_id;
- source_state_sequence; source_simulation_time [s]; obstacle_sequence;
- status SUCCESS / FAIL / STALE_INPUT / INFEASIBLE / SOLVER_ERROR;
- points: t_rel [s], x [east m], y [north m], heading_rad [clockwise from north], speed_mps;
- optional diagnostics: finite solve_time_sec, min_clearance_m, objective.

SUCCESS: 2..256 points; strictly increasing t_rel starting at zero. Failure: empty points. Trajectory UTF-8 limit 262144 bytes. N80 emits 81 nodes. Full decisions/KKT/enrichment/effective solver options stay on disk. Serializer cannot emit a legacy control type.

Legacy parser retains 4096-byte control budget and PlannerBridge default control semantics, covered by original tests. Main application explicitly selects visualizationOnly=true, rejecting both legacy control types before CommandMux. No EXTERNAL claim.

## Rendering, recording, reset

PlannerVisualizationGroup contains cyan plan, yellow actual trail, red physical circle/cylinder, translucent radius+0.5 m ring and orange constant-velocity prediction using plan horizon (50 s until first plan). Ring excludes ownship-circle radius. Existing ENU adapter maps (E,N,height) to Three (E,height,N); sampled water height+0.2 m display offset. Prediction overlays ocean. No collider, physics or shadow registration.

Plan buffer only updates on replacement; prediction/trail update at 10 Hz. Fixed capacities: plan 256 vertices, trail 2000, <=32 obstacle objects. Failures clear only plan. Hidden visualization continues collecting actual track. Reset clears trail/plan, reseeds simulator truth at current simulation time and reconnects/hello to explicitly invalidate native snapshot. Existing manual Boat reset remains unchanged.

HUD exposes connection, MANUAL mode, sequences, source/receipt time, plan age/size/solve time and CPU counters. Download plan log exports <=100 per-plan records separately; existing 50 Hz CSV recorder unchanged. Stale trajectories never execute.

## Tests

CTest p6a_openwater_tests: cardinal golden positions/signs, JSON/limits, stale/sequence/reset, serializer, >1 obstacle rejection.
OpenWater: npm test and npm run lint:js.
Windows Node: node tools/p6a-native-loopback.mjs spawns isolated native WSL server on 8767, tests stale input and genuine solve. WSL forwarding startup retries bounded to 6 s. This is a test client, not a proxy.
check_preservation.py checks 847 frozen Python hashes, P5D source/report hashes and unchanged OpenWater physics/control/Twin projection files.

P6B remaining: validated physical model/actuator mapping, observed-state initialization, controller/tracking and explicit authority/safety design. None implemented.
