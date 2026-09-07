import { ExternalCommandSource } from './external-command-source.js';
export const ControlMode = Object.freeze({ MANUAL: 'MANUAL', EXTERNAL: 'EXTERNAL' });

// Selection only: this object never steps or resets the physical plant.
export class CommandMux {
  constructor(commandSink, { maxSteerRad, externalCommandTimeoutSec = 0.5 } = {}) {
    if (!(Number.isFinite(maxSteerRad) && maxSteerRad > 0)
      || !(Number.isFinite(externalCommandTimeoutSec) && externalCommandTimeoutSec > 0)) throw new RangeError('Invalid command limits');
    this.commandSink = commandSink;
    this.maxSteerRad = maxSteerRad;
    this.timeoutSec = externalCommandTimeoutSec;
    this.mode = ControlMode.MANUAL;
    this.external = new ExternalCommandSource();
    this.manual = { propulsionCommand: 0, steeringAngleRad: 0 };
    this.safe = Object.freeze({ propulsionCommand: 0, steeringAngleRad: 0 });
    this.failsafe = false;
  }
  // DriveController's normalized UI output ends here, never directly at Boat.
  setControls(throttle, steer) {
    if (!Number.isFinite(throttle) || !Number.isFinite(steer)) throw new TypeError('Invalid manual command');
    this.manual.propulsionCommand = throttle;
    this.manual.steeringAngleRad = Math.max(-1, Math.min(1, steer)) * this.maxSteerRad;
  }
  setMode(mode) {
    if (!Object.values(ControlMode).includes(mode)) throw new RangeError('Invalid control mode');
    // Every ownership request starts with a fresh command, even EXTERNAL→EXTERNAL.
    this.mode = mode;
    this.external.invalidate();
  }
  apply(now) {
    this.failsafe = this.mode === ControlMode.EXTERNAL && !this.external.isFresh(now, this.timeoutSec);
    const command = this.mode === ControlMode.MANUAL ? this.manual : this.failsafe ? this.safe : this.external.command;
    this.commandSink.setActuatorCommands(command);
    return command;
  }
}
