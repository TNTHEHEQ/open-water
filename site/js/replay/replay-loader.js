import { MANIFEST_SHA256 } from './replay-identity.js';
export function validateDataset(d) {
  const fail=message=>{throw Error('REPLAY_DATA_VALIDATION_FAILED: '+message);};
  const {manifest:m,frames:f,plans:p,targets:t,events:e,metrics:k}=d;
  if(m.schema!=='P8G_REPLAY_V1'||m.stage!=='P8G'||m.source_result!=='P8F2_AR10_OPENWATER_DYNAMIC_PASS'||
    m.run_id!=='run_20261009T065318Z_h2'||m.mode!=='DIRECT_ASYNC_SUFFIX_V1'||m.source_frame!=='ENU')fail('identity');
  if(f.length!==m.sample_count||f.filter(x=>x.physical_tick).length!==m.physical_tick_count||m.physical_tick_count!==1914||
    t.length!==f.length||m.initial_snapshot_count!==1)fail('sample count');
  if(m.target.radius_m!==2.5||m.target.planner_buffer_m!==.5||m.bank.join(',')!=='-10,10'||m.bank_buffer!==.5||
    m.target.model!=='SIMULATOR_OWNED_KINEMATIC_CV_DISC'||m.vessel_asset.spec!=='zodiac_boat')fail('geometry');
  if(m.activation_count!==7||m.switch_count!==6||p.length!==7||new Set(f.map(x=>x.active_plan_id)).size!==7||
    e.filter(x=>x.event==='SWITCH').length!==6||!e.some(x=>x.event==='TASK_COMPLETE')||!k.native_TASK_COMPLETE)fail('lifecycle');
  if(m.official_dynamic_clearance!==5.1134505020859||m.official_bank_margin!==1.443611819878718||
    k.cpa.buffered_clearance!==m.official_dynamic_clearance||k.bank.bank_buffered!==m.official_bank_margin||
    k.rule15.selected_branch!=='STARBOARD_ASTERN'||k.rule15.passed!==true)fail('official audits');
  const ids=new Set(p.map(x=>x.plan_id));
  f.forEach((x,i)=>{
    if(!Number.isFinite(x.time)||(i&&x.time<=f[i-1].time)||x.episode_time!==x.time-m.episode_start_time)fail('clock');
    if(![...Object.values(x.pose.position),...Object.values(x.pose.orientation),x.pose.headingRad,x.dynamic_clearance,x.bank_margin].every(Number.isFinite))fail('nonfinite pose/metric');
    if(!ids.has(x.active_plan_id)||t[i].simulation_time!==x.time||t[i].obstacles.length!==1||t[i].obstacles[0].radius_m!==2.5)fail('frame contract');
  });
  p.forEach(x=>{
    if(!Number.isFinite(x.plan_start_sim_time)||x.source_simulation_time!==x.plan_start_sim_time||x.status!=='SUCCESS')fail('request epoch');
    if(x.points.length<2||x.points.some((v,i)=>!Object.values(v).every(Number.isFinite)||(i&&v.t_rel<=x.points[i-1].t_rel)))fail('plan points');
  });
  if(f[0].time!==m.start_time||f.at(-1).time!==m.end_time||m.duration!==m.end_time-m.start_time)fail('extent');
  for(const a of k.activations){
    const event=e.find(x=>(x.event==='STARTUP_ACTIVE'&&x.plan_id===a.plan_id)||(x.event==='SWITCH'&&x.new_plan_id===a.plan_id));
    if(!event||a.native_time!==event.simulation_time||f.find(x=>x.active_plan_id===a.plan_id).time!==a.first_sample_time||
      a.first_sample_time<a.native_time||a.first_sample_time-a.native_time>.04000001)fail('activation timing');
  }
  return d;
}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function loadReplay(base='./replay-data/p8f2-ar10/', fetcher=fetch){
  const read=async url=>{const r=await fetcher(url);if(!r.ok)throw Error('Missing '+url);return r.arrayBuffer();};
  try{
    const bytes=await read(base+'manifest.json');
    if(await sha256(bytes)!==MANIFEST_SHA256)throw Error('manifest hash');
    const manifest=JSON.parse(new TextDecoder().decode(bytes)), d={manifest};
    await Promise.all(Object.entries(manifest.derived_files).map(async([name,expected])=>{
      const b=await read(base+name);if(await sha256(b)!==expected)throw Error('hash '+name);
      d[name.replace('.json','')]=JSON.parse(new TextDecoder().decode(b));
    }));
    const asset=await read('./'+manifest.vessel_asset.path);
    if(await sha256(asset)!==manifest.vessel_asset.sha256)throw Error('vessel asset hash');
    validateDataset(d);return {...d,asset};
  }catch(error){throw Error('REPLAY_DATA_VALIDATION_FAILED: '+error.message);}
}
