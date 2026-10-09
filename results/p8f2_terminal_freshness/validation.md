# P8F2 — Generation/Freshness Decoupling and Final OpenWater Validation

P8F2_AR10_OPENWATER_DYNAMIC_PASS

Historical P8F and P8F1 results and classifications are preserved byte-for-byte. This stage is independent.
Production limiter change: trusted setIdentity advances generation without calling freshness invalidate(). receive() identity/sequence/timestamp checks, physical command bounds, slew history and the 0.5s command timeout are unchanged.
Native C++ is unchanged, including P8F1 generation rollover prefix preflush and DirectAsyncExecution.stop.
Runner terminal handoff is authorized only by a trusted INVALIDATE for an existing native stop reason after strict identity validation. MANUAL applies neutral immediately; scheduled waits do not advance physics or call the external limiter. A separate 0.5s wall watchdog, starting at INVALIDATE, bounds status delivery. This permitted HOLD policy was frozen before runs.

| # | Question | Answer |
|---|---|---|
| 1 | P8F1 为何约20ms就timeout | "setIdentity 调用 invalidate 将 receiptWallSec 清空，下一 tick 把失去freshness误判为超时。" |
| 2 | 是否真的达到0.5s超时 | "NO" |
| 3 | identity 与 freshness 已拆开 | true |
| 4 | INVALIDATE 仍严格只推进同episode的下一generation | true |
| 5 | 新到达的old-generation command仍拒绝 | true |
| 6 | 真实receipt timestamp保留 | true |
| 7 | 原timeout deadline未延长 | true |
| 8 | 合法neutral按真实receipt刷新 | true |
| 9 | MANUAL后停止external timeout gate | true |
| 10 | 非可信transition的意外authority loss仍失败 | "YES: UNEXPECTED_EXTERNAL_AUTHORITY_LOSS regression PASS" |
| 11 | H1 clean TASK_COMPLETE | true |
| 12 | H1 timeout/failsafe数 | 0 |
| 13 | H1 generation mismatch数 | 0 |
| 14 | H1 rejected targets数 | 0 |
| 15 | H1 generation rollover数 | 1 |
| 16 | H1 counterfactual buffered minimum m | -0.5619143918153755 |
| 17 | H2是否运行 | true |
| 18 | H2 native TASK_COMPLETE | true |
| 19 | H2 activated plans / switches | [7, 6] |
| 20 | H2 active solver failures | 0 |
| 21 | H2 fallback / timeout | [0, 0] |
| 22 | H2 actual sampled buffered dynamic clearance m | 5.1134505020859 |
| 23 | H2 actual sampled bank margin m | 1.443611819878718 |
| 24 | H2 Rule15 actual branch | {"applicable": true, "selected_branch": "STARBOARD_ASTERN", "starboard_sign": "negative_l", "actual_at_s50": {"episode_time": 23.349289238564378, "simulation_time": 42.54928923856406, "own_l": -5.530932122651558, "psi": 0.07186604223946437, "u": 2.2000758485716734, "v": -0.5147438188957512, "r": 0.0543874830650714, "own_s": 50, "target_l": 6.988205249263309, "relative_l": -12.519137371914868, "raw_clearance": 8.557023225284114, "buffered_clearance": 8.057023225284114, "method": "linear interpolation at first actual s=50 crossing"}, "passed": true} |
| 25 | H2 command limits | [true, 20.000000000000284, 0.15000000000000013] |
| 26 | tracking RMS / maximum / p95 | {"H1": {"cross_error": {"rms": 1.0414806087937323, "maximum_absolute": 2.831574962308659, "p95_absolute": 2.7435819174251814}, "heading_error": {"rms": 0.07861491674928887, "maximum_absolute": 0.21447729246506977, "p95_absolute": 0.19085868879601287}, "speed_error": {"rms": 0.7441164965423023, "maximum_absolute": 0.92823785421584, "p95_absolute": 0.8724694502947157}, "yaw_error": {"rms": 0.03174483957402783, "maximum_absolute": 0.09589331553415265, "p95_absolute": 0.07847562165663104}, "along_error": {"rms": 2.1128041182694317, "maximum_absolute": 6.658115447572996, "p95_absolute": 5.0905367913785655}}, "H2": {"cross_error": {"rms": 2.447104923037103, "maximum_absolute": 4.67576837633442, "p95_absolute": 4.590308274183109}, "heading_error": {"rms": 0.1464597326348462, "maximum_absolute": 0.2857792679929394, "p95_absolute": 0.2831771271628691}, "speed_error": {"rms": 0.800281914073956, "maximum_absolute": 0.909035570421298, "p95_absolute": 0.8983905747176087}, "yaw_error": {"rms": 0.032560953878246465, "maximum_absolute": 0.07220966661501656, "p95_absolute": 0.06281230586864711}, "along_error": {"rms": 7.855759208395187, "maximum_absolute": 16.699969188778866, "p95_absolute": 15.578463489477743}}} |
| 27 | terminal neutral accepted | true |
| 28 | generation3出现 | false |
| 29 | 自动execution_abort发生 | 0 |
| 30 | controller修改 | "NO" |
| 31 | planner mathematics修改 | "NO" |
| 32 | physics修改 | "NO" |
| 33 | target/buffer修改 | "NO" |
| 34 | 0.5s timeout修改 | "NO" |
| 35 | 重跑挑最好 | "NO: exactly one H1; at most one H2" |
| 36 | 最终标签 | "P8F2_AR10_OPENWATER_DYNAMIC_PASS" |

