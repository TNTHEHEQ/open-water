import { loadReplay } from './replay-loader.js';
import { sampleReplay,floorIndex,ReplayClock } from './replay-state-sampler.js';
import { createReplayScene,CAMERAS } from './replay-scene.js';
import { enuToPlanner } from '../scenario/p8f-ar10-crossing.js';
const $=id=>document.getElementById(id),fmt=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'NOT_RECORDED';
try{
  const data=await loadReplay(),view=await createReplayScene(data,$('viewport'));
  const {manifest:m,metrics:k}=data,clock=new ReplayClock(m.start_time,m.end_time);
  const terminal=data.events.find(e=>e.event==='TASK_COMPLETE');
  let current=sampleReplay(data,m.start_time);
  $('scrub').min=m.start_time;$('scrub').max=m.end_time;$('scrub').value=m.start_time;
  const setTime=t=>{clock.seek(Number(t));draw();};
  function draw(){
    current=sampleReplay(data,clock.time);view.update(current);
    const ref=view.referenceSample;
    const f=current.record,p=data.plans.find(p=>p.plan_id===f.active_plan_id);
    $('play').textContent=clock.playing?'Pause':'Play';$('scrub').value=clock.time;
    $('time').textContent='Episode '+fmt(clock.time-m.start_time)+' / '+fmt(m.duration)+' s  |  absolute '+fmt(clock.time)+' s';
    const complete=clock.time>=terminal.receipt_sim_time;
    const target=enuToPlanner(m.episode_frame,data.targets[current.index].obstacles[0].position);
    $('state').innerHTML='<strong>'+fmt(current.body.surge)+' m/s</strong><small> surge · recorded / display interpolation</small>'+
      '<div class="pair"><span>Heading (sample)</span><b>'+fmt(f.pose.headingRad*180/Math.PI,1)+'°</b></div>'+
      '<div class="pair"><span>s / l (sample)</span><b>'+fmt(f.s)+' / '+fmt(f.l)+' m</b></div>'+
      '<div class="pair"><span>Telemetry plan</span><b>'+f.active_plan_id+'</b></div>'+
      '<small>Request / source t = '+fmt(p.plan_start_sim_time)+' s · suffix t = '+fmt(clock.time-p.plan_start_sim_time)+' s</small>'+
      '<div class="pair"><span>Dynamic clearance</span><b>'+fmt(f.dynamic_clearance,3)+' m</b></div>'+
      '<div class="pair"><span>Bank margin</span><b>'+fmt(f.bank_margin,3)+' m</b></div>'+
      '<small>Min dynamic '+fmt(m.official_dynamic_clearance,3)+' m · min bank '+fmt(m.official_bank_margin,3)+' m</small>'+
      '<div class="pair"><span>Own − target (s/l)</span><b>'+fmt(f.s-target.s)+' / '+fmt(f.l-target.l)+' m</b></div>'+
      '<small>50 Hz sampled actual clearance · sample '+fmt(f.time,3)+' s</small>'+
      '<div>Rule15 branch: PASS · STARBOARD_ASTERN</div><div><b>'+(complete?'TASK_COMPLETE':'Historical phase: '+f.phase)+'</b></div>'+
      '<small>7 activated plans · 6 switches</small>'+
      '<div class="pair"><span>Controller reference time</span><b>'+ (ref.covered?fmt(ref.record.simulation_time,3)+' s':'NOT_RECORDED')+'</b></div>'+
      '<small>Reference plan: '+(ref.covered?ref.record.plan_id:'NOT_RECORDED')+' · '+ref.count+' recorded points</small>'+
      '<div class="pair"><span>Physical telemetry time</span><b>'+fmt(f.time,3)+' s</b></div>'+
      '<small>Original clocks · reference: last recorded sample, no interpolation / offset</small>';
  }
  const rule=k.rule15.actual_at_s50;
  $('audits').textContent='Official min dynamic: '+k.cpa.buffered_clearance+' m; min bank: '+k.bank.bank_buffered+' m. CPA: episode '+fmt(k.cpa.episode_time,3)+' s, own (s,l)=('+fmt(k.cpa.own_s)+','+fmt(k.cpa.own_l)+'), target=('+fmt(k.cpa.target_s)+','+fmt(k.cpa.target_l)+'). Crossing: episode '+fmt(rule.episode_time,6)+' s; own l='+fmt(rule.own_l,6)+', target l='+fmt(rule.target_l,6)+', signed Δl='+fmt(rule.relative_l,6)+' m. Independent Rule15 audit PASS. No actual inter-tick certificate.';
  $('diagnostics').textContent='Recorded worker 8 discarded after termination; never activated. Native switch → first telemetry identity: 0.04 s. Static outboard rig. All poses recorded. No physical integration.';
  const layerNames={executed:'Actual telemetry history',referenceHistory:'Controller reference history',referencePoint:'Current tracking reference point',planned:'Future planned suffix (75 m, dashed)',referenceSwitches:'Controller reference switches',referenceJumps:'Reference jumps (dashed)',targetPath:'CV target history',banks:'Bank boundaries / sections',footprint:'Audited three-circle footprint',buffer:'Safety buffer (0.5 m)',switches:'Recorded activation positions',ghosts:'Old plans ghost (not actual execution)'};
  for(const [id,name] of Object.entries(layerNames)){
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=view.layers[id].visible;
    input.addEventListener('change',()=>{view.layers[id].visible=input.checked;draw();});label.append(input,document.createTextNode(name));$('layers').append(label);
  }
  $('play').onclick=()=>{if(clock.time>=m.end_time)clock.seek(m.start_time);clock.play(!clock.playing);draw();};
  $('speed').onchange=e=>clock.rate(Number(e.target.value));
  $('scrub').oninput=e=>setTime(e.target.value);
  $('previous').onclick=()=>{clock.play(false);const i=floorIndex(data.frames,clock.time);setTime(data.frames[Math.max(0,i-(clock.time===data.frames[i].time?1:0))].time);};
  $('next').onclick=()=>{clock.play(false);setTime(data.frames[Math.min(data.frames.length-1,floorIndex(data.frames,clock.time)+1)].time);};
  $('encounter').onclick=()=>{clock.play(false);setTime(rule.simulation_time);};
  $('camera').onclick=()=>{$('camera').textContent=view.setCamera((view.cameraMode+1)%4);draw();};
  $('resolution').onchange=e=>{view.setResolution(Number(e.target.value));draw();};
  $('reset').onclick=()=>{view.reset();draw();};
  document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='c'&&!['INPUT','SELECT'].includes(e.target.tagName))$('camera').click();});
  $('water').onchange=e=>{view.water.visible=e.target.checked;$('caption').textContent=e.target.checked?'Recorded 6DOF pose / Illustrative water surface':'Recorded 6DOF pose / Water surface hidden';draw();};
  $('paper').onclick=()=>{document.body.classList.toggle('paper');view.setPaper(document.body.classList.contains('paper'));draw();};
  for(const preset of k.presets){const b=document.createElement('button');b.type='button';b.textContent=preset.name;b.title=preset.rule;b.onclick=()=>{clock.play(false);setTime(preset.time);};$('presets').append(b);}
  const relevant=new Set(['STARTUP_ACTIVE','SOLVE_QUEUED','SOLVE_RETURNED','PENDING_READY','SWITCH','TASK_COMPLETE']);
  const events=[...data.events.filter(e=>relevant.has(e.event)),{event:'CPA',simulation_time:k.cpa.simulation_time},{event:'CONFLICT',simulation_time:rule.simulation_time}];
  for(const e of events){
    const button=document.createElement('button');button.type='button';button.className='marker';button.dataset.kind=e.event;
    button.style.left=Math.max(0,Math.min(100,(e.simulation_time-m.start_time)/m.duration*100))+'%';
    const text=e.event+' · episode '+fmt(e.simulation_time-m.start_time,3)+' s'+(e.duration_wall_sec!==undefined?' · worker wall '+fmt(e.duration_wall_sec,3)+' s':'')+(e.new_plan_id?' → '+e.new_plan_id:'');
    button.title=text;button.setAttribute('aria-label',text);button.onclick=()=>{clock.play(false);setTime(e.simulation_time);$('event-note').textContent=text;};$('timeline').append(button);
  }
  function exportPNG(){
    view.render();const source=view.renderer.domElement,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
    const scale=canvas.width/source.clientWidth;ctx.scale(scale,scale);
    ctx.fillStyle='rgba(10,32,45,.88)';ctx.fillRect(16,16,540,215);ctx.fillStyle='#f3f7f9';ctx.font='600 19px sans-serif';ctx.fillText('P8F2 | AR10 Dynamic Crossing',30,43);
    ctx.font='11px sans-serif';const lines=['READ-ONLY HISTORICAL REPLAY · SOURCE: P8F2 FROZEN RUN',
      'Episode '+fmt(clock.time-m.start_time,3)+' s | '+current.active_plan_id+' | '+(clock.time>=terminal.receipt_sim_time?'TASK_COMPLETE':CAMERAS[view.cameraMode]),
      $('caption').textContent,'CV Target (kinematic) · r = 2.5 m · buffer = 0.5 m','50 Hz sampled actual clearance · source result PASS',
      'Reference t: '+(view.referenceSample.covered?fmt(view.referenceSample.record.simulation_time,3):'NOT_RECORDED')+' | physical telemetry t: '+fmt(current.record.time,3)+' s'];
    lines.forEach((t,i)=>ctx.fillText(t,30,65+i*17));
    ctx.fillStyle='#00edf5';ctx.fillText('━ Controller reference history',30,179);ctx.fillStyle='#ffe45c';ctx.fillText('━ Actual telemetry history',290,179);
    ctx.fillStyle='#b9f3f5';ctx.fillText('┄ Future planned suffix (75 m)',30,200);ctx.fillStyle='#ffffff';ctx.fillText('● Current tracking reference point',290,200);
    if(view.layers.ghosts.visible){ctx.fillStyle='#b5c2ca';ctx.fillText('Gray: old plans — not actual execution',30,249);}
    return new Promise(resolve=>{canvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='P8G_'+fmt(clock.time-m.start_time,3)+'s.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);resolve({width:canvas.width,height:canvas.height,size:blob.size});},'image/png');});
  }
  $('png').onclick=exportPNG;
  $('loading').remove();draw();
  // Read-only diagnostic seam for browser regression; never exposes a physical runner.
  window.p8gReplay={data,clock,view,seek:setTime,snapshot:()=>({time:clock.time,index:current.index,position:view.boat.group.position.toArray(),quaternion:view.boat.group.quaternion.toArray(),plan:current.active_plan_id,trailCount:view.actual.geometry.drawRange.count,suffixCount:view.active.geometry.drawRange.count,referenceCount:view.referenceSample.count,referenceTime:view.referenceSample.record?.simulation_time,referencePlan:view.referenceSample.record?.plan_id,referenceCovered:view.referenceSample.covered,referenceSegmentCounts:view.referenceSample.segmentCounts,referenceSwitchCount:view.referenceSample.switchCount,referenceMarkerVisible:view.referencePoint.visible,referencePosition:view.referencePoint.position.toArray(),bankRange:view.bankRange,resources:view.resourceStats()}),exportPNG};
  function frame(wall){clock.tick(wall);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(error){$('loading').textContent='REPLAY_DATA_VALIDATION_FAILED\n'+error.message;console.error(error);}
