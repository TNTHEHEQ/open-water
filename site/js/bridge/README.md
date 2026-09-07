# Planner bridge

Browser native WebSocket **client**; external test/C++ program is the server.
Off by default. `?planner=ws://127.0.0.1:8765` enables connection after startup.
Connection does not claim control. Send versioned set_control_mode(EXTERNAL), then
control_command with finite propulsion and mechanical radians.

No physics dependency. The bridge writes only to CommandMux/ExternalCommandSource
and reads finalized TwinState v1. A 50 Hz deadline gates validation/serialization;
backpressure drops stale publish opportunities. Receipt-time timeout is 0.5 s.

See [full protocol, examples, acceptance and limits](../../../docs/PLANNER_BRIDGE_PROTOCOL_V1.md).
