# P8G — frozen historical replay
PAPER_VISUALIZATION only. Source: P8F2 H2 run_20261009T065318Z_h2.
The source retains P8F2_AR10_OPENWATER_DYNAMIC_PASS. No solver or physical simulation is run.
Dataset: 1914 physical ticks plus one separately identified initial snapshot, 1919 raw controller reference records, 7 activated plans, 6 switches.
Run the exporter with Node: tools/build-p8g-replay-dataset.mjs. Optional positional arguments are source directory and output directory.
The manifest pins original file hashes, derived file hashes, original source commits, and the unmodified Zodiac GLB.
The checked-in replay-identity.js pins the manifest itself. Missing or tampered data fail closed.
Independent safety values come from the original CSV audit and summary; Rule15 comes from rule15_actual_audit.json.
Native SWITCH time and first observed telemetry activation are kept separately. The future planned suffix uses telemetry identity; reference history uses the execution log's own plan identity.
The initial snapshot uses native STARTUP_ACTIVE identity. Missing initial tracking/physical-command data are NOT_RECORDED.

## Run in Windows Chrome
In WSL:
```sh
cd ~/work/open-water
python3 -m http.server 8089 --bind 127.0.0.1 --directory site
```
Open http://localhost:8089/replay.html in Chrome. No Planner process, backend service or WebSocket is required. Do not open through file://: Web Crypto and asset loading use localhost.
The ordinary index.html and all existing simulation/physics/control files are unchanged.

The default Chase view shows the original Zodiac close up. Press C or the camera button to cycle Chase, Top, Free Orbit and Encounter Overview.
Free Orbit: left-drag rotates, wheel zooms, Shift-drag or right-drag pans. Reset View resets only the camera. Top uses the existing OpenWater screen-up convention (-Z).
Playback supports 0.25, 0.5, 1, 2 and 4 times speed, pause, a time scrubber, exact previous/next physical sample and encounter/event jumps.
Yellow actual telemetry history and cyan Controller reference history contain only records at or before the playhead. Reverse seek retracts both histories and their switch markers. The former entire-future-actual-history option has been removed.
The current tracking reference point is a cyan sphere with a white outline. Actual history, reference history, current reference point and the pale cyan dashed future suffix have independent checkboxes. The future suffix is off by default and retains the original 75 m plan points/epochs. Gray old plans remain optional context.
References come exclusively from the frozen H2 execution.jsonl, including all six duplicate timestamps (source row order is preserved). Each record retains simulation_time, plan_id, desired and actual, plus ENU projections using the original episode frame. The reference polyline uses only desired[0:2]; it is never drawn to the physical boat position.
Seven separate geometries preserve all six plan-switch breaks. Incoming switch rings are visible only after the corresponding raw record; optional dashed reference-jump segments show the exact two adjacent endpoints. There is no smoothing or spline.
For a playhead between recorded samples the marker shows the last recorded point, without interpolation, only inside one 0.02 s sampling interval and covered log range. Unrecorded gaps and times after the last row show NOT_RECORDED and hide the marker. At duplicate timestamps the marker uses the last row in source order; the history retains every row.
The HUD separately identifies controller reference time/plan and physical telemetry time/plan. Neither clock is shifted: reference coverage ends at 57.44000000000338 s, physical telemetry ends at 57.480000000003386 s. During native switches the reference identity can precede telemetry identity by 0.04 s.
Banks use the longitudinal extent of all loaded historical plans and actual samples, rounded outward to 5 m plus 5 m padding: currently s=-5..115 m. Top view fits this display extent. The l=-10/+10 m boundaries, 0.5 m buffer and all planning contracts remain unchanged.

## Numerical and time semantics
- 1915 snapshots = one initial state + 1914 physical ticks. No authoritative downsampling.
- Position is linearly interpolated and quaternion uses SLERP for display. Discrete plan and safety values are left-sampled from the original physical tick.
- Every pose is ENU -> OpenWater using the existing coordinate adapter. All three basis directions and navigation heading are tested at every sample.
- All planned request epochs are unchanged. The 6 native switches precede their first telemetry identity by exactly approximately 0.04 s. Native event markers and observed activation time are deliberately separate.
- Native TASK_COMPLETE is at absolute 57.46000000000338 s; its recorded receiver completion is at 57.480000000003386 s. The latter is the final snapshot/preset and final HUD status. No extra integration is run.
- Worker durations are wall-time annotations, never simulation coordinates. Worker 8 is recorded as discarded in the independent post-terminal audit/summary and never becomes an eighth activated plan.
- Official sampled dynamic minimum: 5.1134505020859 m. Official sampled bank minimum: 1.443611819878718 m.
- Rule15 STARBOARD_ASTERN / PASS is copied from the independent actual audit. Crossing is episode 23.349289238564378 s, own l=-5.530932122651558, target l=6.988205249263309, signed relation=-12.519137371914868 m.
- These values are 50 Hz sampled actual clearance, not continuous 6DOF certification. No interpolated distance is presented as an official metric.

