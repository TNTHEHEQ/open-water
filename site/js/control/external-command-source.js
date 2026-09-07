export class ExternalCommandSource {
  constructor() {
    this.command = { propulsionCommand: 0, steeringAngleRad: 0 };
    this.lastReceiptSec = null;
    this.valid = false;
  }
  receive(propulsionCommand, steeringAngleRad, receiptSec) {
    if (![propulsionCommand, steeringAngleRad, receiptSec].every(Number.isFinite)) throw new TypeError('Nonfinite command');
    this.command.propulsionCommand = propulsionCommand;
    this.command.steeringAngleRad = steeringAngleRad;
    this.lastReceiptSec = receiptSec;
    this.valid = true;
  }
  invalidate() { this.valid = false; }
  age(now) { return this.lastReceiptSec === null ? null : Math.max(0, now - this.lastReceiptSec); }
  isFresh(now, timeout) { return this.valid && this.age(now) <= timeout; }
}
