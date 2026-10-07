# P8F1 — Terminal Lifecycle Repair and Final OpenWater Validation

P8F1_TERMINATION_H1_CONTROL_FAIL

H1 stopped with COMMAND_TIMEOUT_FAILSAFE during the approximately 20.071 ms interval between INVALIDATE and neutral receipt. The original gen2 neutral was accepted with zero generation mismatches, but abort cleanup caused a second rollover and one UNOWNED_COMMAND rejection. H2 was not run; no repair or rerun followed.

历史 P8F 永久保留 P8F_TASK_COMPLETE_WITH_RUNTIME_DEGRADATION；本阶段为独立验证。

唯一生产修改是 DirectSession 的 generation rollover prefix preflush。事件队列截至匹配 INVALIDATE 的前缀先入 WebSocket outgoing queue，输出随后入队，其余事件保持原顺序。generation 不变时不 preflush。
Native event storage uses execution episode context; the wire publisher stamps episode_id. The helper also rejects an explicitly wrong event episode. DirectAsyncExecution and OpenWater production limiter are unchanged.

| # | Question | Answer |
|---|---|---|
| 1 | 根因确认是 wire ordering | true |
| 2 | 是否放宽 limiter generation policy | "NO" |
| 3 | 是否改变 DirectAsyncExecution.stop 语义 | "NO" |
| 4 | INVALIDATE 先于 new-generation neutral | true |
| 5 | 历史 old-order regression 仍拒绝 | "YES / EPISODE_GENERATION_MISMATCH" |
| 6 | new-order regression 接受 | "YES" |
| 7 | H1 L75 termination clean | false |
| 8 | H1 rejected target count | 1 |
| 9 | H1 generation mismatch count | 0 |
| 10 | H1 counterfactual 仍冲突 | -0.39647784457246393 |
| 11 | H2 native TASK_COMPLETE | "NOT_RUN" |
| 12 | H2 rejected target count | "NOT_RUN" |
| 13 | H2 generation mismatch count | "NOT_RUN" |
| 14 | terminal neutral accepted | true |
| 15 | final mode MANUAL | "MANUAL" |
| 16 | final control neutral | {"propulsionCommand": 0, "steeringCommandRad": 0} |
| 17 | activated plans | 26 |
| 18 | switches | 25 |
| 19 | ACTIVE solver failures | 0 |
| 20 | fallback | 0 |
| 21 | timeout/failsafe | 1 |
| 22 | sampled actual min buffered dynamic clearance m | "NOT_RUN" |
| 23 | sampled actual min bank margin m | 5.321062026728718 |
| 24 | actual Rule15 branch | {"applicable": false, "selected_branch": "STARBOARD_ASTERN", "starboard_sign": "negative_l", "actual_at_s50": {"episode_time": 21.999718902849143, "simulation_time": 41.19971890284882, "own_l": 0.313731770948615, "psi": 0.12305347859094547, "u": 2.3585409595795577, "v": -0.13827900819546096, "r": -0.0007239629900589173, "own_s": 50, "target_l": 5.638634913548074, "relative_l": -5.324903142599459, "raw_clearance": 1.3627889959687054, "buffered_clearance": 0.8627889959687054, "method": "linear interpolation at first actual s=50 crossing"}, "passed": null} |
| 25 | APPLIED Tc rate max N/s | 19.999999999998863 |
| 26 | APPLIED steering rate max rad/s | 0.15000000000000013 |
| 27 | actual steering rate max rad/s | 0.0721061759825381 |
| 28 | tracking RMS/max | {"cross_error": {"rms": 0.7331727538699669, "maximum_absolute": 2.4572038459513874, "p95_absolute": 2.3010365473527474}, "heading_error": {"rms": 0.056454457800602716, "maximum_absolute": 0.18144016547760297, "p95_absolute": 0.12131277530287615}, "speed_error": {"rms": 0.7078747566691965, "maximum_absolute": 0.9281994814726358, "p95_absolute": 0.8396330580646496}, "yaw_error": {"rms": 0.03145524083998203, "maximum_absolute": 0.08967661284641568, "p95_absolute": 0.07697443000352969}, "along_error": {"rms": 1.3549700505921738, "maximum_absolute": 4.447936943045491, "p95_absolute": 2.969675982014381}} |
| 29 | POST_TERMINAL_WORKER_DISCARD | 1 |
| 30 | 是否修改 controller | "NO" |
| 31 | 是否修改 planner mathematics | "NO" |
| 32 | 是否修改 target/buffer | "NO" |
| 33 | 是否修改 physics | "NO" |
| 34 | 是否重跑挑最好结果 | "NO: one H1, at most one H2" |
| 35 | 最终标签 | "P8F1_TERMINATION_H1_CONTROL_FAIL" |

