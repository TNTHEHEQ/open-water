import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildReferences,sampleReferences,backgroundRange} from '../../site/js/replay/replay-reference-history.js';
import {sourceDefault} from '../../tools/build-p8g-replay-dataset.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const data={};
for(const name of ['references','manifest','frames','plans'])data[name]=await read('site/replay-data/p8f2-ar10/'+name+'.json');
const refs=data.references;
const available=await access(sourceDefault+'/execution.jsonl').then(()=>true,()=>false);
const sourceOnly={skip:available?false:'Frozen Planner checkout required'};
test('all 1919 reference points preserve execution rows, duplicates, coordinates and used plan identities',sourceOnly,async()=>{
  const raw=(await readFile(sourceDefault+'/execution.jsonl','utf8')).trim().split(/\r?\n/).map(r=>JSON.parse(r));
  assert.deepEqual(refs,buildReferences(raw,data.manifest.episode_frame));
  assert.equal(raw.length,1919);
  const frame=data.manifest.episode_frame,c=Math.cos(frame.H_ref),s=Math.sin(frame.H_ref);
  raw.forEach((r,i)=>{
    const q=refs.records[i];
    assert.equal(q.simulation_time,r.simulation_time);assert.equal(q.plan_id,r.plan_id);
    assert.deepEqual(q.desired,r.desired);assert.deepEqual(q.actual,r.actual);
    // Independent ENU projection check, not the exporter function.
    for(const name of ['desired','actual']){
      const [along,lateral]=r[name],enu=q[name+'_enu'];
      assert.ok(Math.abs(enu.x-(frame.E_ref+s*along-c*lateral))<1e-12);
      assert.ok(Math.abs(enu.y-(frame.N_ref+c*along+s*lateral))<1e-12);
    }
  });
  assert.equal(raw.filter((r,i)=>i&&r.simulation_time===raw[i-1].simulation_time).length,6);
  assert.deepEqual([...new Set(raw.map(r=>r.plan_id))],data.plans.map(p=>p.plan_id));
  assert.ok(raw.every(r=>!r.plan_id.endsWith('execution-8')));
});
test('seven disjoint segments preserve six raw jumps without any inserted/smoothed point',()=>{
  assert.equal(refs.segments.length,7);assert.equal(refs.jumps.length,6);
  assert.equal(refs.segments.reduce((n,s)=>n+s.end-s.start,0),1919);
  for(let i=0;i<refs.jumps.length;i++){
    const j=refs.jumps[i],a=refs.records[j.from_index],b=refs.records[j.to_index];
    assert.equal(refs.segments[i].end,j.to_index);assert.equal(refs.segments[i+1].start,j.to_index);
    assert.equal(j.from_index+1,j.to_index);assert.notEqual(a.plan_id,b.plan_id);
    assert.equal(j.distance,Math.hypot(b.desired[0]-a.desired[0],b.desired[1]-a.desired[1]));
    assert.ok(j.distance>0);assert.equal(j.time,b.simulation_time);
  }
});
test('all sample boundaries and reverse/random seeks repeat exactly; no future references or switches',()=>{
  const times=refs.records.flatMap(r=>[r.simulation_time-1e-6,r.simulation_time]);
  times.push(data.manifest.end_time,refs.records[0].simulation_time-1);
  const expected=times.map(t=>sampleReferences(refs,t));
  for(let i=times.length-1;i>=0;i--){
    const result=sampleReferences(refs,times[i]);assert.deepEqual(result,expected[i]);
    const used=refs.records.filter(r=>r.simulation_time<=times[i]);
    assert.equal(result.count,used.length);
    assert.equal(result.segmentCounts.reduce((a,b)=>a+b,0),used.length);
    assert.equal(result.switchCount,refs.jumps.filter(j=>j.time<=times[i]).length);
    if(result.record)assert.ok(result.record.simulation_time<=times[i]);
  }
  assert.equal(sampleReferences(refs,data.manifest.end_time).covered,false);
  assert.equal(sampleReferences(refs,refs.records.at(-1).simulation_time).covered,true);
});
test('current point never interpolates across a switch, across an unrecorded gap or past log end',()=>{
  const fake=buildReferences([
    {simulation_time:1,plan_id:'a',desired:[0,0],actual:[0,0]},
    {simulation_time:1.02,plan_id:'b',desired:[10,2],actual:[0,0]},
    {simulation_time:2,plan_id:'b',desired:[20,3],actual:[0,0]}
  ],data.manifest.episode_frame);
  assert.deepEqual(sampleReferences(fake,1.01).record.desired,[0,0]);
  assert.deepEqual(sampleReferences(fake,1.02).record.desired,[10,2]);
  assert.equal(sampleReferences(fake,1.5).covered,false);
  assert.equal(sampleReferences(fake,2.001).covered,false);
  assert.equal(sampleReferences(fake,.9).count,0);
});
test('background covers complete loaded plans and actual history without altering bank contract',()=>{
  const range=backgroundRange(data);assert.ok(range.max>100);
  assert.ok(data.frames.every(f=>f.s>range.min&&f.s<range.max));
  assert.deepEqual(data.manifest.bank,[-10,10]);assert.equal(data.manifest.bank_buffer,.5);
});
test('all 307 P8F2 historical files retain pre-edit SHA256',sourceOnly,async()=>{
  const hashes=await read('results/p8g_controller_reference/historical_hashes.json');
  assert.equal(Object.keys(hashes).length,307);
  for(const [name,hash] of Object.entries(hashes)){
    const bytes=await readFile(resolve('..',name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,name);
  }
});
