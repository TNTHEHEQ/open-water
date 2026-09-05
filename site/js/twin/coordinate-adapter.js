// OW: X east, Y up, Z north. P swaps Y/Z, det(P)=-1.
// Polar vectors use P; axial vectors use det(P)*P; rotations use P R P^-1.
export function openWaterPositionToENU(v, out = {}) {
  const { x, y, z } = v;
  out.x = x; out.y = z; out.z = y;
  return out;
}
export const enuPositionToOpenWater = openWaterPositionToENU;
export const openWaterVelocityToENU = openWaterPositionToENU;
export const enuVelocityToOpenWater = openWaterPositionToENU;
export function openWaterAngularVelocityToENU(v, out = {}) {
  const { x, y, z } = v;
  out.x = -x; out.y = -z; out.z = -y;
  return out;
}
export const enuAngularVelocityToOpenWater = openWaterAngularVelocityToENU;
export function openWaterQuaternionToENU(q, out = {}) {
  const { x, y, z, w } = q;
  out.x = -x; out.y = -z; out.z = -y; out.w = w;
  return out;
}
export const enuQuaternionToOpenWater = openWaterQuaternionToENU;

// Pure-data rotation, no Three dependency; also safe for in-place output.
export function rotateVector(v, q, out = {}) {
  const { x, y, z } = v;
  const tx = 2 * (q.y * z - q.z * y);
  const ty = 2 * (q.z * x - q.x * z);
  const tz = 2 * (q.x * y - q.y * x);
  out.x = x + q.w * tx + q.y * tz - q.z * ty;
  out.y = y + q.w * ty + q.z * tx - q.x * tz;
  out.z = z + q.w * tz + q.x * ty - q.y * tx;
  return out;
}
// Navigation heading: north=0, east=+pi/2; clockwise, wrapped [-pi,pi].
export function openWaterHeadingRad(q) {
  return Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
}
