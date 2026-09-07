import { VesselStateSource } from './vessel-state-source.js';
import { createVesselState } from './vessel-state.js';
import { openWaterPositionToENU, openWaterQuaternionToENU,
  openWaterAngularVelocityToENU, openWaterHeadingRad, rotateVector } from './coordinate-adapter.js';

export class SimulationStateSource extends VesselStateSource {
  constructor(boat, waveField, vesselId = 'usv001') {
    super();
    this.boat = boat; this.water = waveField;
    this.state = createVesselState(vesselId);
    this._v = { x: 0, y: 0, z: 0 };
    this._inverse = { x: 0, y: 0, z: 0, w: 1 };
  }
  getState() { return this.state; }
  update() {
    const b = this.boat, s = this.state, q = b.quat, v = this._v;
    s.sequence++; s.timestamp = this.water.time;
    openWaterPositionToENU(b.pos, s.pose.position);
    openWaterQuaternionToENU(q, s.pose.orientation);
    s.pose.headingRad = openWaterHeadingRad(q);
    openWaterPositionToENU(b.vel, s.velocity.linear);
    rotateVector(b.angVelB, q, v);
    openWaterAngularVelocityToENU(v, s.velocity.angular);
    this._inverse.x = -q.x; this._inverse.y = -q.y;
    this._inverse.z = -q.z; this._inverse.w = q.w;
    rotateVector(b.vel, this._inverse, v);
    const body = s.velocity.body;
    body.surge = v.z; body.sway = v.x; body.heave = v.y;
    // Named nautical scalars: forward/starboard/up; roll starboard-down,
    // pitch bow-up, yaw clockwise. These are not a second ENU vector.
    body.rollRate = -b.angVelB.z; body.pitchRate = -b.angVelB.x; body.yawRate = b.angVelB.y;
    s.attitude.rollRad = -Math.atan2(2 * (q.x * q.y + q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z));
    s.attitude.pitchRad = Math.asin(Math.max(-1, Math.min(1, 2 * (q.y * q.z - q.w * q.x))));
    s.attitude.yawRad = s.pose.headingRad;
    const d = b.diagnostics;
    s.control.propulsionCommand = d.propulsionCommand;
    s.control.steeringCommandRad = d.steeringCommandRad;
    s.actuator.propulsionActual = d.actualPropulsion;
    s.actuator.rawThrustN = d.rawThrustN;
    s.actuator.effectiveThrustN = d.effectiveThrustN;
    s.actuator.steeringActualRad = d.steeringActualRad;
    s.actuator.steeringEffectiveRad = d.steeringEffectiveRad;
    s.actuator.steeringRateRadPerSec = d.steeringRateRadPerSec;
    s.actuator.ventilationFactor = d.ventilationFactor;
    s.environment.seaState = this.water.preset;
    s.environment.localWaterHeight = this.water.heightAt(b.pos.x, b.pos.z);
    // Boat already sampled these at its final COM after stepping; no duplicate query.
    openWaterPositionToENU(b._waterVel, s.environment.waterVelocity);
    openWaterPositionToENU(b.surfaceCurrent, s.environment.current);
    openWaterPositionToENU(b.trueWind, s.environment.wind);
    s.dynamics.planingForceN = b.diagnostics.planingForceN;
    openWaterPositionToENU(b.diagnostics.centerOfPressure, s.dynamics.centerOfPressure);
    s.dynamics.submergedPoints = b.diagnostics.submergedPoints;
    return s;
  }
}
