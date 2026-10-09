# P8F2 H2 validation

**P8F2_AR10_OPENWATER_DYNAMIC_PASS**

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
| 10 H1 control | "PASS, separate frozen evidence" |
| 11 H1 counterfactual buffered minimum | -0.5619143918153755 |
| 12 native TASK_COMPLETE | true |
| 13 final actual state | {"s_world": 81.68302416058073, "l_world": -1.4866632354370075, "psi": 0.2203868078770006} |
| 14 requests / successful / activated / switches | [8, 7, 7, 6] |
| 15 solver failures | 0 |
| 16 candidate rejects | 0 |
| 17 fallback | 0 |
| 18 timeout / failsafe | 0 |
| 19 protocol failures | 0 |
| 20 actual dynamic CPA | {"simulation_time": 39.40000000000056, "episode_time": 20.20000000000088, "own_s": 43.00963528647623, "own_l": -4.225419900490594, "psi": -0.08604115907044901, "u": 2.2193477033652975, "v": -0.22706031450344744, "r": 0.0415774902001691, "target_s": 50, "target_l": 3.838916010699812, "circle": 2, "circle_s": 45.135076870426126, "circle_l": -4.408747978884709, "circle_target_distance": 9.575564648716654, "raw_clearance": 5.6134505020859, "buffered_clearance": 5.1134505020859, "bank_raw": 4.129137874484536, "bank_buffered": 3.6291378744845364} |
| 21 actual Rule15 | {"applicable": true, "selected_branch": "STARBOARD_ASTERN", "starboard_sign": "negative_l", "actual_at_s50": {"episode_time": 23.349289238564378, "simulation_time": 42.54928923856406, "own_l": -5.530932122651558, "psi": 0.07186604223946437, "u": 2.2000758485716734, "v": -0.5147438188957512, "r": 0.0543874830650714, "own_s": 50, "target_l": 6.988205249263309, "relative_l": -12.519137371914868, "raw_clearance": 8.557023225284114, "buffered_clearance": 8.057023225284114, "method": "linear interpolation at first actual s=50 crossing"}, "passed": true} |
| 22 actual bank margin | {"simulation_time": 46.82000000000172, "episode_time": 27.62000000000204, "own_s": 59.53361748604109, "own_l": -6.03372100980592, "psi": 0.2658808102952631, "u": 2.165157421706981, "v": -0.5161502731777006, "r": 0.0336658399211169, "target_s": 50, "target_l": 11.258916010700972, "circle": 0, "circle_s": 57.475246426501734, "circle_l": -6.594274033490528, "circle_target_distance": 19.354991704750105, "raw_clearance": 15.392877558119352, "buffered_clearance": 14.892877558119352, "bank_raw": 1.943611819878718, "bank_buffered": 1.443611819878718} |
| 23 max applied Tc rate | 20.000000000000284 |
| 24 max applied steering rate | 0.15000000000000013 |
| 25 actual steering angle / rate | [0.19782926061506634, 0.11165178842373613] |
| 26 tracking RMS / max / p95 | {"cross_error": {"rms": 2.447104923037103, "maximum_absolute": 4.67576837633442, "p95_absolute": 4.590308274183109}, "heading_error": {"rms": 0.1464597326348462, "maximum_absolute": 0.2857792679929394, "p95_absolute": 0.2831771271628691}, "speed_error": {"rms": 0.800281914073956, "maximum_absolute": 0.909035570421298, "p95_absolute": 0.8983905747176087}, "yaw_error": {"rms": 0.032560953878246465, "maximum_absolute": 0.07220966661501656, "p95_absolute": 0.06281230586864711}, "along_error": {"rms": 7.855759208395187, "maximum_absolute": 16.699969188778866, "p95_absolute": 15.578463489477743}} |
| 27 actual at s=50 | {"episode_time": 23.349289238564378, "simulation_time": 42.54928923856406, "own_l": -5.530932122651558, "psi": 0.07186604223946437, "u": 2.2000758485716734, "v": -0.5147438188957512, "r": 0.0543874830650714, "own_s": 50, "target_l": 6.988205249263309, "relative_l": -12.519137371914868, "raw_clearance": 8.557023225284114, "buffered_clearance": 8.057023225284114, "method": "linear interpolation at first actual s=50 crossing"} |
| 28 offline comparison | {"l": -4.672266, "episode_time": 18.71568, "u": 2.501698} |
| 29 worker wall time | {"minimum": 2.6848993249999995, "median": 3.430349118999999, "maximum": 36.894868186} |
| 30 planning wall time | {"minimum": 2.683373603, "median": 3.4288623705, "maximum": 36.894469977} |
| 31 switch age / suffix | [{"minimum": 2.719999999999942, "median": 3.3199999999999505, "maximum": 3.6399999999999224}, {"minimum": 23.505766286047326, "median": 24.592246760291424, "maximum": 26.985768527290784}] |
| 32 expired / terminal cancellations | [0, 1] |
| 33 graph / cache counters | {"cache_hits": 1, "cache_misses": 9, "graph_builds": 7, "graph_hits": 11, "graph_seconds": 0.241617259, "signature_seconds": 1.168557681, "solver_constructions": 9, "solver_creation_seconds": 13.772329947} |
| 34 dual-used requests | 7 |
| 35 sim / wall / RTF / tick lateness | [38.28000000000371, 38.281043633, 0.9999727376033345, 2.293073999999251] |
| 36 frozen controller / physics / buffer | "Ku0 Ky-0.08 Kpsi-1.2 Kr-0.6; original single outboard plant; buffer0.5m unchanged" |
| 37 asynchronous mechanism | "DIRECT_ASYNC_SUFFIX_V1, one worker, old plan continues, next physical tick current-time suffix, no predictor/blend/tracking gate" |
| 38 claim boundary | "kinematic CV target, not second6DOF; actual50Hz sampled only; no rigorous actual inter-tick certificate, hard real-time or global-optimum claim" |
| 39 final classification | "P8F2_AR10_OPENWATER_DYNAMIC_PASS" |

