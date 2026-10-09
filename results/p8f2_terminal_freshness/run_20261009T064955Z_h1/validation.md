# P8F2 H1 validation

**P8F2_H1_L75_CONTROL_PASS**

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
| 10 H1 control | "P8F2_H1_L75_CONTROL_PASS" |
| 11 H1 counterfactual buffered minimum | -0.5619143918153755 |
| 12 native TASK_COMPLETE | true |
| 13 final actual state | {"s_world": 91.95022255493585, "l_world": 1.4819918564089276, "psi": -0.242708680419463} |
| 14 requests / successful / activated / switches | [22, 21, 21, 20] |
| 15 solver failures | 0 |
| 16 candidate rejects | 0 |
| 17 fallback | 0 |
| 18 timeout / failsafe | 0 |
| 19 protocol failures | 0 |
| 20 actual dynamic CPA | null |
| 21 actual Rule15 | {"applicable": false, "selected_branch": "STARBOARD_ASTERN", "starboard_sign": "negative_l", "actual_at_s50": {"episode_time": 22.0161221245801, "simulation_time": 41.21612212457978, "own_l": 0.5013534125891314, "psi": 0.1501630661670365, "u": 2.353590435783571, "v": -0.16024661126218168, "r": 0.001138262155989752, "own_s": 50, "target_l": 5.655038135279032, "relative_l": -5.1536847226899, "raw_clearance": 1.1915705760591462, "buffered_clearance": 0.6915705760591462, "method": "linear interpolation at first actual s=50 crossing"}, "passed": null} |
| 22 actual bank margin | {"simulation_time": 54.32000000000289, "episode_time": 35.120000000003216, "own_s": 80.83893391659994, "own_l": 3.111633053822695, "psi": -0.21637679206653374, "u": 2.3120307243467657, "v": 0.4313115632948544, "r": -0.040348128881194656, "target_s": 50, "target_l": 18.758916010702148, "circle": 0, "circle_s": 78.75534621890142, "circle_l": 3.569643334395619, "circle_target_distance": 32.520515687855884, "raw_clearance": 28.55840154122513, "buffered_clearance": 28.05840154122513, "bank_raw": 4.968242518973627, "bank_buffered": 4.468242518973627} |
| 23 max applied Tc rate | 20.000000000000284 |
| 24 max applied steering rate | 0.15000000000000013 |
| 25 actual steering angle / rate | [0.16701642395201527, 0.07241343762263597] |
| 26 tracking RMS / max / p95 | {"cross_error": {"rms": 1.0414806087937323, "maximum_absolute": 2.831574962308659, "p95_absolute": 2.7435819174251814}, "heading_error": {"rms": 0.07861491674928887, "maximum_absolute": 0.21447729246506977, "p95_absolute": 0.19085868879601287}, "speed_error": {"rms": 0.7441164965423023, "maximum_absolute": 0.92823785421584, "p95_absolute": 0.8724694502947157}, "yaw_error": {"rms": 0.03174483957402783, "maximum_absolute": 0.09589331553415265, "p95_absolute": 0.07847562165663104}, "along_error": {"rms": 2.1128041182694317, "maximum_absolute": 6.658115447572996, "p95_absolute": 5.0905367913785655}} |
| 27 actual at s=50 | {"episode_time": 22.0161221245801, "simulation_time": 41.21612212457978, "own_l": 0.5013534125891314, "psi": 0.1501630661670365, "u": 2.353590435783571, "v": -0.16024661126218168, "r": 0.001138262155989752, "own_s": 50, "target_l": 5.655038135279032, "relative_l": -5.1536847226899, "raw_clearance": 1.1915705760591462, "buffered_clearance": 0.6915705760591462, "method": "linear interpolation at first actual s=50 crossing"} |
| 28 offline comparison | {"l": -4.672266, "episode_time": 18.71568, "u": 2.501698} |
| 29 worker wall time | {"minimum": 1.415653160999998, "median": 1.5119523164999986, "maximum": 20.571004368999994} |
| 30 planning wall time | {"minimum": 1.414392679, "median": 1.5105728379999999, "maximum": 20.570615717} |
| 31 switch age / suffix | [{"minimum": 1.420000000000222, "median": 1.5000000000000995, "maximum": 2.539999999999946}, {"minimum": 24.397837977676005, "median": 25.370966222783693, "maximum": 25.46266422399605}] |
| 32 expired / terminal cancellations | [0, 1] |
| 33 graph / cache counters | {"cache_hits": 22, "cache_misses": 2, "graph_builds": 1, "graph_hits": 45, "graph_seconds": 0.043979871, "signature_seconds": 1.837839884, "solver_constructions": 2, "solver_creation_seconds": 2.929919818} |
| 34 dual-used requests | 21 |
| 35 sim / wall / RTF / tick lateness | [39.94000000000396, 39.941421622, 0.9999644073260714, 2.317478000000847] |
| 36 frozen controller / physics / buffer | "Ku0 Ky-0.08 Kpsi-1.2 Kr-0.6; original single outboard plant; buffer0.5m unchanged" |
| 37 asynchronous mechanism | "DIRECT_ASYNC_SUFFIX_V1, one worker, old plan continues, next physical tick current-time suffix, no predictor/blend/tracking gate" |
| 38 claim boundary | "kinematic CV target, not second6DOF; actual50Hz sampled only; no rigorous actual inter-tick certificate, hard real-time or global-optimum claim" |
| 39 final classification | "P8F2_H1_L75_CONTROL_PASS" |

Independent audit issues: []

Full evidence: summary.json; requests/plans/switches/tracking/actual_dynamic_clearance/actual_bank_clearance/command_audit.csv; native JSON and JSONL.

H1 counterfactual target is evaluated offline and is absent from the control simulation. The native task gate requires actual s>=74.5 and abs(l)<=1.5; passing s=75 alone does not finish the task. No terminal heading gate was added.

## P8F2 terminal freshness and authority

{
  "passed": true,
  "run": "run_20261009T064955Z_h1",
  "classification": "P8F2_H1_L75_CONTROL_PASS",
  "counterfactual_min_buffered_m": -0.5619143918153755,
  "summary_sha256": "17b2a62b100815b91c6b495337fec83ea2879cd867f2a727712264cd7dbcfbee",
  "terminal_lifecycle_pass": true,
  "freshness_pass": true,
  "authority_pass": true
}

One pre-neutral physical tick used the preserved original receipt/deadline. Zero rejected targets, zero generation mismatches, one rollover, no automatic abort and final MANUAL neutral. H2 remains gated on this committed evidence.