## Runs and protocol evidence

H1: run_20261007T161221Z_h1
H2: NOT_RUN: stopped at H1 failure

Receiver ordering: {"invalidate_rx_index": 4100, "neutral_rx_index": 4101, "manual_rx_index": 4102, "task_complete_rx_index": 4103}

Requests / successful plans / activated plans / switches: [27, 26, 26, 25]
Planner walls: {"minimum": 0.980941799, "median": 1.2852586, "maximum": 30.148944661}
Worker walls: {"minimum": 0.9821132759999998, "median": 1.2864268249999995, "maximum": 30.149287805}
Active real-time factor: 0.9994703181537438
Post-terminal discard events: [{"episode_id": 1, "event": "SOLVE_DISCARDED", "generation": 3, "protocol_version": 1, "reason": "GENERATION_EPISODE_OR_TERMINAL_PHASE", "simulation_time": 58.06000000000348, "solve_in_flight": false, "type": "async_event", "wall_elapsed_sec": 66.128790651}]

## Validation and frozen scope

Planner: direct async lifecycle, P7C historical async, P8F N120, KKT and channel suites: 5/5 PASS. OpenWater: npm test with its repository Three.js loader: 288/288 PASS. Initial ad-hoc Node invocation omitted the loader and failed imports; the canonical npm test invocation passed. Actual WebSocket execution_abort ordering regression PASS. All tests ran before formal validation.
See contracts/P8F1_FIX_SCOPE.json, contract_equality_audit.json, implementation/, preservation_audit.json and protocol_comparison.json.
Formal runner uses the unchanged historical experiment_config.json, task.json, preconditioner, limiter, controller and plant. --p8f1 selects isolated output directories and requires the new H1 gate before H2. rx_index logging is observational.
Terminal MANUAL neutral is reported as a safety handoff, separate from normal ACTIVE physical command slew statistics.
Numerical epsilon is arithmetic tolerance only; applied limits remain 20 N/s and 0.15 rad/s.

## Claim boundary

Actual clearance is sampled at 50 Hz physical ticks; this is not a continuous 6DOF actual-clearance proof. Activated nominal trajectories retain original continuous dynamic and bank certificates. The target is a kinematic CV disc, not a second 6DOF vessel.
Visual browser acceptance unavailable: Chrome extension was detected previously but control failed; no browser visual acceptance is claimed. Numeric gates do not depend on it.
Numerical values in rows 14–29 are the H1 control when H2 is NOT_RUN; no H2 result is implied. The H1 native TASK_COMPLETE event and status were observed, but timeout finalization changed final phase to ABORTED. The primary clean-completion gate remains failed. See the per-run failure_analysis.json for the 20.071 ms freshness gap and the UNOWNED_COMMAND abort neutral rejection.
Seven standard P8F plots plus terminal_lifecycle_timeline.png are under each run plots/. Historical P8F figures are untouched.

Algorithm development stops here. If PASS, the next phase is PAPER FREEZE; no further controller/scenario/solver work is authorized by this stage.
