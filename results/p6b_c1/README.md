# P6B snapshot execution

Current status: actuator contract resolved; real OpenWater E1/E2 planning rejected by strict KKT. Local simulation only. No validated tracking, real-vessel control, periodic replanning or P6C.

Run in WSL, using a fresh result directory to preserve evidence:

```bash
cd /home/zy/work/all-in-planner
export LD_LIBRARY_PATH=/home/zy/.local/casadi-3.8.1-gcc/lib
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
build/p5b-linux/cpp/lifted_stp/openwater/p6b_openwater_server \
  8771 research/lifted_stp/results/p6b_c1/new-run \
  cpp/lifted_stp/openwater/execution/config/feedforward.json
```

Server binds localhost, accepts one browser session and one pending snapshot solve; stdin `QUIT` stops it. Network and the single solve worker are separated so held-state transport continues. This is not moving-horizon handoff, solver parallelization or an automatic solve timer. Existing P5D runtime, N=80, implicit midpoint and exact Hessian remain unchanged.

Serve OpenWater `site` on 8089. Open `http://127.0.0.1:8089/?debug&p6b&planner=ws://127.0.0.1:8771`, start simulation, select Calm, then PRECONDITION 2 M/S. This separate debug harness applies bounded manual 0..200 N commands until |u-2|<0.08 m/s for 3 simulation seconds, or stops after 120 s. It holds actual state and command without writing physical state. PLAN SNAPSHOT publishes the paired held state/obstacle sequences. E1: 50 m, zero lateral endpoint. E2: 80 m, +3 m endpoint. Calibration: 80 m, +1 m endpoint. E1 uses the same joint formulation without new straight-path constraints.

Only SUCCESS plus execution_capable enables EXECUTE LAST PLAN. Execute rechecks the physical snapshot: time tolerance 1e-9 s; scalar state tolerance 1e-8 in field units; obstacles unchanged. It claims EXTERNAL and sends a fresh first command while held. Browser acknowledges ownership/freshness, server sends ARMED, then simulation resumes. Physical-time piecewise-linear commands use `simulation_time-source_time`, nominally at 50 Hz. Existing wall-clock transport freshness does not drive plan progress.

Completion holds the final command for one advancing state cycle, then sends neutral -> MANUAL -> COMPLETE. Local abort sets neutral/MANUAL, invalidates external input and releases hold before notifying the server. Disconnect/0.5 s timeout abort via unchanged CommandMux. No actuator state reset. P6A without `p6b` stays visualization-only.

Errors use the frozen planner frame: ey=yd-y, epsi=wrap(psid-psi), eu=ud-u, er=rd-r. Tc=Tc_ff+Ku*eu; dc=dc_ff+Ky*ey+Kpsi*epsi+Kr*er; amplitude and command-rate bounds follow. Only the boundary adapter reflects final steering. Gain units: N/(m/s), rad/m, rad/rad, rad/(rad/s). Default gains are zero for feedforward diagnostics; candidate gains are an unrun proposal, not accepted gains.

Plan JSON stores original state, capability, decision, solver metrics and config. Execution JSONL records desired/actual state, FF/FB/final commands, raw/effective thrust, steering, saturation and source clock. Runtime config/capability identity fingerprints are explicitly FNV1a64, not cryptographic; artifact manifests use SHA-256. Internal command buffers stay in C++.

From the OpenWater directory on Windows, use the existing Three.js loader:

```powershell
node --disable-warning=ExperimentalWarning --import ./tests/register-three.mjs tools/p6b-protocol-loopback.mjs
node --disable-warning=ExperimentalWarning --import ./tests/register-three.mjs tools/p6b-direction-diagnostic.mjs
node --disable-warning=ExperimentalWarning --import ./tests/register-three.mjs tools/p6b-run.mjs
```

Loopback uses a manufactured plant and proves protocol/order only. The real Boat calibration tool currently exits with planning failure, not successful tracking. See root `P6B_CONTRACT_RESOLUTION.md` and results validation.
