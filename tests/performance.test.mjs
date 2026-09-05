import assert from 'node:assert/strict';
import test from 'node:test';

function installBrowserStubs(search = '') {
  const storage = new Map();
  Object.defineProperties(globalThis, {
    location: { configurable: true, value: { search } },
    screen: { configurable: true, value: { width: 1920, height: 1080 } },
    devicePixelRatio: { configurable: true, value: 1 },
    localStorage: {
      configurable: true,
      value: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
      },
    },
  });
  return storage;
}

function rendererStub() {
  const gl = { getExtension: () => null };
  return {
    capabilities: { isWebGL2: false },
    getContext: () => gl,
    info: { render: { calls: 12, triangles: 3456 } },
  };
}

test('manual quality mode is selected, persisted and reported', async () => {
  const storage = installBrowserStubs('?quality=medium');
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const changes = [];
  const manager = new PerformanceManager(rendererStub(), { onChange: quality => changes.push(quality) });

  assert.equal(manager.auto, false);
  assert.equal(manager.profile.id, 'medium');
  manager.setMode('ultra');
  assert.equal(manager.profile.id, 'ultra');
  assert.equal(storage.get('ocean-boat:quality-mode'), 'ultra');
  assert.equal(changes.at(-1).id, 'ultra');
  assert.deepEqual(manager.stats, {
    profile: 'ultra', mode: 'manual', scale: 1,
    frameP95: 0, cpuP95: 0, gpuP90: 0,
    targetFps: 60, calls: 12, triangles: 3456,
  });
});

test('adaptive quality lowers render scale under sustained overload', async () => {
  installBrowserStubs();
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const changes = [];
  const manager = new PerformanceManager(rendererStub(), { onChange: quality => changes.push(quality) });
  manager.auto = true;
  manager.active = true;
  manager.tier = 2;
  manager.scale = 1;
  manager.lastAdjust = 0;
  manager.lastChange = 0;
  manager.frameTimes = Array(45).fill(30);
  manager.cpuTimes = Array(45).fill(20);

  manager._adjust(2000);

  assert.equal(manager.tier, 2);
  assert.equal(manager.scale, 0.9);
  assert.equal(changes.length, 1);
  assert.equal(manager.frameTimes.length, 0, 'samples must reset after a quality change');
});

test('frame sampling rejects long pauses and caps its rolling window', async () => {
  installBrowserStubs('?quality=low');
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const manager = new PerformanceManager(rendererStub());
  manager.beginFrame(0);
  manager.beginFrame(300);
  assert.deepEqual(manager.frameTimes, []);
  for (let i = 1; i <= 200; i++) manager.beginFrame(300 + i * 16);
  assert.equal(manager.frameTimes.length, 180);
  assert.ok(manager.frameTimes.every(value => value === 16));
});

test('quality profiles scale expensive budgets monotonically', async () => {
  installBrowserStubs();
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const manager = new PerformanceManager(rendererStub());
  const profiles = ['low', 'medium', 'high', 'ultra'].map(id => {
    manager.setMode(id);
    return manager.quality;
  });
  const monotonicKeys = [
    'dprMax', 'scaleMin', 'scaleStart', 'msaa', 'shadowSize', 'reflectionSize',
    'refractionScale', 'physicsHz', 'physicsMaxSteps', 'oceanFarSegments',
    'oceanPatchSegments', 'oceanNormalDetail', 'particleScale', 'rainScale',
    'cloudOctaves',
    'cloudShadowScale',
  ];

  assert.deepEqual(profiles.map(profile => profile.id), ['low', 'medium', 'high', 'ultra']);
  assert.deepEqual(profiles.map(profile => profile.smaa), [false, true, true, true]);
  for (const key of monotonicKeys) {
    const values = profiles.map(profile => profile[key]);
    assert.deepEqual(values, [...values].sort((a, b) => a - b), `${key} must be monotonic`);
  }
  for (const profile of profiles) {
    assert.ok(profile.scaleMin > 0 && profile.scaleMin <= profile.scaleStart);
    assert.ok(profile.scaleStart <= 1);
    assert.ok(profile.reflectionSize > 0);
    assert.ok(profile.refractionScale > 0 && profile.refractionScale <= 1);
  }
});

test('quality snapshots cannot mutate the manager profile', async () => {
  installBrowserStubs('?quality=high');
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const manager = new PerformanceManager(rendererStub());
  const snapshot = manager.quality;
  snapshot.shadowSize = 1;
  snapshot.id = 'changed';

  assert.equal(manager.profile.id, 'high');
  assert.equal(manager.quality.shadowSize, 1536);
});

test('adaptive quality drops a tier only after reaching the profile scale floor', async () => {
  installBrowserStubs();
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const changes = [];
  const manager = new PerformanceManager(rendererStub(), { onChange: quality => changes.push(quality) });
  manager.auto = true;
  manager.active = true;
  manager.tier = 2;
  manager.scale = manager.profile.scaleMin;
  manager.lastAdjust = 0;
  manager.lastChange = 0;
  manager.frameTimes = Array(45).fill(30);
  manager.cpuTimes = Array(45).fill(20);

  manager._adjust(2000);

  assert.equal(manager.tier, 1);
  assert.equal(manager.scale, manager.profile.scaleStart);
  assert.equal(changes.length, 1);
});

test('adaptive recovery respects cooldown before increasing render scale', async () => {
  installBrowserStubs();
  const { PerformanceManager } = await import('../site/js/runtime/performance.js');
  const changes = [];
  const manager = new PerformanceManager(rendererStub(), { onChange: quality => changes.push(quality) });
  manager.auto = true;
  manager.active = true;
  manager.tier = 2;
  manager.scale = 0.8;
  manager.lastAdjust = 0;
  manager.lastChange = 1000;
  manager.frameTimes = Array(45).fill(16);
  manager.cpuTimes = Array(45).fill(4);

  manager._adjust(3000);
  assert.equal(manager.scale, 0.8);
  assert.equal(changes.length, 0);

  manager.lastAdjust = 3000;
  manager._adjust(5000);
  assert.equal(manager.scale, 0.9);
  assert.equal(changes.length, 1);
});
