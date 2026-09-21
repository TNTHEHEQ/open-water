# P6B audit gate — NOT COMPLETE

Status: STOPPED_STEERING_CONTRACT_CONFLICT. Source discrepancy confirmed; explicit same-sign initialization conflicts with frozen force/frame conventions. User clarification requested. No execution implementation has been enabled, and no P6B PASS claim is made.

## Requested report status

1. Planner branch: codex/p6b-openwater-execution; this is an audit checkpoint commit, not the requested completed execution implementation.
2. OpenWater branch: codex/p6b-plan-execution; audit checkpoint only.
3. Frozen baselines: planner b6e992d18915029800cf56d271101717141009a5; OpenWater e6951ac506e751ef28ec2897e8db719e59c3c362. All existing production files unchanged; 847 frozen Python hashes unchanged.
4. Actuator mapping audit: P6B_ACTUATOR_MAPPING_AUDIT.md completed before execution code.
5. Capabilities read from active VESSEL_SPECS; wire capability message NOT IMPLEMENTED.
6. Inherited envelope thrust/command fits plant. Command steering .55rad exceeds plant pi/6; integration-only limit must be capped and audited. No frozen bound modified.
7. T0=rawThrustN confirmed as correct raw-actuator quantity; runtime initialization pending.
8. Tc force/normalized forward/reverse/zero/saturation numerical tests PASS; runtime mapping pending.
9. Steering direct mapping FAIL: frozen planner positive delta is port force; positive OpenWater mechanical steering is starboard force. Proposed explicit negative bidirectional adapter is pending approval because attachment section5 explicitly specifies same-sign initial states.
10. Standalone step diagnostic, +/-100N and +/-0.1rad: thrust t10=.0666667s,t50=.4166667s,t90=1.3791667s,2%settling=2.3416667s,max continuous/Euler error=.128106812N. Steering t10=.0375s,t50=.2416667s,t90=.8041667s,2%settling=1.3625s,max error=.000220068557rad. This tests unity-gain continuous actuator equations vs real 240Hz Euler standalone actuator; no effective-thrust/hydrodynamic parity claim.
11. Cardinal force comparison: same positive100N/.1rad input differs19.9666833294N; proposed sign reflection matches force vectors within3.6621e-14N. Frozen Boat._step yaw sign independently confirms the conflict at all four headings.
12-20. Hold/request/execution state machine/ownership/playback/controller/gains/thresholds NOT IMPLEMENTED or NOT_SELECTED pending contract resolution.
21-30. E1/E2 initial snapshots,solves,tracking,actuator tracking,timeouts,terminal errors,saturation: NOT_RUN. No gains or acceptance thresholds have been tuned to a final run.
31. Artifacts: actuator-audit.json, planner-steering-probe.json, P6B_ACTUATOR_MAPPING_AUDIT.md. No execution screenshot exists because execution was not attempted.
32. Selected OpenWater actuator/P6A tests21/21 PASS; audit tool assertions PASS; ESLint PASS. No full new execution/browser test claim.
33. Selected integrated CTest7/7 PASS, covering P5A kernels+fixtures,P5B contract,P5C runtime,P5D template+instance,P6A. Native read-only steering probe builds with Wall/Wextra/Wpedantic. Its standalone -I build reports300 warnings from third-party CasADi headers and zero warning locations in the probe; full diagnostics retained in probe-build.txt.
34. Loopback execution: NOT_RUN; no external commands sent.
35. Physics regression: existing actuator/P6A selection PASS, all production physics files unchanged.
36. Planner regression: selected7 CTests PASS; core/source/history unchanged; no full costly solver matrix rerun.
37. No Boat physics or planner formulation modifications. rawThrust/effectiveThrust roles audited. No execution clock/controller/replanning implementation yet; do not infer completed simulation-time playback from an audit.
38. Final P6B: NOT_COMPLETE / BLOCKED AT CONTRACT GATE, not PASS. This is neither an E1/E2 tracking failure nor a solver failure.
39. P6C: NOT_STARTED. First resolve steering contract, then finish P6B hold/execution/calibration/frozen E1/E2 acceptance before any P6C work.

## Required contract resolution

Keep frozen P6A position/heading/u/v/r adapter and both physical models. Proposed unique conversion:

    planner.delta0 = -OpenWater.steeringActualRad
    planner.deltac0 = -OpenWater.steeringCommandRad
    OpenWater.steering_angle_rad = -planner.deltac_exec

This replaces the explicit same-sign initialization requested in section5. It is source-derived, not a visual tuning adjustment. Do not proceed with an inconsistent same-sign adapter or silently change the golden physical model. Pending user choice remains pending; elapsed time is not authorization.

## Reproduction

The native cpp/lifted_stp/openwater/p6b_audit/steering_probe.cpp calls frozen production planning_synthetic_params,outboard,body_rhs and P6A frame adapter. Build with GCC17 against existing lifted_stp_nlp/physical_validation/kernel and CasADi libraries; capture stdout as planner-steering-probe.json. Exact build command is in the adjacent README.

From OpenWater repo on Windows:

    node --disable-warning=ExperimentalWarning --import ./tests/register-three.mjs tools/p6b-actuator-audit.mjs <absolute-path-to-planner-steering-probe.json>

The audit tool calls the real standalone actuator and frozen Boat._step. Its manufactured initial orientation is unit-test setup, not a plan-execution teleport. No production source or command ownership changes are involved.