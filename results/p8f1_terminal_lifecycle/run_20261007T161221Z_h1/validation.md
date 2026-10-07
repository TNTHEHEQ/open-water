# P8F H1 validation

**P8F1_TERMINATION_H1_CONTROL_FAIL**

Actual ownship: OpenWater 6DOF, single outboard. Target: simulator-owned CV disc. H1/H2 data and plots are separated.

| Check | Result |
|---|---|
| 01 N / L / ds | "120 / 75 m / 0.625 m" |
| 02 mission / lookahead | "75m / fixed75m, known extendable straight reference" |
| 03 terminal | "CRUISE_CONTINUATION_V1: only hard l_N=0 and u_N=2" |
| 04 formulation / solver | "FULL_LIFTED / IPOPT STRICT_REFERENCE" |
| 05 collision representation | "RULE_SELECTED_CONVEX_ST_CHANNEL for H2; no obstacles in H1" |
| 06 nonlinear dynamic NLP rows | 0 |
| 07 original multi-circle continuous audit | "retained; SAFE_WITH_BOUND required for activation" |
| 08 target | {"s_world": 50, "l_at_episode_zero": -16.36108398930107, "velocity": [0, 1], "radius_m": 2.5, "planner_buffer_m": 0.5, "model": "SIMULATOR_OWNED_KINEMATIC_CV_DISC", "six_dof": false} |
| 09 environment | {"sea_preset": 1, "preset": {"name": "Calm", "hs": 0.35, "tp": 4.5, "windSpeed": 2.4, "windDirection": 0.3839724354387525, "gustiness": 0.12, "currentSpeed": 0.12, "currentDirection": 1.1868238913561442}, "initial": {"seaState": 1, "localWaterHeight": -0.11351697093638378, "wave": {"significantHeightM": 0.35001426306825756, "peakPeriodSec": 4.659875400235626}, "windSpeedMps": 2.4233173083695303, "windDirectionRad": 1.1791781892217488, "currentSpeedMps": 0.1151470842609257, "currentDirectionRad": 0.3163427389230472, "waterVelocity": {"x": -0.07537446384624613, "y": 0.1030017561320117, "z": -0.009509628889633331}, "current": {"x": 0.0358214360925301, "y": 0.1094334305870994, "z": 0}, "wind": {"x": 2.2398543818083754, "y": 0.924942768682022, "z": 0}}, "physical_dt_sec": 0.02} |
| 10 H1 control | "P8F1_TERMINATION_H1_CONTROL_FAIL" |
| 11 H1 counterfactual buffered minimum | -0.39647784457246393 |
| 12 native TASK_COMPLETE | false |
| 13 final actual state | {"s_world": 89.75455171701475, "l_world": 1.4997582428970895, "psi": -0.24534348269795572} |
| 14 requests / successful / activated / switches | [27, 26, 26, 25] |
| 15 solver failures | 0 |
| 16 candidate rejects | 0 |
| 17 fallback | 0 |
| 18 timeout / failsafe | 1 |
| 19 protocol failures | 1 |
| 20 actual dynamic CPA | null |
| 21 actual Rule15 | {"applicable": false, "selected_branch": "STARBOARD_ASTERN", "starboard_sign": "negative_l", "actual_at_s50": {"episode_time": 21.999718902849143, "simulation_time": 41.19971890284882, "own_l": 0.313731770948615, "psi": 0.12305347859094547, "u": 2.3585409595795577, "v": -0.13827900819546096, "r": -0.0007239629900589173, "own_s": 50, "target_l": 5.638634913548074, "relative_l": -5.324903142599459, "raw_clearance": 1.3627889959687054, "buffered_clearance": 0.8627889959687054, "method": "linear interpolation at first actual s=50 crossing"}, "passed": null} |
| 22 actual bank margin | {"simulation_time": 54.52000000000292, "episode_time": 35.32000000000325, "own_s": 81.46494467775535, "own_l": 2.346113087052204, "psi": -0.17465729755340179, "u": 2.3408036899795928, "v": 0.34690095756112543, "r": -0.036458865731194924, "target_s": 50, "target_l": 18.95891601070218, "circle": 0, "circle_s": 79.36406756124782, "circle_l": 2.7168238266405274, "circle_target_distance": 33.55672842005137, "raw_clearance": 29.594614273420618, "buffered_clearance": 29.094614273420618, "bank_raw": 5.821062026728718, "bank_buffered": 5.321062026728718} |
| 23 max applied Tc rate | 19.999999999998863 |
| 24 max applied steering rate | 0.15000000000000013 |
| 25 actual steering angle / rate | [0.13501913530133844, 0.0721061759825381] |
| 26 tracking RMS / max / p95 | {"cross_error": {"rms": 0.7331727538699669, "maximum_absolute": 2.4572038459513874, "p95_absolute": 2.3010365473527474}, "heading_error": {"rms": 0.056454457800602716, "maximum_absolute": 0.18144016547760297, "p95_absolute": 0.12131277530287615}, "speed_error": {"rms": 0.7078747566691965, "maximum_absolute": 0.9281994814726358, "p95_absolute": 0.8396330580646496}, "yaw_error": {"rms": 0.03145524083998203, "maximum_absolute": 0.08967661284641568, "p95_absolute": 0.07697443000352969}, "along_error": {"rms": 1.3549700505921738, "maximum_absolute": 4.447936943045491, "p95_absolute": 2.969675982014381}} |
| 27 actual at s=50 | {"episode_time": 21.999718902849143, "simulation_time": 41.19971890284882, "own_l": 0.313731770948615, "psi": 0.12305347859094547, "u": 2.3585409595795577, "v": -0.13827900819546096, "r": -0.0007239629900589173, "own_s": 50, "target_l": 5.638634913548074, "relative_l": -5.324903142599459, "raw_clearance": 1.3627889959687054, "buffered_clearance": 0.8627889959687054, "method": "linear interpolation at first actual s=50 crossing"} |
| 28 offline comparison | {"l": -4.672266, "episode_time": 18.71568, "u": 2.501698} |
| 29 worker wall time | {"minimum": 0.9821132759999998, "median": 1.2864268249999995, "maximum": 30.149287805} |
| 30 planning wall time | {"minimum": 0.980941799, "median": 1.2852586, "maximum": 30.148944661} |
| 31 switch age / suffix | [{"minimum": 0.9999999999999787, "median": 1.2999999999999723, "maximum": 2.1799999999999535}, {"minimum": 24.757837977675997, "median": 25.57923841562256, "maximum": 25.89570223066193}] |
| 32 expired / terminal cancellations | [0, 1] |
| 33 graph / cache counters | {"cache_hits": 27, "cache_misses": 2, "graph_builds": 1, "graph_hits": 55, "graph_seconds": 0.034976109, "signature_seconds": 1.9615965249999998, "solver_constructions": 2, "solver_creation_seconds": 2.537145623} |
| 34 dual-used requests | 26 |
| 35 sim / wall / RTF / tick lateness | [38.860000000003794, 38.88059434499999, 0.9994703181537438, 0.6243070000000444] |
| 36 frozen controller / physics / buffer | "Ku0 Ky-0.08 Kpsi-1.2 Kr-0.6; original single outboard plant; buffer0.5m unchanged" |
| 37 asynchronous mechanism | "DIRECT_ASYNC_SUFFIX_V1, one worker, old plan continues, next physical tick current-time suffix, no predictor/blend/tracking gate" |
| 38 claim boundary | "kinematic CV target, not second6DOF; actual50Hz sampled only; no rigorous actual inter-tick certificate, hard real-time or global-optimum claim" |
| 39 final classification | "P8F1_TERMINATION_H1_CONTROL_FAIL" |

