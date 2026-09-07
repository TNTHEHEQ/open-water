import { stateRow, exportCsv } from './csv-export.js';
export class ExperimentRecorder {
  constructor({ sampleRateHz = 50, maxSamples = 180000 } = {}) {
    if (!(Number.isFinite(sampleRateHz) && sampleRateHz >= 1 && sampleRateHz <= 100)
      || !Number.isSafeInteger(maxSamples) || maxSamples < 1) throw new RangeError('Invalid recorder limits');
    this.sampleRateHz = sampleRateHz; this.period = 1 / sampleRateHz; this.maxSamples = maxSamples;
    this.name = 'experiment'; this.clear();
  }
  start(name = 'experiment') { this.clear(); this.name = String(name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'experiment'; this.recording = true; }
  stop() { this.recording = false; }
  clear() { this.recording = false; this.rows = []; this.nextSampleSimulationTime = null; this.lastTime = -Infinity; this.skippedSlots = 0; this.limitReached = false; this.invalidSamples = 0; }
  update(state) {
    if (!this.recording) return;
    const t = state.timestamp;
    if (!Number.isFinite(t) || t < this.lastTime) { this.invalidSamples++; return; }
    if (t === this.lastTime || (this.nextSampleSimulationTime !== null && t + 1e-9 < this.nextSampleSimulationTime)) return;
    let row;
    try { row = stateRow(state); } catch { this.invalidSamples++; return; }
    if (this.nextSampleSimulationTime === null) this.nextSampleSimulationTime = t;
    const slots = Math.floor(Math.max(0, t - this.nextSampleSimulationTime + 1e-9) / this.period) + 1;
    this.skippedSlots += slots - 1; this.nextSampleSimulationTime += slots * this.period;
    this.rows.push(row); this.lastTime = t;
    if (this.rows.length >= this.maxSamples) { this.limitReached = true; this.stop(); }
  }
  getCsv() { return exportCsv(this.rows); }
  downloadCsv() {
    const date = new Date(), pad = n => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const url = URL.createObjectURL(new Blob([this.getCsv()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${stamp}_${this.name}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
