const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// SI mechanical/propulsion state. Profile supplied by vessel; no renderer or UI.
export class OutboardActuator {
  constructor(profile) {
    for (const key of ['steeringMinRad', 'steeringMaxRad', 'steeringTimeConstantSec',
      'propulsionMin', 'propulsionMax', 'propulsionTimeConstantSec']) {
      if (!Number.isFinite(profile[key])) throw new RangeError(`Invalid actuator ${key}`);
    }
    if (!(profile.steeringMinRad < 0 && profile.steeringMaxRad > 0)
        || profile.propulsionMin !== -1 || profile.propulsionMax !== 1
        || profile.steeringTimeConstantSec < 0 || profile.propulsionTimeConstantSec < 0
        || !(profile.steeringRateRadPerSec > 0)
        || profile.steeringDelaySec !== 0 || profile.propulsionDelaySec !== 0) {
      throw new RangeError('Invalid actuator limits or unsupported nonzero delay');
    }
    this.profile = Object.freeze({ ...profile });
    this.reset();
  }
  reset() {
    this.propulsionCommand = 0; this.actualPropulsion = 0;
    this.steeringCommandRad = 0; this.actualSteeringRad = 0;
    this.steeringRateRadPerSec = 0;
  }
  setCommands(propulsionCommand, steeringAngleRad) {
    if (!Number.isFinite(propulsionCommand) || !Number.isFinite(steeringAngleRad)) {
      throw new TypeError('Actuator commands must be finite SI numbers');
    }
    const p = this.profile;
    this.propulsionCommand = clamp(propulsionCommand, p.propulsionMin, p.propulsionMax);
    this.steeringCommandRad = clamp(steeringAngleRad, p.steeringMinRad, p.steeringMaxRad);
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid actuator timestep');
    if (dt === 0) return;
    const p = this.profile, previous = this.actualSteeringRad;
    const error = this.steeringCommandRad - previous;
    // Forward Euler at 240 Hz. Min(dt/T,1) prevents overshoot for unusual large dt.
    const desired = error * (p.steeringTimeConstantSec === 0 ? 1 : Math.min(dt / p.steeringTimeConstantSec, 1));
    const limit = p.steeringRateRadPerSec * dt;
    this.actualSteeringRad = p.steeringTimeConstantSec === 0 && Math.abs(error) <= limit
      ? this.steeringCommandRad
      : clamp(previous + clamp(desired, -limit, limit), p.steeringMinRad, p.steeringMaxRad);
    this.steeringRateRadPerSec = (this.actualSteeringRad - previous) / dt;
    this.actualPropulsion = p.propulsionTimeConstantSec === 0 ? this.propulsionCommand : clamp(this.actualPropulsion
      + (this.propulsionCommand - this.actualPropulsion)
      * (p.propulsionTimeConstantSec === 0 ? 1 : Math.min(dt / p.propulsionTimeConstantSec, 1)),
    p.propulsionMin, p.propulsionMax);
  }
}