## Runtime evidence

H1: run_20261009T064955Z_h1
H2: run_20261009T065318Z_h2

### H2

Requests / successful plans / activated plans / switches: [8, 7, 7, 6]
Planner wall: {"minimum": 2.683373603, "median": 3.4288623705, "maximum": 36.894469977}
Worker wall: {"minimum": 2.6848993249999995, "median": 3.430349118999999, "maximum": 36.894868186}
Switch age: {"minimum": 2.719999999999942, "median": 3.3199999999999505, "maximum": 3.6399999999999224}
Remaining suffix: {"minimum": 23.505766286047326, "median": 24.592246760291424, "maximum": 26.985768527290784}
RTF / max tick lateness ms: [0.9999727376033345, 2.293073999999251]
Final world state: {"s_world": 81.68302416058073, "l_world": -1.4866632354370075, "psi": 0.2203868078770006}
Actual state at s=50: {"episode_time": 23.349289238564378, "simulation_time": 42.54928923856406, "own_l": -5.530932122651558, "psi": 0.07186604223946437, "u": 2.2000758485716734, "v": -0.5147438188957512, "r": 0.0543874830650714, "own_s": 50, "target_l": 6.988205249263309, "relative_l": -12.519137371914868, "raw_clearance": 8.557023225284114, "buffered_clearance": 8.057023225284114, "method": "linear interpolation at first actual s=50 crossing"}
Terminal neutral / MANUAL / TASK_COMPLETE rx: {"invalidate_rx_index": 3888, "neutral_rx_index": 3889, "manual_rx_index": 3890, "task_complete_rx_index": 3891}
Freshness transition: {"receiptWallSec_before": 42.254684412, "receiptWallSec_after_identity": 42.254684412, "original_timeout_deadline": 42.754684412, "effective_timeout_deadline_before_neutral": 42.754684412, "invalidate_to_neutral_gap": 0.019280318999996382, "pre_neutral_tick_count": 1, "fresh_at_first_tick": true}
Authority: {"physics_policy": "HOLD_PHYSICS_AFTER_MANUAL_UNTIL_TERMINAL_STATUS", "manual_rx_index": 3890, "terminal_status_rx_index": 3891, "terminal_handoff_wait_count": 0, "automatic_execution_abort_count": 0, "generation3_observed": false, "external_tick_without_ownership_count": 0, "terminal_handoff_waits": [], "completed": [{"reason": "TASK_COMPLETE", "episode": 1, "generation": 2, "rx_index": 3888, "startWallSec": 42.274356198, "manualWallSec": 42.293532498, "neutralAccepted": true, "status": "TASK_COMPLETE", "statusWallSec": 42.293555795}], "final_receiver_phase": "TASK_COMPLETE", "terminal_error": null, "external_command_timeout_sec": 0.5, "terminal_status_watchdog_sec": 0.5, "checks": {"fixed_physics_policy": true, "no_external_without_ownership": true, "waits_only_trusted_manual": true, "no_physical_step_during_wait": true, "bounded_clean_completion": true, "no_abort_or_generation3": true, "manual_before_complete": true}, "passed": true}
POST_TERMINAL_WORKER_DISCARD (not ACTIVE failure; never activated): [{"episode_id": 1, "event": "SOLVE_DISCARDED", "generation": 2, "protocol_version": 1, "reason": "GENERATION_EPISODE_OR_TERMINAL_PHASE", "simulation_time": 57.480000000003386, "solve_in_flight": false, "type": "async_event", "wall_elapsed_sec": 60.413557173}]
Runner error: null

### H1

