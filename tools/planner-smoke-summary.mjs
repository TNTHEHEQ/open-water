function response(states, command, actual, target) {
  const start = states.findIndex(s => Math.abs(command(s) - target) < 1e-8);
  if (start < 1) return null;
  const before = states[start - 1], t0 = before.timestamp, initial = actual(before);
  const tail = states.slice(start), fraction = s => (actual(s) - initial) / (target - initial);
  const crossing = threshold => { const s = tail.find(s => fraction(s) >= threshold); return s ? s.timestamp - t0 : null; };
  let lastOutside = -1; tail.forEach((s, i) => { if (Math.abs(1 - fraction(s)) > .02) lastOutside = i; });
  return { t10: crossing(.1), t50: crossing(.5), t90: crossing(.9),
    settling: lastOutside < tail.length - 1 ? tail[lastOutside + 1].timestamp - t0 : null,
    maxRate: Math.max(...tail.map(s => Math.abs(s.actuator.steeringRateRadPerSec))),
    commandObservationIntervalSec: states[start].timestamp - t0 };
}
export function summarizeSmoke(messages, experiment) {
  const states = messages.map(m => m.state); if (!states.length) return { rows: 0 };
  const t0 = states[0].timestamp, subset = (a, b) => states.filter(s => s.timestamp - t0 >= a && s.timestamp - t0 < b);
  const result = { rows: states.length, firstTime: t0, lastTime: states.at(-1).timestamp };
  if (experiment === 'steering-step' || experiment === 'suite') result.steering = response(subset(0, 6), s => s.control.steeringCommandRad, s => s.actuator.steeringActualRad, Math.PI / 18);
  if (experiment === 'propulsion-step' || experiment === 'suite') result.propulsion = response(experiment === 'suite' ? subset(6, 14) : states, s => s.control.propulsionCommand, s => s.actuator.propulsionActual, .8);
  if (experiment === 'turning' || experiment === 'suite') {
    const tail = experiment === 'suite' ? subset(94, 104) : subset(80, 90);
    const mean = key => tail.reduce((sum, s) => sum + s.velocity.body[key], 0) / tail.length;
    const u = mean('surge'), v = mean('sway'), r = mean('yawRate'); result.turning = { u, v, r, radius: Math.hypot(u, v) / Math.abs(r), sample: tail.at(-1) };
  }
  result.telemetryRateHz = (states.length - 1) / (states.at(-1).timestamp - t0);
  result.typicalBytes = Buffer.byteLength(JSON.stringify(messages[Math.floor(messages.length / 2)]));
  return result;
}
