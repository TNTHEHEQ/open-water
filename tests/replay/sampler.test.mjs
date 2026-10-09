import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sampleReplay,suffixStart,ReplayClock} from '../../site/js/replay/replay-state-sampler.js';
const data={};for(const n of ['frames','targets','plans'])data[n]=JSON.parse(await readFile('site/replay-data/p8f2-ar10/'+n+'.json'));
test('R: repeated reverse/random seek preserves source and identical transforms',()=>{
 const before=JSON.stringify(data);
 const times=[data.frames[0].time,39.4,42.54928923856406,data.frames.at(-1).time];
 for(const time of times){const expected=sampleReplay(data,time);for(let i=0;i<300;i++){sampleReplay(data,data.frames[i*7%data.frames.length].time);assert.deepEqual(sampleReplay(data,time),expected);}}
 assert.equal(JSON.stringify(data),before);
});
test('every exact physical time returns its pose/plan; interpolated safety stays sampled',()=>{
 for(const [i,f] of data.frames.entries()){
  const x=sampleReplay(data,f.time);assert.deepEqual(x.position,f.pose.position);assert.equal(x.active_plan_id,f.active_plan_id);assert.equal(x.index,i);
  for(const k of ['x','y','z','w'])assert.ok(Math.abs(x.quaternion[k]-f.pose.orientation[k])<1e-14);
  if(i+1<data.frames.length){const mid=sampleReplay(data,(f.time+data.frames[i+1].time)/2);assert.equal(mid.record,f);assert.equal(mid.active_plan_id,f.active_plan_id);}
 }
});
test('suffix uses unchanged request time; no past point in active range',()=>{
 for(const p of data.plans)for(const f of data.frames.filter(f=>f.active_plan_id===p.plan_id)){
  const s=suffixStart(p,f.time);assert.equal(s.relative,f.time-p.plan_start_sim_time);
  if(s.point)assert.ok(p.points.slice(s.index+1).every(v=>v.t_rel>=s.relative));
 }
});
test('clock anchored to wall time, pause and rates cannot integrate pose or drift',()=>{
 const c=new ReplayClock(19,59);c.play(true,1000);assert.equal(c.tick(2000),20);
 c.rate(4,2000);assert.equal(c.tick(3000),24);c.play(false,3000);assert.equal(c.tick(10000),24);
 c.seek(21,10000);c.play(true,10000);assert.equal(c.tick(11000),25);assert.equal(c.tick(999999),59);assert.equal(c.playing,false);
});
test('S T: display pose calls only update(0), and replay entry has no live control imports',async()=>{
 globalThis.window={location:{search:''}};globalThis.matchMedia=()=>({matches:false});
 const {applyRecordedPose}=await import('../../site/js/replay/replay-vessel.js');
 const calls=[],boat={pos:{},quat:{},update:dt=>calls.push(dt)};
 for(const f of data.frames)applyRecordedPose(boat,sampleReplay(data,f.time));
 assert.ok(calls.every(dt=>dt===0));assert.equal(calls.length,1915);
 for(const name of ['replay-main.js','replay-scene.js','replay-vessel.js','replay-loader.js','replay-state-sampler.js']){
  const src=await readFile('site/js/replay/'+name,'utf8');
  assert.doesNotMatch(src,/new WebSocket|PlannerBridge|SimulationStartup|PlanExecutionController|CommandMux|\.update\((?:dt|frameDt)\)|p8f-run|ipopt/i);
 }
});
