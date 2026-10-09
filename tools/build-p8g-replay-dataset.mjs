import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sourceDefault = resolve(root, '../all-in-planner/research/lifted_stp/results/p8f2_terminal_freshness/run_20261009T065318Z_h2');
const hash = b => createHash('sha256').update(b).digest('hex');
const encode = x => JSON.stringify(x) + '\n';
export async function build(source = sourceDefault, output = resolve(root, 'site/replay-data/p8f2-ar10')) {
  if (resolve(output).startsWith(resolve(source))) throw Error('Source is read-only');
  const names = ['telemetry.json','frontend_plans.json','obstacle_truth.json','events.json','result.json','summary.json',
    'actual_dynamic_clearance.csv','actual_bank_clearance.csv','tracking.csv','contract.json','rule15_actual_audit.json','provenance.json','post_terminal_worker_audit.json'];
  const bytes = Object.fromEntries(await Promise.all(names.map(async n => [n, await readFile(resolve(source,n))])));
  const json = n => JSON.parse(bytes[n]);
  const csv = n => { const [header,...rows] = bytes[n].toString().trim().split(/\r?\n/); const keys=header.split(',');
    return rows.map(r => Object.fromEntries(r.split(',').map((v,i)=>[keys[i], v!=='' && Number.isFinite(Number(v)) ? Number(v) : v]))); };
  const tele=json('telemetry.json'), result=json('result.json'), summary=json('summary.json'), contract=json('contract.json');
  const plans=json('frontend_plans.json'), events=json('events.json'), targets=json('obstacle_truth.json');
  if (summary.classification!=='P8F2_AR10_OPENWATER_DYNAMIC_PASS' || !summary.passed || basename(source)!=='run_20261009T065318Z_h2') throw Error('Frozen source identity');
  const groupMin = (rows,key) => {const m=new Map();for(const r of rows) if(!m.has(r.simulation_time)||r[key]<m.get(r.simulation_time)[key])m.set(r.simulation_time,r);return m;};
  const dynamic=groupMin(csv('actual_dynamic_clearance.csv'),'buffered_clearance');
  const banks=groupMin(csv('actual_bank_clearance.csv'),'bank_buffered');
  const tracking=new Map(csv('tracking.csv').map(r=>[r.simulation_time,r]));
  const start=result.initial.timestamp;
  const startup=events.find(e=>e.event==='STARTUP_ACTIVE');
  const frames=[{state:result.initial,active_plan_id:startup.plan_id,phase:'ACTIVE',initial_snapshot:true},...tele].map((r,i)=>{
    const s=r.state, d=dynamic.get(s.timestamp), b=banks.get(s.timestamp);
    if(!d||!b)throw Error('Missing authoritative audit row');
    return {time:s.timestamp,episode_time:s.timestamp-start,physical_tick:i>0,sequence:s.sequence,pose:s.pose,
      body:s.velocity.body,actuator:s.actuator,control:s.control,attitude:s.attitude,physical_command:r.physical_command??'NOT_RECORDED',
      active_plan_id:r.active_plan_id,phase:r.phase,s:d.own_s,l:d.own_l,
      dynamic_clearance:d.buffered_clearance,bank_margin:b.bank_buffered,tracking:tracking.get(s.timestamp)??'NOT_RECORDED'};
  });
  const activations=events.filter(e=>['STARTUP_ACTIVE','SWITCH'].includes(e.event)).map(e=>{
    const id=e.new_plan_id??e.plan_id, f=frames.find(f=>f.active_plan_id===id);
    return {plan_id:id,native_time:e.simulation_time,receipt_time:e.receipt_sim_time,first_sample_time:f.time,lag:f.time-e.simulation_time};
  });
  const rule15=json('rule15_actual_audit.json'), crossing=rule15.actual_at_s50.simulation_time;
  const task=events.find(e=>e.event==='TASK_COMPLETE');
  const avoidance=frames.find(f=>Math.abs(f.actuator.steeringActualRad) >= .01);
  const metrics={cpa:summary.actual_sampled_dynamic_CPA,bank:summary.actual_sampled_bank_minimum,rule15,
    native_TASK_COMPLETE:summary.native_TASK_COMPLETE,final_phase:result.phase,
    terminal_diagnostics:json('post_terminal_worker_audit.json'),terminal_generation_events:summary.terminal_generation_events,
    safety_claim:'50 Hz sampled actual clearance',actual_continuous_certified:false,
    activations,presets:[
      {name:'Initial',time:start,rule:'result.initial.timestamp'},
      {name:'Avoidance initiation',time:avoidance.time,rule:'first physical sample with abs(actual steering) >= 0.01 rad'},
      {name:'Before conflict',time:frames.findLast(f=>f.time<crossing).time,rule:'last recorded sample before audited s=50 crossing'},
      {name:'Closest approach',time:summary.actual_sampled_dynamic_CPA.simulation_time,rule:'independent sampled dynamic CPA'},
      {name:'Conflict passed',time:frames.find(f=>f.time>=crossing).time,rule:'first recorded sample at or after audited s=50 crossing'},
      {name:'TASK_COMPLETE',time:task.receipt_sim_time,rule:'TASK_COMPLETE receipt simulation time; native time annotated separately'}
    ]};
  const files={'frames.json':frames,'plans.json':plans,'targets.json':targets,'events.json':events.map(e=>{
    const {actual_state_snapshot,identity,...rest}=e;
    return {...rest,request_identity:identity ? {plan_start_sim_time:identity.plan_start_sim_time,parent_active_plan_id:identity.parent_active_plan_id}:undefined};
  }),'metrics.json':metrics};
  const assetPath='assets/boats/zodiac_boat.glb';
  const manifest={schema:'P8G_REPLAY_V1',stage:'P8G',source_result:summary.classification,
    source_commits:{planner:contract.planner_commit,openwater:contract.openwater_commit},
    baseline_commits:{planner:'696e1cf18c4b2e59dc37f4d6dd1e980215a9b52b',openwater:'c7dc6155d5a9293bf97461a500cd72ca966afa22'},
    run_id:basename(source),source_files:Object.fromEntries(names.map(n=>[n,hash(bytes[n])])),
    derived_files:Object.fromEntries(Object.entries(files).map(([n,v])=>[n,hash(encode(v))])),
    physical_tick_count:tele.length,initial_snapshot_count:1,sample_count:frames.length,start_time:start,end_time:frames.at(-1).time,
    episode_start_time:start,duration:frames.at(-1).time-start,source_frame:'ENU',episode_frame:result.frame,
    vessel_asset:{path:assetPath,sha256:hash(await readFile(resolve(root,'site',assetPath))),spec:'zodiac_boat',length:5.5,reversed:true,visualDraft:.6},
    scenario:contract.scene_identity,target:contract.target,bank:[-10,10],bank_buffer:.5,mission_goal:75,mode:contract.mode,
    activation_count:summary.activated_plans,switch_count:summary.switches,
    official_dynamic_clearance:metrics.cpa.buffered_clearance,official_bank_margin:metrics.bank.bank_buffered};
  await mkdir(output,{recursive:true});
  for(const [n,v] of Object.entries({...files,'manifest.json':manifest}))await writeFile(resolve(output,n),encode(v));
  // The checked-in loader pin makes a modified manifest fail closed too.
  return {manifest,manifestHash:hash(encode(manifest))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=await build(process.argv[2],process.argv[3]);
  if(!process.argv[3])await writeFile(resolve(root,'site/js/replay/replay-identity.js'),
    '// Generated from the frozen source by build-p8g-replay-dataset.mjs.\nexport const MANIFEST_SHA256 = '+JSON.stringify(result.manifestHash)+';\n');
  console.log(JSON.stringify({sample_count:result.manifest.sample_count,manifest_sha256:result.manifestHash}));
}
