# P6B Actuator Mapping Audit

Baselines: planner b6e992d18915029800cf56d271101717141009a5; OpenWater e6951ac506e751ef28ec2897e8db719e59c3c362. Audit performed before any execution implementation. P5A-D and Boat equations remain frozen.

## Source inventory and units

Planner cpp/lifted_stp/nlp/src/problem.cpp::planning_synthetic_params and core/params.hpp: M=[[120,0,0],[0,180,12],[0,12,240]], xp=-1.2m,yp=0m; tauT=.8s,tauDelta=.35s,KT=1.1,KDelta=.9. physics.cpp::outboard uses [T*cos(delta),T*sin(delta),xp*T*sin(delta)-yp*T*cos(delta)]. actuator_rhs uses [(KT*Tc-T)/tauT,(KDelta*deltac-delta)/tauDelta]. T/Tc N; delta/deltac rad. Space-domain transcription multiplies time RHS by sigma; command derivatives are omegaT/omegadelta.

Actual NLP bounds: T in[0,220]N,Tc in[0,200]N,delta +/-0.5rad,deltac +/-0.55rad,omegaT +/-20N/s,omegadelta +/-0.15rad/s,sigma[.25,1]s/m. The names thrustRate/steeringRate in Capability are COMMAND rates; there is no independent actual steering-rate constraint. Negative-force mapping can be unit-tested, but frozen forward-progress NLP does not thereby gain reverse planning.

OpenWater site/js/simulation/vessels.js active Zodiac: maxThrustFwd10500N,maxThrustRev2700N; actuator tau propulsion.6s,steering.35s,limits +/-pi/6rad,actual steering rate pi/4rad/s. These are active VESSEL_SPECS values; eventual capabilities message must publish them, not duplicate them in C++.

outboard-actuator.js: propulsionCommand and actualPropulsion are dimensionless[-1,1]. Commands pass a first-order forward-Euler lag at240Hz. Mechanical steering actual has first-order lag AND actual-rate clipping. The field steeringRateRadPerSec on profile is a limit; the same field on actuator instance is measured step rate. No separate propulsion actual-rate constraint.

boat.js::_step computes rawThrustN=(actualPropulsion>=0?maxThrustFwd:maxThrustRev)*actualPropulsion. effectiveThrustN=rawThrustN*propWet*heelCut*advanceRatio. steeringEffectiveRad=actualSteeringRad/(1+speed*.045). simulation-state-source publishes actualPropulsion as propulsionActual, and actualSteeringRad as steeringActualRad. Current actuator commands are control.propulsionCommand/control.steeringCommandRad. The zero-delay profile is authoritative; ideal regression profile is not P6B target.

## Force mapping and integration profile

Tc>=0 maps to ac=Tc/maxThrustFwd; Tc<0 maps to ac=Tc/maxThrustRev; clamp[-1,1]. Inverse CURRENT COMMAND mapping uses signed max thrust times propulsionCommand, never actual thrust. T0 uses rawThrustN, not effectiveThrustN. Ventilation/heel/advance ratio remain explicit plant mismatch.

Independent integration profile should use plant tauT/tauDelta and unity KT/KDelta for force-command normalization; frozen P5 gains remain unchanged. Preserve conservative force envelope T<=220N,Tc<=200N. Existing deltac bound.55rad exceeds Zodiac pi/6=.523598775598rad: direct inherited capability gate must reject. An explicit integration-only commandSteering=min(.55,plant angular limit) can establish containment without changing frozen config or formulation. Actual rate must be audited from (KDelta*deltac-delta)/tauDelta, including interval behavior, before execution; command-rate limit alone is insufficient.

## Confirmed steering contract conflict — execution gate pending

P6A source-verified frame: planner x forward,y PORT; OpenWater local+z forward,local+x STARBOARD. Planner positive delta produces PORT force. OpenWater boat.js uses dir=(sin(effSteer),0,cos(effSteer)): positive mechanical steering produces STARBOARD force. Stern mounting produces opposite yaw responses after P6A yaw-sign conversion. This applies at all four cardinal headings; changing world heading cannot resolve the local sign conflict. Effective-angle attenuation is positive and does not change the sign.

Therefore attachment sections5/6 same-sign delta0/deltac0 initialization are incompatible with frozen frame and thrust geometry. Section4 direct command equality is conditional on matching signs; that condition is FALSE. This is a confirmed source-contract discrepancy, not an invitation to tune controller gains or change physics.

A mathematically consistent proposed adapter (NOT enabled without resolving the explicit same-sign initialization instruction) is:

    planner.delta0 = -OpenWater.steeringActualRad
    planner.deltac0 = -OpenWater.steeringCommandRad
    OpenWater.steering_angle_rad = -planner.deltac_exec

This single bidirectional sign adapter keeps both physical models unchanged. It is not a guessed negative sign. User clarification requested before execution code. Reversing feedback gains alone cannot repair inconsistent feedforward/state initialization.

Status: STEERING_CONTRACT_CONFLICT_CONFIRMED. No EXTERNAL ownership, no actuator execution, no E1/E2 acceptance, no gain calibration and no tracking-threshold selection yet. Numerical reproduction and actuator step diagnostic are independent audit work only.