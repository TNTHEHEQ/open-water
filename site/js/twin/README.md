# Twin State v1

One-way SIM observation only. Instantiate `SimulationStateSource(boat, water)`;
call `update()` after the existing `boat.update()`. `getState()` is a reusable,
read-only-by-contract internal view; `snapshot()` is an isolated JSON-safe copy.
Do not put input, physics stepping or Three.js renderer objects in this layer.

ENU position is (OW.x, OW.z, OW.y), but angular velocity is axial and uses
(-OW.x, -OW.z, -OW.y). Quaternion basis conversion negates and swaps its vector
part. See [full schema, signs and units](../../../docs/DIGITAL_TWIN_STATE_V1.md).

`?debug` exposes `window.openWater.twin.getState()` (snapshot). There are no
LIVE/REPLAY implementations, network transport or renderer architecture changes.

P0-A breaks the v0 control schema: commands are propulsion fraction and mechanical radians; actuator actual/effective outputs are separate. No RPM is invented.
