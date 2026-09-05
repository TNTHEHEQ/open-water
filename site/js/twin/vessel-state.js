const vector = () => ({ x: 0, y: 0, z: 0 });
export function createVesselState(vesselId = 'usv001') {
  return {
    schemaVersion: 0, vesselId, source: 'SIM', sequence: 0, timestamp: 0,
    pose: { position: vector(), orientation: { x: 0, y: 0, z: 0, w: 1 }, headingRad: 0 },
    velocity: { linear: vector(), angular: vector(), body: {
      surge: 0, sway: 0, heave: 0, rollRate: 0, pitchRate: 0, yawRate: 0,
    } },
    control: { throttleCommand: 0, steeringCommand: 0, actualSteeringRad: 0,
      propulsion: { type: 'single_outboard', thrustN: 0, ventilationFactor: 1 } },
    attitude: { rollRad: 0, pitchRad: 0, yawRad: 0 },
    environment: { seaState: 0, localWaterHeight: 0,
      waterVelocity: vector(), current: vector(), wind: vector() },
    dynamics: { planingForceN: 0, centerOfPressure: vector(), submergedPoints: 0 },
  };
}

// Explicit debug/transport operation, never called by the animation loop.
export function snapshotVesselState(state) { return JSON.parse(JSON.stringify(state)); }

// Strict v0 contract: reject extra fields as well as Three instances/functions/cycles.
// Validation is opt-in for development/tests, not a per-frame deep walk.
export function validateVesselState(state) {
  const template = createVesselState();
  function check(value, shape, path) {
    if (typeof shape === 'object') {
      if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(`${path}: expected plain object`);
      const keys = Object.keys(shape);
      if (Object.keys(value).length !== keys.length) throw new TypeError(`${path}: unexpected fields`);
      for (const key of keys) check(value[key], shape[key], `${path}.${key}`);
    } else if (typeof value !== typeof shape || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new TypeError(`${path}: invalid value`);
    }
  }
  check(state, template, 'state');
  const q = state.pose.orientation;
  if (state.schemaVersion !== 0 || state.source !== 'SIM' || !state.vesselId
      || state.control.propulsion.type !== 'single_outboard'
      || !Number.isSafeInteger(state.sequence) || state.sequence < 0 || state.timestamp < 0
      || !Number.isInteger(state.dynamics.submergedPoints) || state.dynamics.submergedPoints < 0
      || Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6
      || Math.abs(state.control.throttleCommand) > 1 || Math.abs(state.control.steeringCommand) > 1
      || state.control.propulsion.ventilationFactor < 0 || state.control.propulsion.ventilationFactor > 1) {
    throw new RangeError('Invalid VesselState v0 identity, quaternion or control range');
  }
  return true;
}
