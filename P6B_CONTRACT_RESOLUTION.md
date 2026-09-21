# P6B-C1 Contract Resolution

**ACTUATOR_CONTRACT_RESOLVED; overall P6B FAIL.** Real-state calibration, E1 and E2 snapshots fail planning before execution. This closes the authorized interface discrepancy, not tracking acceptance.

The user's P6B-C1 instruction supersedes original P6B section 5's same-sign initialization. The original `P6B_ACTUATOR_MAPPING_AUDIT.md`, STOPPED validation, minimal reproduction and cardinal evidence remain byte-for-byte unchanged. This is an additive resolution.

## Boundary contract

Planner internal states, desired states, errors, feedforward and feedback use the frozen planner frame. `cpp/lifted_stp/openwater/execution/actuator_adapter.hpp` owns:

```text
planner_delta_0  = -OW.steeringActualRad                 [rad]
planner_deltac_0 = -OW.steeringCommandRad                [rad]
OW.steering_angle_rad = -planner_deltac_exec            [rad]
planner_actual_delta_dot = -OW.actual_delta_dot        [rad/s]
OW.command_delta_dot = -planner_omega_delta            [rad/s]
OW interval [min,max] -> planner [-max,-min]            [rad]
```

P6A `v=-sway`, `r=-yawRate` remain unchanged and apply exactly once. For origin (E0,N0) and frozen navigation heading h0:

```text
x = sin(h0)*(E-E0) + cos(h0)*(N-N0)
y = -cos(h0)*(E-E0) + sin(h0)*(N-N0)
psi = wrap(h0-heading_OW)
E = E0 + sin(h0)*x - cos(h0)*y
N = N0 + cos(h0)*x + sin(h0)*y
heading_OW = wrap(h0-psi)
```

Planner +y is port. Positive planner delta produces port force at the stern and negative planner yaw acceleration. The reflected OW command gives corresponding force/yaw signs at all cardinal headings. Effective steering attenuation, mass, hull dynamics, thrust attenuation and 6DOF effects remain model differences. Sign tests do not prove hydrodynamic equivalence.

## Actual state and independent profile

`T0=rawThrustN`. `Tc0=propulsionCommand * maxThrustFwd` for nonnegative authoritative command, otherwise `* maxThrustRev`. No command is inferred from actual thrust. Effective thrust remains a separate plant diagnostic. Position, velocity and actual actuator states are never clamped or replaced by a synthetic steady state.

Profile `OW_RAW_FORCE_STEERING_REFLECTION_V1` copies frozen M, geometry and hydro coefficients, sets KT=Kdelta=1 and reads active `plant_capabilities`. Recorded Zodiac values:

| Field | Integration value |
|---|---:|
| KT / Kdelta | 1 / 1 |
| tauT / tauDelta | 0.6 s / 0.35 s |
| Forward / reverse raw-force gain | 10500 N / 2700 N |
| T / Tc | [0,220] N / [0,200] N |
| Actual delta / command delta | +/-0.5 rad / +/-pi/6 rad |
| Command omegaT / omegaDelta | +/-20 N/s / +/-0.15 rad/s |
| Sigma | [0.25,1] s/m |
| Plant actual steering-rate limit | pi/4 rad/s |

The command envelope intersects the mapped plant interval. Frozen Capability stores symmetric magnitudes, so an asymmetric plant uses the conservative symmetric subset of that intersection. The general interval converter preserves the exact reflected asymmetric interval. Reverse force mapping tests do not imply reverse planning; the forward-progress planner rejects reverse initial commands.

The initial force-envelope comparison allows 1e-10 N floating-point roundoff: `200/10500*10500` is 200.00000000000003 N. The observed value is retained, not clamped; 200.001 N is rejected. This does not relax solver/tracking thresholds. The earlier literal-bound rejection remains in `feedforward/plan-1-error.json`.

Unit gains give `Tdot=(Tc-T)/tauT`, `deltadot=(deltac-delta)/tauDelta`. Frozen KT=1.1, Kdelta=0.9 and tauT=0.8 s remain unchanged. Plan-result audit checks actual steering rate against the plant limit without adding an NLP constraint.

## Evidence and remaining gates

Native tests cover actual/command/rate reflection, round trip, asymmetric bounds, cardinal force/yaw signs, unit gains, containment, unclamped initialization, stale/mismatch rejection, feedback bounds/rates, arming, completion and abort. Browser tests cover real Boat dt=0 hold/natural actuator decay, old P6A/actuator/bridge regressions, timeout, disconnect and late-plan rejection.

The bounded Boat diagnostic used +/-0.04 rad mechanical steering for 8 s. Maximum actual rate 0.11025248 rad/s was below pi/4, with no rate-limiter activation. Differential lateral, heading and yaw responses support negative Ky/Kpsi/Kr for desired-minus-actual errors. Absolute lateral displacement contains residual drift; no full-model parity claim is made.

Tracking gains are NOT selected/frozen: feedforward calibration failed before execution. E1/E2 browser runs are planning diagnostics, not formal tracking acceptance. No numerical acceptance thresholds were selected after these results. See `research/lifted_stp/results/p6b_c1/validation.md` and `initial_interval_diagnostic.json` for failed gates.