Independent audit issues: []

Full evidence: summary.json; requests/plans/switches/tracking/actual_dynamic_clearance/actual_bank_clearance/command_audit.csv; native JSON and JSONL.

H1 counterfactual target is evaluated offline and is absent from the control simulation. The native task gate requires actual s>=74.5 and abs(l)<=1.5; passing s=75 alone does not finish the task. No terminal heading gate was added.

## P8F1 failure and stop decision

P8F1_TERMINATION_H1_CONTROL_FAIL / TIMEOUT_FAILSAFE. H2 was not run.

Native TASK_COMPLETE was emitted and received; the final receiver phase is ABORTED, so the clean native completion gate is false. This distinction is preserved in summary.json.

The repaired order is INVALIDATE rx4100 < accepted neutral rx4101 < MANUAL rx4102 < TASK_COMPLETE rx4103. The receiver gap between INVALIDATE and neutral was approximately 20.071 ms. INVALIDATE cleared freshness; the physical tick freshness guard ran before neutral arrived and triggered failure finalization. This is not evidence that the 0.5-second age limit elapsed.

The automatic abort then produced generation3, and its neutral was rejected after ownership had already changed to MANUAL. Complete receiver evidence gives one rejected physical target (UNOWNED_COMMAND), zero generation mismatches, and two rollovers. The original commands.json contains zero rejected rows because ownership rejection occurs before that array append; the authoritative all-target audit includes this rejection.

See failure_analysis.json for raw indices, sender/receipt timestamps, exact target, native discard and source-level causal explanation. No repair, parameter change, or second run followed this failure.
