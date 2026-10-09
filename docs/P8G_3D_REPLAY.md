# P8G — frozen historical replay
PAPER_VISUALIZATION only. Source: P8F2 H2 run_20261009T065318Z_h2.
The source retains P8F2_AR10_OPENWATER_DYNAMIC_PASS. No solver or physical simulation is run.
Dataset: 1914 physical ticks plus one separately identified initial snapshot, 7 activated plans, 6 switches.
Run the exporter with Node: tools/build-p8g-replay-dataset.mjs. Optional positional arguments are source directory and output directory.
The manifest pins original file hashes, derived file hashes, original source commits, and the unmodified Zodiac GLB.
The checked-in replay-identity.js pins the manifest itself. Missing or tampered data fail closed.
Independent safety values come from the original CSV audit and summary; Rule15 comes from rule15_actual_audit.json.
Native SWITCH time and first observed telemetry activation are kept separately. The display uses telemetry identity.
The initial snapshot uses native STARTUP_ACTIVE identity. Missing initial tracking/physical-command data are NOT_RECORDED.
