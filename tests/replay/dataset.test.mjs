import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { build, sourceDefault } from '../../tools/build-p8g-replay-dataset.mjs';
import { validateDataset, loadReplay } from '../../site/js/replay/replay-loader.js';
import { enuPositionToOpenWater,openWaterPositionToENU,enuQuaternionToOpenWater,openWaterQuaternionToENU,openWaterHeadingRad,rotateVector } from '../../site/js/twin/coordinate-adapter.js';
const base=resolve('site/replay-data/p8f2-ar10');
const read=async(p)=>JSON.parse(await readFile(p,'utf8'));
const d={};for(const name of ['manifest','frames','plans','targets','events','metrics'])d[name]=await read(resolve(base,name+'.json'));
const sourceAvailable=await access(resolve(sourceDefault,'telemetry.json')).then(()=>true,()=>false);
const sourceOnly={skip:sourceAvailable?false:'Frozen Planner checkout required for raw-source parity; dataset loader tests still run'};
const raw=sourceAvailable?await read(resolve(sourceDefault,'telemetry.json')):[], result=sourceAvailable?await read(resolve(sourceDefault,'result.json')):null;
test('A B F G H I K L M N O P Q: dataset contract and original identities',sourceOnly,async()=>{
  validateDataset(d);
  assert.deepEqual(d.plans,await read(resolve(sourceDefault,'frontend_plans.json')));
  assert.deepEqual(d.metrics.rule15,await read(resolve(sourceDefault,'rule15_actual_audit.json')));
  const s=await read(resolve(sourceDefault,'summary.json'));
  assert.deepEqual(d.metrics.cpa,s.actual_sampled_dynamic_CPA);
  assert.deepEqual(d.metrics.bank,s.actual_sampled_bank_minimum);
  assert.equal(Math.min(...d.frames.map(f=>f.dynamic_clearance)),s.actual_sampled_dynamic_CPA.buffered_clearance);
  assert.equal(Math.min(...d.frames.map(f=>f.bank_margin)),s.actual_sampled_bank_minimum.bank_buffered);
});
test('C D E: every actual pose and basis, heading, bow, roll/pitch directions',sourceOnly,()=>{
  const states=[result.initial,...raw.map(r=>r.state)];
  for(let i=0;i<states.length;i++){
    const s=states[i],f=d.frames[i];assert.deepEqual(f.pose,s.pose);
    assert.deepEqual(f.body,s.velocity.body);assert.deepEqual(f.actuator,s.actuator);assert.deepEqual(f.control,s.control);
    if(i)assert.equal(f.active_plan_id,raw[i-1].active_plan_id);
    assert.deepEqual(openWaterPositionToENU(enuPositionToOpenWater(s.pose.position)),s.pose.position);
    const q=enuQuaternionToOpenWater(s.pose.orientation);
    assert.deepEqual(openWaterQuaternionToENU(q),s.pose.orientation);
    assert.ok(Math.abs(openWaterHeadingRad(q)-s.pose.headingRad)<1e-12);
    // All three basis directions commute with P R P^-1, including roll/pitch and yaw sign.
    for(const v of [{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}]){
      const a=enuPositionToOpenWater(rotateVector(v,s.pose.orientation));
      const b=rotateVector(enuPositionToOpenWater(v),q);
      for(const k of ['x','y','z'])assert.ok(Math.abs(a[k]-b[k])<1e-12);
    }
    const bow=rotateVector({x:0,y:0,z:1},q);
    assert.ok(Math.abs(Math.atan2(bow.x,bow.z)-s.pose.headingRad)<1e-12);
  }
});
test('J: all CV truth snapshots exactly preserved',sourceOnly,async()=>assert.deepEqual(d.targets,await read(resolve(sourceDefault,'obstacle_truth.json'))));
test('deterministic double export; source bytes unchanged',sourceOnly,async()=>{
  const before=await Promise.all(Object.keys(d.manifest.source_files).map(n=>readFile(resolve(sourceDefault,n))));
  const dir=await mkdtemp(resolve(tmpdir(),'p8g-'));
  try{
    await build(sourceDefault,dir+'/a');await build(sourceDefault,dir+'/b');
    for(const name of await readdir(dir+'/a')){
      assert.deepEqual(await readFile(dir+'/a/'+name),await readFile(dir+'/b/'+name));
      assert.deepEqual(await readFile(dir+'/a/'+name),await readFile(base+'/'+name));
    }
    const after=await Promise.all(Object.keys(d.manifest.source_files).map(n=>readFile(resolve(sourceDefault,n))));
    assert.deepEqual(after,before);
  }finally{await rm(dir,{recursive:true});}
});
const fetchLocal=async(url)=>{try{return new Response(await readFile(resolve('site',url)));}catch{return new Response('',{status:404});}};
test('loader validates pinned manifest, every dataset file and original GLB',async()=>{
  const loaded=await loadReplay('replay-data/p8f2-ar10/',fetchLocal);assert.equal(loaded.frames.length,1915);
});
test('missing/tampered manifest, frame data, asset and invalid contracts fail closed',async()=>{
  for(const name of ['manifest.json','frames.json','zodiac_boat.glb']){
    await assert.rejects(loadReplay('replay-data/p8f2-ar10/',async u=>u.endsWith(name)?new Response('tampered'):fetchLocal(u)),/REPLAY_DATA_VALIDATION_FAILED/);
    await assert.rejects(loadReplay('replay-data/p8f2-ar10/',async u=>u.endsWith(name)?new Response('',{status:404}):fetchLocal(u)),/REPLAY_DATA_VALIDATION_FAILED/);
  }
  for(const edit of [x=>x.frames.pop(),x=>x.frames[1].time=NaN,x=>x.manifest.target.radius_m=3,x=>x.plans[0].plan_start_sim_time=0,x=>x.metrics.rule15.passed=false]){
    const copy=structuredClone(d);edit(copy);assert.throws(()=>validateDataset(copy),/REPLAY_DATA_VALIDATION_FAILED/);
  }
});