Independent audit issues: []

Full evidence: summary.json; requests/plans/switches/tracking/actual_dynamic_clearance/actual_bank_clearance/command_audit.csv; native JSON and JSONL.

H1 counterfactual target is evaluated offline and is absent from the control simulation. The native task gate requires actual s>=74.5 and abs(l)<=1.5; passing s=75 alone does not finish the task. No terminal heading gate was added.

## P8F2 lifecycle acceptance

{
  "classification": "P8F2_AR10_OPENWATER_DYNAMIC_PASS",
  "terminal_lifecycle": {
    "old_generation": 1,
    "new_generation": 2,
    "invalidate_rx_index": 3888,
    "neutral_rx_index": 3889,
    "manual_rx_index": 3890,
    "task_complete_rx_index": 3891,
    "neutral_episode": 1,
    "neutral_generation": 2,
    "neutral_sequence": 1921,
    "neutral_sender_timestamp": 57.46000000000338,
    "neutral_receipt_sim_time": 57.480000000003386,
    "neutral_accepted": true,
    "neutral_rejection_reason": null,
    "neutral_target": {
      "Tc": 0,
      "delta": 0
    },
    "old_generation_post_invalidate_accept_count": 0,
    "generation_mismatch_count": 0,
    "all_rejected_target_count": 0,
    "terminal_generation_rollover_count": 1,
    "terminal_INVALIDATE_received": 1,
    "terminal_neutral_target_count": 1,
    "final_mode": "MANUAL",
    "final_control": {
      "propulsionCommand": 0,
      "steeringCommandRad": 0
    },
    "terminal_safety_handoff_excluded_from_ACTIVE_rate_statistics": true,
    "checks": {
      "one_rollover": true,
      "one_accepted_neutral": true,
      "wire_partial_order": true,
      "same_episode_next_generation": true,
      "sequence_monotonic": true,
      "timestamp_rules": true,
      "no_invalid_control": true,
      "final_manual_neutral": true,
      "rx_index_complete_unique": true,
      "trusted_transitions_only": true
    },
    "passed": true
  },
  "freshness_transition": {
    "last_active_command_receipt_wall": 42.254684412,
    "last_active_command_age_at_invalidate": 0.019470683000001543,
    "old_generation": 1,
    "new_generation": 2,
    "receiptWallSec_before": 42.254684412,
    "receiptWallSec_after_identity": 42.254684412,
    "freshness_preserved": true,
    "first_tick_after_invalidate_wall": 42.292656459999996,
    "age_at_first_tick": 0.03797204799999321,
    "fresh_at_first_tick": true,
    "first_tick_precedes_neutral": true,
    "neutral_receipt_wall": 42.293452841,
    "invalidate_to_neutral_gap": 0.019280318999996382,
    "neutral_accepted": true,
    "receiptWallSec_after_neutral": 42.293452841,
    "original_timeout_deadline": 42.754684412,
    "effective_timeout_deadline_before_neutral": 42.754684412,
    "timeout_deadline_unchanged": true,
    "pre_neutral_tick_count": 1,
    "pre_neutral_tick_observations": [
      {
        "wall_sec": 42.062688429000005,
        "wall_time_sec": 42.292656459999996,
        "simulation_time": 57.46000000000338,
        "last_rx_index": 3888,
        "claimed": true,
        "phase": "ACTIVE",
        "generation": 2,
        "receiptWallSec": 42.254684412,
        "age": 0.03797204799999321,
        "fresh": true,
        "pending": {
          "reason": "TASK_COMPLETE",
          "episode": 1,
          "generation": 2,
          "rx_index": 3888,
          "startWallSec": 42.274356198,
          "manualWallSec": null,
          "neutralAccepted": false
        },
        "action": "EXTERNAL"
      }
    ],
    "note": "No tick is forced into the observed network gap; absent first/pre-neutral tick is reported null/zero. Deterministic tests cover the exact historical gap.",
    "checks": {
      "timestamp_preserved": true,
      "deadline_not_extended": true,
      "all_other_limiter_state_preserved": true,
      "real_neutral_receipt": true,
      "pre_neutral_ticks_original_deadline": true
    },
    "passed": true
  },
  "authority_transition": {
    "physics_policy": "HOLD_PHYSICS_AFTER_MANUAL_UNTIL_TERMINAL_STATUS",
    "manual_rx_index": 3890,
    "terminal_status_rx_index": 3891,
    "terminal_handoff_wait_count": 0,
    "automatic_execution_abort_count": 0,
    "generation3_observed": false,
    "external_tick_without_ownership_count": 0,
    "terminal_handoff_waits": [],
    "completed": [
      {
        "reason": "TASK_COMPLETE",
        "episode": 1,
        "generation": 2,
        "rx_index": 3888,
        "startWallSec": 42.274356198,
        "manualWallSec": 42.293532498,
        "neutralAccepted": true,
        "status": "TASK_COMPLETE",
        "statusWallSec": 42.293555795
      }
    ],
    "final_receiver_phase": "TASK_COMPLETE",
    "terminal_error": null,
    "external_command_timeout_sec": 0.5,
    "terminal_status_watchdog_sec": 0.5,
    "checks": {
      "fixed_physics_policy": true,
      "no_external_without_ownership": true,
      "waits_only_trusted_manual": true,
      "no_physical_step_during_wait": true,
      "bounded_clean_completion": true,
      "no_abort_or_generation3": true,
      "manual_before_complete": true
    },
    "passed": true
  }
}
