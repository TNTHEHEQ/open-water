import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runRegression } from '../tools/usv0-regression.mjs';
import { loadSingleVessel } from '../site/js/controllers/single-vessel-loader.js';
import { SIMULATOR_CONFIG } from '../site/js/config/simulator-config.js';
import { SimulationStartup } from '../site/js/ui/simulation-startup.js';
import * as THREE from 'three';
import { WaveField } from '../site/js/simulation/waves.js';
import { WakeField } from '../site/js/simulation/wake-field.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/usv0-regression.json',import.meta.url)));
for(const {preset,samples} of fixture.cases) test(`Zodiac sea ${preset}: upstream pose, velocity, planing and wake remain bit-identical`,()=>{
  assert.deepEqual(runRegression(preset),samples);
});
test('single loader requests only Zodiac and retains its unmodified physics profile',async()=>{
  const calls=[]; const boat={setSpec(spec){this.spec=spec;},reset(){},loadModel(...args){calls.push(args);}};
  const camera={setVessel(spec){this.spec=spec;}};
  await loadSingleVessel(boat,camera);
  assert.equal(boat.spec.id,'zodiac_boat'); assert.equal(camera.spec,boat.spec);
  assert.deepEqual(calls,[['./assets/boats/zodiac_boat.glb',5.5,true]]);
  assert.equal(SIMULATOR_CONFIG.wildlife,false);
});
test('startup waits for boat, sky and rendered frames and starts exactly once',()=>{
  const listeners=new Map();let started=0, audio=0;
  const button={addEventListener(k,v){listeners.set(k,v);},removeEventListener(k){listeners.delete(k);},focus(){}};
  const loader={hidden:false},welcome={hidden:true};
  const startup=new SimulationStartup({performanceManager:{setActive(){started++;}},audio:{start(){audio++;}},
    loader,welcome,startButton:button,body:{classList:{add(){}}}});
  startup.bind();startup.bind();assert.equal(listeners.size,1);assert.equal(startup.launch(),false);
  startup.markBoatReady();startup.markSkyReady();startup.frameRendered();startup.frameRendered();
  assert.equal(loader.hidden,false);startup.frameRendered();assert.equal(loader.hidden,true);
  assert.equal(button.disabled,false);listeners.get('click')();assert.equal(started,1);assert.equal(audio,1);
  assert.equal(startup.launch(),false);startup.destroy();assert.equal(listeners.size,0);
});
test('entry point and HTML contain no game or twin runtime; physics/render frame order remains',()=>{
  const main=readFileSync(new URL('../site/js/main.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(main,/AchievementManager|FirstVoyage|createFauna|VesselController|TwinRuntime|KeyB|KeyL/);
  assert.doesNotMatch(html,/achievement|vessel-selector|voyage-intro|unlock/i);
  assert.match(html,/data-wave="1"/);assert.match(html,/data-wave="4"/);
});
test('Zodiac audio fetches no other engine banks or animal calls',async()=>{
  globalThis.navigator ??= {};
  const {BoatAudio}=await import('../site/js/runtime/audio.js');
  const requested=[];const previous=globalThis.fetch;
  globalThis.fetch=async path=>{requested.push(path);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};};
  try{
    const audio=new BoatAudio({}, {engineBank:'zefiro',wildlife:false});audio._requestAssets();
    await Promise.all(audio.assetRequests.values());
    assert.ok(requested.some(p=>p.includes('zefiro-low')));
    assert.ok(requested.some(p=>p.includes('/weather/')));
    assert.ok(requested.every(p=>!p.includes('/animals/')&&!/assault|racer|yacht|seadoo/.test(p)));
  }finally{globalThis.fetch=previous;}
});
test('crossing an aged physical wake changes actual Zodiac 6DOF response',async()=>{
  const {Boat}=await import('../site/js/simulation/boat.js');
  const withWater=new WaveField(), withoutWater=new WaveField(),wake=new WakeField(1);
  const withBoat=new Boat(withWater,new THREE.Scene(),0),withoutBoat=new Boat(withoutWater,new THREE.Scene(),0);
  for(const boat of [withBoat,withoutBoat]){boat.setSpec(VESSEL_SPECS.zodiac_boat);boat.reset();}
  wake._emit(0,0,0,1,withBoat,12,2.1);
  const source=wake.sources[0];source.age=3;
  const x=-(source.beam*.44+source.spreadSpeed*(source.age-.08));
  withWater.setWakeField(wake);
  const heightDelta=withWater.heightAt(x,0)-withoutWater.heightAt(x,0);
  assert.ok(Math.abs(heightDelta)>1e-4);
  for(const boat of [withBoat,withoutBoat]){boat.pos.set(x,.1,0);boat.vel.set(5,0,0);}
  for(let i=0;i<60;i++){
    withWater.update(1/240,x,0);withoutWater.update(1/240,x,0);
    withBoat._step(1/240);withoutBoat._step(1/240);
  }
  assert.ok(withBoat.vel.distanceTo(withoutBoat.vel)>1e-4);
  assert.ok(withBoat.pos.toArray().every(Number.isFinite));
});
