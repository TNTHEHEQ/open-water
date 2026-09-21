# P6B-C1 validation

**Actuator contract: ACTUATOR_CONTRACT_RESOLVED. Overall P6B: FAIL.**

The authorized bidirectional steering mapping is implemented and tested. Real OpenWater calibration, E1 and E2 snapshots fail strict KKT during planning. No failed plan was executed. Formal gain calibration, frozen tracking thresholds and E1/E2 tracking acceptance remain unfinished. No P6C work.

## 1. Branches and commit provenance

Planner branch `codex/p6b-openwater-execution`; requested checkpoint `8079e229d410b7dd4e5bd2883716cfde7801f642`. During this work an unrelated paper commit `225bb8c2d9ba31902e0af1ba6a6f5a4117bba09d` became HEAD; it is preserved, not reset or amended. OpenWater branch `codex/p6b-plan-execution`; parent `621462d38a539ceb9cf4c8ed08327dfd33845883`. Final C1 commit identities are supplied in the delivery record (a commit cannot embed its own hash).

P6A baselines: planner `b6e992d18915029800cf56d271101717141009a5`, OpenWater `e6951ac506e751ef28ec2897e8db719e59c3c362`. P5D remains `35d353dc7a7d960bf356b261a88f85bf9d993201`. GCC 11.4, CasADi 3.8.1, IPOPT 3.11.9, exact Hessian, N=80, unchanged implicit midpoint and runtime. No push.

## 2–7. Authorized contract, profile and preservation

Root `P6B_CONTRACT_RESOLUTION.md` documents the superseded same-sign requirement, complete coordinate/actual/command/rate equations, asymmetric interval reflection and capability intersection. Original STOPPED audit and minimal reproductions are retained unchanged. Mapping is centralized in `execution/actuator_adapter.hpp`; there are no compensating signs in the controller or network handler.

Actual initialization uses rawThrustN, authoritative command times sign-dependent raw-force gain and reflected actual/command mechanical steering. P6A lateral/yaw reflection applies once. Integration KT=Kdelta=1; active tauT=0.6 s, tauDelta=0.35 s. Actual T<=220 N, command Tc<=200 N, actual |delta|<=0.5 rad, command |deltac|<=pi/6, command rates <=20 N/s and 0.15 rad/s, sigma in [0.25,1] s/m. The integration envelope is not expanded to use the plant's 10500 N capability. Actual steering-rate audit uses pi/4 rad/s. Frozen profiles remain unchanged.

`preservation.json` verifies 847 frozen Python hashes, 49 P5D source hashes, 7 P5D report hashes, P5A fixture hashes and empty frozen-core/history diffs. Thirteen OpenWater simulation/control/Twin files have recorded SHA-256 and no change against P6A. The earlier P3O seven failures and all P0–P5 evidence remain historical, not relabelled as fixed. This is selected regression plus preservation, not a rerun of every costly historical benchmark.

Native cardinal tests pass at North/East/South/West for +/-0.1 and zero steering; they compare reflected force vectors to 1e-12 N and verify yaw signs. Mapping tests include positive/negative/zero actual and commands, round trips, actual/command rates, asymmetric bounds, unit-gain back-substitution, non-clamped actual initialization, command boundary floating-point round trip and rejection outside the domain. Reverse mapping is unit-tested but reverse planning is unsupported.

## 8. Controller direction and calibration

All errors are desired minus actual in the frozen plan frame. Positive planner delta produces negative planner yaw acceleration. Independent +/-0.04 rad mechanical Boat runs therefore support negative Ky/Kpsi/Kr. After 8 s:

| Mechanical OW command | Planner heading | Planner yaw rate | Planner lateral y |
|---|---:|---:|---:|
| -0.04 rad | -0.0907474 rad | -0.00955878 rad/s | -0.483527 m |
| +0.04 rad | +0.0782938 rad | +0.01321894 rad/s | -0.335745 m |

This is differential response with residual drift, not zero-drift tracking/model parity. Max actual steering rate was 0.11025248 rad/s; limiter not triggered. OpenWater `controller-directions.json` retains details. Existing actuator step diagnostic and Euler-versus-continuous response evidence remain in the original `results/p6b/actuator-audit.json`.

Feedforward-only calibration (all four gains zero) failed at the solve gate. The predefined 3x3 gain proposal is NOT_RUN and no gain selection is claimed. `p6b_acceptance_contract.json` explicitly records NOT_FROZEN with null thresholds. E1/E2 here are planning-only diagnostics; no formal tracking result was used to choose thresholds or retune gains.

## 9. Hold, snapshot, arming and playback

Implementation: dt=0 hold without physical-state writes; paired state/obstacle sequence request; snapshot and capability match; first command and EXTERNAL ownership while held; browser acknowledgement; ARMED then resume; simulation-time command interpolation; last-command one-state hold then neutral/MANUAL/COMPLETE. Abort is local neutral/MANUAL before notification; disconnect and unchanged 0.5 s timeout return ownership safely. All actuator commands pass existing PlannerBridge -> ExternalCommandSource -> CommandMux.

Native server/Windows Node loopback PASS: 81 plan points, 1111 command-sink applications, 0 timeouts, EXTERNAL -> MANUAL, completion at simulation time 27.06 from source 5.0 s. Two final MANUAL calls are idempotent (server and local completion). This loopback uses a manufactured state u=2 m/s, T=Tc=82 N; it is explicitly NOT the real 6DOF plant or E1/E2 acceptance. Latest native JSONL includes configuration/capability FNV1a64 identity and source-clock associations; artifact manifests use SHA-256.

