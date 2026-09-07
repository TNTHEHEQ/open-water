# Experiment Recorder

**Plant = 240 Hz. Recorder default = 50 Hz.** Recorder consumes finalized TwinState
v1 only. It has no Boat/WaveField/actuator reference and never modifies the state.

## Sampling rate

`SIMULATOR_CONFIG.recorderSampleRateHz=50`. Sampling uses `state.timestamp` and
`nextSampleSimulationTime`, never Date.now/setInterval. The first available state
is recorded, then the first frame at/after each deadline. Values are not interpolated
or backfilled; low FPS skips slots and increments `skippedSlots`. Duplicate/paused
timestamps produce no duplicate samples. A backward clock or nonfinite sample is
rejected/counts invalidSamples. Call start() for a new timeline.

## Fields and coordinate system

35 numeric columns, ENU/SI, fixed order:

```text
time,x,y,z,roll,pitch,yaw,u,v,w,p,q,r,
propulsion_cmd,propulsion_actual,raw_thrust_N,effective_thrust_N,
steering_cmd_rad,steering_actual_rad,steering_effective_rad,steering_rate_rad_s,
ventilation_factor,wave_Hs_m,wave_Tp_s,
wind_x,wind_y,wind_z,current_x,current_y,current_z,
planing_force_N,CoP_x,CoP_y,CoP_z,submerged_points
```

World vectors/CoP are ENU; body u/v/w and p/q/r follow the named nautical scalar
convention in [TwinState v1](DIGITAL_TWIN_STATE_V1.md), not ENU vector components.
Angles rad, rates rad/s, forces N, speeds m/s, time simulation seconds.
Wind/current are local sampled flow. Hs/Tp are current blended spectrum parameters.

## API / download

After Start Simulation, with `?debug`:

```js
window.openWater.recorder.start('turning'); // clears previous recording
window.openWater.recorder.stop();          // retains data
window.openWater.recorder.getCsv();
window.openWater.recorder.downloadCsv();
window.openWater.recorder.clear();         // stops and clears
```

Small debug buttons provide the same start/stop/download plus CSV preview. Normal
simulation has no experiment panel. Download uses Blob, an anchor with download,
and revokes the temporary object URL. Filename is local wall-clock
`YYYYMMDD-HHMMSS_<sanitized-name>.csv`; wall-clock is used only for naming, not sampling.

## Limits

Default maximum 180000 samples (~1 h at 50 Hz), then recording stops and sets
limitReached. Rows allocate at sampling time; no allocation at each physics step.
getCsv()/download temporarily allocate the complete export. This is an in-memory
experiment recorder, not streaming/persistent storage. Navigating away loses data.
Frame/state-rate logging is not exact 240 Hz logging and may jitter by one frame.

## Validation

Browser recording during external turning and fault tests:
`artifacts/p0b/browser-turning.csv`, 3985 data rows × 35 columns,
simulation time 84.1817–163.8671 s (~50 Hz), no skipped slots in this run.
Header checked, all values finite, times strictly monotonic, no NaN/Infinity.
The browser CSV preview/getCsv path was exercised; OS download interaction is not
claimed as automated acceptance. CSV/artifacts are ignored and not committed.
Unit tests also cover paused/slow frames, row isolation, memory limit, invalid data,
stop/clear and no mutation. Physics observer ON/OFF regression is exactly identical.
