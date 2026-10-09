import { plannerToEnu,enuToPlanner } from '../scenario/p8f-ar10-crossing.js';
// All times are original simulation times. No resampling, interpolation or clock offset.
export function buildReferences(rows,frame){
  const records=rows.map((r,source_index)=>({
    source_index,simulation_time:r.simulation_time,plan_id:r.plan_id,
    desired:r.desired,actual:r.actual,
    desired_enu:plannerToEnu(frame,...r.desired.slice(0,2)),
    actual_enu:plannerToEnu(frame,...r.actual.slice(0,2))
  }));
  const segments=[],jumps=[];
  for(let i=0;i<records.length;i++){
    const r=records[i],previous=records[i-1];
    if(!previous||previous.plan_id!==r.plan_id){
      if(previous)jumps.push({from_index:i-1,to_index:i,time:r.simulation_time,
        distance:Math.hypot(r.desired[0]-previous.desired[0],r.desired[1]-previous.desired[1])});
      segments.push({plan_id:r.plan_id,start:i,end:i+1});
    }else segments.at(-1).end=i+1;
  }
  return {records,segments,jumps};
}
export function sampleReferences(references,time){
  const rows=references.records;
  let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].simulation_time<=time)lo=mid+1;else hi=mid;}
  const record=rows[lo-1]??null,next=rows[lo];
  // Zero-order display of the last recorded reference within one 50 Hz sample.
  // Never interpolate, bridge an unrecorded gap, or extrapolate past log coverage.
  const covered=!!record&&time<=rows.at(-1).simulation_time&&
    time-record.simulation_time<=.020000001&&
    (!next||next.simulation_time-record.simulation_time<=.020000001||time===record.simulation_time);
  return {count:lo,record,covered,status:covered?'LATEST_RECORDED_REFERENCE':'NOT_RECORDED',
    segmentCounts:references.segments.map(s=>Math.max(0,Math.min(s.end,lo)-s.start)),
    switchCount:references.jumps.filter(j=>j.to_index<lo).length};
}
export function backgroundRange(data){
  const s=[...data.frames.map(f=>f.s),
    ...data.plans.flatMap(p=>p.points.map(v=>enuToPlanner(data.manifest.episode_frame,v).s))];
  return {min:Math.floor(Math.min(...s)/5)*5-5,max:Math.ceil(Math.max(...s)/5)*5+5};
}