## Visual representation and PNG
Boat.loadModel reuses the original glTF asset, 5.5 m visual length, reversed orientation, 0.6 m visual draft, original material processing and visual rig construction.
The audit footprint is separately the frozen three-circle 6.4 m hull representation; it is not resized to match a prettier visual silhouette.
Boat is only a display container: its original update is invoked with zero; positive time and _step are blocked before reaching physical integration. The outboard rig is static.
The original 4K HDR sky supplies environmental lighting. Display-only normal texture offsets use the playhead time; no WaveField or generated waves drive the vessel. Water stays at a fixed display elevation. The entire boat pose, including heave/roll/pitch, is recorded.
The Water toggle removes the illustrative surface. Paper Mode reduces water reflections/normal contrast and hides most HUD. Neither changes data.
Default rendering is 2x HD; 1x reduces GPU cost and 3x Paper increases export resolution. Paths use cached constant-pixel-width geometry rather than Windows' 1-pixel WebGL lines.
Save PNG exports the current native canvas buffer, adds scenario/source/time/plan/legend and the illustrative-water disclaimer, and downloads it through Chrome.
Six preset times have deterministic source rules in metrics.json. Avoidance initiation means the first sample with absolute actual steering >=0.01 rad (episode 0.88 s); it is a display selection rule, not a new control classification.
Before/after conflict are the immediately adjacent physical samples (23.34 / 23.36 s), so they correctly appear nearly identical.
The six delivered PNGs use Encounter Overview with a fixed camera to permit comparisons; use Chase or Free Orbit for vessel detail.
At a 1600 x 1000 browser viewport, the 2x canvas PNG is 3200 x 1670. PNGs are presentation artifacts, not new numerical evidence.

## Validation
```sh
source ~/bin/usv-env.sh
node --test --import ./tests/register-three.mjs tests/replay/*.test.mjs
npx eslint site/js/replay tests/replay/*.mjs
npx html-validate site/replay.html
```
The full raw parity/export tests require the frozen sibling Planner checkout. They explicitly skip when that checkout is absent (e.g. a standalone OpenWater CI checkout); the bundled dataset integrity and sampler tests still run. The controller-reference supplement ran all 17 tests with zero skips, including raw execution row parity, preserved jumps, repeatable reverse seeks, and SHA256 parity of all 307 P8F2 historical files across both repositories.
Only replay tests were run: the legacy physical simulation suite is outside P8G's permitted scope.
Browser regression is tests/replay/browser-acceptance.cjs. It uses installed Windows Chrome through Playwright, with PLAYWRIGHT_MODULE optionally identifying the existing bundled module and P8G_OUTPUT setting the report destination.
Browser checks cover rendering, all controls/cameras, plan activation identity, request epochs, no future executed trail, deterministic seek, 400-seek stable GPU resources, no live sockets, single dataset load, original glTF identity, terminal state, genuine PNG downloads and rejection of corrupted data.
Chrome extension connection was unavailable; the task explicitly authorized Playwright. Acceptance therefore uses a separate installed Chrome test instance, not the Codex in-app browser. A visible Chrome window was also opened for the user.

## Windows manual acceptance checklist
1. Open localhost:8089/replay.html and confirm both read-only/source labels.
2. Observe the red Zodiac's pointed bow facing its recorded heading in Chase; red target is a circular kinematic disc.
3. Play, pause, change speed and scrub backward. Yellow and cyan histories plus reference switch markers must retract.
4. Jump to Encounter; toggle yellow actual, cyan reference, current reference point and pale cyan dashed future suffix independently.
5. Cycle all cameras; orbit/zoom/pan in Free Orbit; Reset View must keep the playhead.
6. Inspect the 6 SWITCH markers and 7 historical plan IDs.
7. Jump to TASK_COMPLETE, then save a PNG in Paper Mode; source/water labels must be included.
8. After code updates, Ctrl+F5 reloads the viewer. A missing or altered replay file must produce REPLAY_DATA_VALIDATION_FAILED.

## Controller-reference supplement evidence
Current evidence and updated screenshots: results/p8g_controller_reference/. Original results/p8g_3d_replay/ reports remain snapshots of the prior P8G delivery; their hashes describe that earlier commit. No P8F2 source, planner, controller, N120, 75 m lookahead, or official PASS metric changed.
