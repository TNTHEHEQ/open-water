// Loading coordination and the Web Audio gesture only. No game progression.
export class SimulationStartup {
  constructor({ performanceManager, audio, loader, welcome, startButton, body }) {
    Object.assign(this, { performanceManager, audio, loader, welcome, startButton, body });
    this.started = false; this.boatReady = false; this.skyReady = false;
    this.renderedFrames = 0; this.ready = false; this.bound = false;
    this.launchHandler = () => this.launch();
  }
  bind() {
    if (this.bound) return;
    this.bound = true; this.startButton.disabled = true;
    this.startButton.addEventListener('click', this.launchHandler);
  }
  destroy() {
    this.startButton.removeEventListener('click', this.launchHandler); this.bound = false;
  }
  markBoatReady() { this.boatReady = true; this.checkReady(); }
  markSkyReady() { this.skyReady = true; this.checkReady(); }
  frameRendered() { this.renderedFrames++; this.checkReady(); }
  checkReady() {
    if (this.ready || !this.boatReady || !this.skyReady || this.renderedFrames < 3) return;
    this.ready = true; this.loader.hidden = true; this.welcome.hidden = false;
    this.startButton.disabled = false;
    this.startButton.focus({ preventScroll: true });
  }
  launch() {
    if (!this.ready || this.started) return false;
    this.started = true; this.welcome.hidden = true;
    this.body.classList.add('started');
    this.performanceManager.setActive(true);
    try { this.audio.start(); } catch { /* Simulation remains usable without audio. */ }
    return true;
  }
}
