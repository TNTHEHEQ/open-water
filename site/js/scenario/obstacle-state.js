// Simulator-owned constant-velocity truth. All positions ENU m, velocity m/s.
export function obstacleAt(o, simulationTime) {
  if (!Number.isFinite(simulationTime) || !Number.isFinite(o.referenceTime)) throw new TypeError('Invalid time');
  return { id: o.id, position: {
    x: o.position.x + o.velocity.x * (simulationTime - o.referenceTime),
    y: o.position.y + o.velocity.y * (simulationTime - o.referenceTime),
  }, velocity: { ...o.velocity }, radius_m: o.radius_m, prediction_model: 'CONSTANT_VELOCITY' };
}
export function predictionPoints(o, horizonSec) {
  if (!Number.isFinite(horizonSec) || horizonSec <= 0) throw new TypeError('Invalid horizon');
  return [{ ...o.position }, { x: o.position.x + horizonSec * o.velocity.x,
    y: o.position.y + horizonSec * o.velocity.y }];
}