## 10–11. Real calibration and browser E1/E2 diagnostics

Calm-wave preconditioning applies manual actuator commands bounded to 200 N until |u-2|<0.08 m/s for 3 simulation seconds, then holds the actual state. It is separate from the planner tracking controller. The real snapshot contains nonzero measured sway/yaw and actual raw thrust near 200 N; none is replaced by a synthetic equilibrium.

| Scenario | Source sequence | Source sim time (s) | Initial u (m/s) | Iterations | Solve time (s) | Primal residual | Dual residual |
|---|---:|---:|---:|---:|---:|---:|---:|
| Calibration, 80 m / +1 m | 2 | 19.2000 | 2.05725467 | 106 | 3.789996 | 0.2274504 | 1.2857842 |
| E1, 50 m / 0 m | 6196 | 20.7329 | 2.07971758 | 192 | 10.186498 | 0.1394603 | 2.0797182 |
| E2, 80 m / +3 m | 45188 | 107.1770 | 2.07441730 | 114 | 4.409655 | 0.2229440 | 1.2965108 |

All three: `Infeasible_Problem_Detected`, `SOLVER_FAILED_DURING_REFINEMENT: strict KKT rejected`, runtime SOLVER_FAILURE. Full actual initial vectors, plant capabilities, unaccepted decision iterates, controller config and IPOPT effective options are retained in `feedforward/` and `browser/`. Returned iterates are NOT accepted plans.

Both real Windows browser cases displayed SOLVER_ERROR, MANUAL, disabled EXECUTE and RX command sequence -1. Source and receipt simulation time were identical to displayed precision while HOLD; after rejection the simulator resumed in neutral/MANUAL. Screenshots/DOM in OpenWater `results/p6b_c1/browser/` show failed planning, not execution success. No cyan accepted plan or EXTERNAL tracking screenshot exists.

**Formal E1/E2 tracking: NOT_RUN.** Max/RMS position, along/cross-track, heading/speed/yaw errors, terminal tracking, raw actuator tracking and saturation fractions are N/A, not zero or PASS.

## Failure analysis: confirmed facts versus hypothesis

Confirmed: the three rejected solutions violate the first surge equality by -0.2274504, -0.1394603 and -0.2229440 m/s respectively. Their first midpoint Cartesian consistency residuals are approximately 4e-13. Frozen `problem_instance.hpp` sets first-interval sigma=1/initial Cartesian forward speed. Frozen midpoint path consistency then fixes interval-midpoint Cartesian speed to that initial value. Actual raw thrust is about 200 N, while frozen synthetic surge hydro at these speeds is about 86–88 N.

Hypothesis: this initial sigma/midpoint restriction, together with the synthetic plant's acceleration and conservative command-rate envelope, explains the inability to satisfy the measured initial state. This is not a global infeasibility proof or a claim that every real snapshot fails. No formulation, first-sigma equation, state, command interpolation, physical model, mesh or threshold was changed to conceal the result.

`analyze_initial_interval.py` recomputes these diagnostic quantities from the archived iterates and produces `initial_interval_diagnostic.json` without solving or editing the reference. Investigating admissible initialization/first-interval contract is remaining P6B work; changing it would require an explicit scope decision.

## 12–13. Safety, saturation and regression

Real E1/E2 issued no planner actuator commands and never acquired EXTERNAL. Thus no successful real execution timeout/saturation claim is possible. Preconditioning reached its 200 N command bound and is separately labelled. Native manufactured playback had zero timeouts. Actual steering rate limiter did not trigger in the direction test. Unit tests verify feedback amplitude/rate clamps, stale/state mismatch, duplicate execute, execute-before-plan, no-HOLD, idle abort, completion, disconnect and timeout natural decay.

Final C++ GTest: **10/10 PASS**. Selected integrated CTest: **8/8 PASS** (P5A kernel/fixture, P5B contract, P5C runtime, P5D template/instance, P6A, P6B). GCC warning-as-error build passes. OpenWater full npm suite: **256/256 PASS**, no skips/failures; ESLint and HTML validation PASS. Protocol loopback PASS. Existing actuator/bridge/Twin/visualization/physics regressions remain included in the full npm suite.

Test commands and logs: `final/build.txt`, `final/gtest.txt`, `final/ctest.txt`; paired OpenWater `npm-test.txt`, `lint.txt`, `lint-html.txt`, `protocol-loopback.json/.txt`. Windows Node requires `--import ./tests/register-three.mjs`; the initial missing-loader invocation was corrected, not treated as a code failure. Native real-browser failures were captured before later metadata/backpressure/UI guard hardening; those changes did not affect math or integration data. The final binary is covered by the rerun native loopback and tests.

## 14. Final gate and remaining work

**P6B FAIL**, specifically real-state planning rejection before formal tracking. Actuator contract resolved; execution infrastructure and protocol mock pass. Remaining: resolve real-state planning compatibility within an authorized contract, obtain feedforward calibration, select and freeze one gain configuration and acceptance thresholds, then run complete real E1/E2 tracking and record all required metrics/screenshots.

No Boat._step/hull/ocean/actuator physics changes; no planner formulation/objective/Jnav/mesh/implicit-midpoint changes; exact Hessian preserved; raw rather than effective thrust initializes T; no direct position/velocity writes; no command-mux bypass; no periodic replanning, real-vessel operation or P6C. No gains or acceptance thresholds were relaxed to manufacture PASS.