Requests / successful plans / activated plans / switches: [22, 21, 21, 20]
Planner wall: {"minimum": 1.414392679, "median": 1.5105728379999999, "maximum": 20.570615717}
Worker wall: {"minimum": 1.415653160999998, "median": 1.5119523164999986, "maximum": 20.571004368999994}
Switch age: {"minimum": 1.420000000000222, "median": 1.5000000000000995, "maximum": 2.539999999999946}
Remaining suffix: {"minimum": 24.397837977676005, "median": 25.370966222783693, "maximum": 25.46266422399605}
RTF / max tick lateness ms: [0.9999644073260714, 2.317478000000847]
Final world state: {"s_world": 91.95022255493585, "l_world": 1.4819918564089276, "psi": -0.242708680419463}
Actual state at s=50: {"episode_time": 22.0161221245801, "simulation_time": 41.21612212457978, "own_l": 0.5013534125891314, "psi": 0.1501630661670365, "u": 2.353590435783571, "v": -0.16024661126218168, "r": 0.001138262155989752, "own_s": 50, "target_l": 5.655038135279032, "relative_l": -5.1536847226899, "raw_clearance": 1.1915705760591462, "buffered_clearance": 0.6915705760591462, "method": "linear interpolation at first actual s=50 crossing"}
Terminal neutral / MANUAL / TASK_COMPLETE rx: {"invalidate_rx_index": 4165, "neutral_rx_index": 4166, "manual_rx_index": 4167, "task_complete_rx_index": 4168}
Freshness transition: {"receiptWallSec_before": 43.555599077, "receiptWallSec_after_identity": 43.555599077, "original_timeout_deadline": 44.055599077, "effective_timeout_deadline_before_neutral": 44.055599077, "invalidate_to_neutral_gap": 0.018478394999995373, "pre_neutral_tick_count": 1, "fresh_at_first_tick": true}
Authority: {"physics_policy": "HOLD_PHYSICS_AFTER_MANUAL_UNTIL_TERMINAL_STATUS", "manual_rx_index": 4167, "terminal_status_rx_index": 4168, "terminal_handoff_wait_count": 0, "automatic_execution_abort_count": 0, "generation3_observed": false, "external_tick_without_ownership_count": 0, "terminal_handoff_waits": [], "completed": [{"reason": "TASK_COMPLETE", "episode": 1, "generation": 2, "rx_index": 4165, "startWallSec": 43.576615803, "manualWallSec": 43.59482667, "neutralAccepted": true, "status": "TASK_COMPLETE", "statusWallSec": 43.594856539}], "final_receiver_phase": "TASK_COMPLETE", "terminal_error": null, "external_command_timeout_sec": 0.5, "terminal_status_watchdog_sec": 0.5, "checks": {"fixed_physics_policy": true, "no_external_without_ownership": true, "waits_only_trusted_manual": true, "no_physical_step_during_wait": true, "bounded_clean_completion": true, "no_abort_or_generation3": true, "manual_before_complete": true}, "passed": true}
POST_TERMINAL_WORKER_DISCARD (not ACTIVE failure; never activated): [{"episode_id": 1, "event": "SOLVE_DISCARDED", "generation": 2, "protocol_version": 1, "reason": "GENERATION_EPISODE_OR_TERMINAL_PHASE", "simulation_time": 59.140000000003646, "solve_in_flight": false, "type": "async_event", "wall_elapsed_sec": 55.654012725}]
Runner error: null

## Tests and preservation

OpenWater npm test: 298/298 PASS. Runner deterministic lifecycle tests: 6/6 PASS. Native direct-async/P7C/N120/KKT/channel suites: 5/5 PASS. Actual WebSocket execution_abort order regression: PASS. Tests precede formal runs.
Exact historical 20.071429ms gap and real P8F1 rx4098/4100/4101 fixture pass; 1.499/1.501 deadline tests prove no timeout extension. New neutral refreshes at its actual receipt; explicit invalidate still cancels freshness.
MANUAL→TASK_COMPLETE delayed 25ms regression spans a scheduled 20ms tick without invoking the external limiter; absent status reaches TERMINAL_STATUS_TIMEOUT. Unexpected authority loss still fails. No fresh physics budget, sequence reset or sender timestamp reset is introduced.
See contracts/P8F2_FIX_SCOPE.json, contract_equality_audit.json, history_preservation.json and implementation/ for source scope and 7,933 historical-file hashes.

## Claim boundary and stop

Actual clearance is sampled at 50 Hz physical ticks; no continuous 6DOF actual-clearance proof is claimed. Activated nominal plans retain strict KKT and original continuous multicircle dynamic/bank certificates. The target is a kinematic CV disc, not a second 6DOF vessel.
Visual browser acceptance unavailable / not performed in this stage; no Chrome visual acceptance is claimed. Numeric acceptance is independent of browser access.
One H1 and at most one H2, with frozen controller, target, buffer, sea preset, plant, N120/L75, solver, channel and limits. Native internal solver attempt policy is unchanged; no new episode retry or seed selection.
The H2 post-terminal worker discard is evidenced by native_events.jsonl. Its receiver frame was not captured before close (receiver ends at SOLVE_RETURNED); see post_terminal_worker_audit.json. It caused no activation, physical tick or second rollover.
No engineering or algorithm development continues after this stage. If final PASS, next stage is PAPER_FREEZE; otherwise preserve the exact failure classification and stop.
