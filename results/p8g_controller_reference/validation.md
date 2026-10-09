# P8G Controller Reference History — validation

Read-only supplement on OpenWater test, starting from b0935286c029ddf8bb64db0a89c0aa4da35ed95b.
Planner remains at 696e1cf18c4b2e59dc37f4d6dd1e980215a9b52b. Both main branches remain unchanged.

## Source and time semantics

The frozen P8F2 H2 execution.jsonl is the only reference source: 1,919 raw rows, seven actually used plans (execution-1 through execution-7), six switches and six duplicate timestamps. All rows preserve simulation_time, plan_id, desired and actual exactly. ENU coordinates use the original episode frame; OpenWater maps (E,N,U) to (x,z,y). Reference display uses desired[0:2]. The small fixed drawing height is only a visual offset; no reference height or physical pose is invented.

Controller reference coverage: 19.19999999999968 through 57.44000000000338 s.
Physical telemetry coverage: 19.19999999999968 through 57.480000000003386 s.
The HUD displays the two original times and plan identities separately. During switches reference identity leads first telemetry observation by about 0.04 s; no clock shift is applied.
The current marker is the last recorded point within a covered 0.02 s sampling interval, never an interpolated position. It is hidden in unrecorded gaps and after reference coverage, including TASK_COMPLETE. At duplicate timestamps the last source-order row supplies the marker; history retains every row.

## Rendering behavior

- Yellow: actual telemetry history through the playhead.
- Cyan: controller reference history through the playhead, seven separate geometries.
- Cyan sphere / white outline: current recorded tracking reference point.
- Pale cyan dashed: unchanged future planned suffix, independent checkbox and off by default.
- Cyan rings: incoming raw reference switch points, shown only once used.
- Optional dashed reference jumps: exact adjacent endpoints at each switch, never joined by a solid history segment.

No latest candidate, worker-8 result, spline, smoothing, retiming or connection to the actual boat position is used. Reverse seek recomputes draw ranges and switch visibility from raw timestamps. The entire-future-actual-history option was removed so actual and reference histories always retract together.
Bank display range is derived from all loaded plans and actual track (s=-5..115 m including plotting padding). Top view fits that range. l=-10/+10 m, buffer=0.5 m, original plan points, 75 m lookahead, N120 and production contracts are unchanged.

## Verification

17 Node replay tests pass, zero failures/skips. They check every raw reference row and independent coordinate projection, duplicates, used plan IDs, segment endpoints/jump distances, all reference timestamp boundaries and reverse seeks, uncovered time behavior, deterministic export, pinned loader integrity (including references.json), original pose/plan/target parity and all 307 P8F2 historical file SHA256 hashes.

The prior migration snapshot's 8,240 historical files were additionally verified unchanged. Frozen hash evidence is historical_hashes.json; numerical evidence is reference_parity.json. ESLint, HTML validation and git diff --check pass.

Chrome evidence is browser_acceptance.json, using installed Windows Chrome 154.0.8037.97 via Playwright. It covers four independent layer switches, all six reference boundary cases before/at/after switch, native-vs-telemetry plan identities, backward seek, current marker absence beyond log coverage, original model, all cameras, PNG downloads, 400 seeks with stable GPU resources, no live WebSocket and fail-closed data loading. No physical simulation or NLP solve was run.

Updated screenshots are in screenshots/: separate layer_executed, layer_referenceHistory, layer_referencePoint and layer_planned images; reference_switch_all_layers; four camera views; six paper PNGs and viewer_CPA.
Original P8G reports in results/p8g_3d_replay remain unchanged as evidence of the prior delivery.

Official P8F2 PASS and sampled minima remain exactly unchanged:
dynamic clearance 5.1134505020859 m; bank margin 1.443611819878718 m.

Final status: PASS. Seven representative images were visually reviewed; image_review.json records the reviewed filenames and findings.
