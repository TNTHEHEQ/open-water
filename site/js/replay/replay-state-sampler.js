import * as THREE from 'three';
export function floorIndex(array,time,key='time'){
  let lo=0,hi=array.length;while(lo<hi){const mid=(lo+hi)>>>1;if(array[mid][key]<=time)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);
}
export function sampleReplay(data,time){
  const frames=data.frames,timeClamped=Math.max(frames[0].time,Math.min(time,frames.at(-1).time));
  const index=floorIndex(frames,timeClamped),a=frames[index],b=frames[Math.min(index+1,frames.length-1)];
  const mix=b.time>a.time?(timeClamped-a.time)/(b.time-a.time):0;
  const linear=(x,y)=>x+(y-x)*mix;
  const vector=(x,y)=>Object.fromEntries(Object.keys(x).map(k=>[k,linear(x[k],y[k])]));
  const q=new THREE.Quaternion(...['x','y','z','w'].map(k=>a.pose.orientation[k]));
  q.slerp(new THREE.Quaternion(...['x','y','z','w'].map(k=>b.pose.orientation[k])),mix);
  const ta=data.targets[index].obstacles[0],tb=data.targets[Math.min(index+1,frames.length-1)].obstacles[0];
  return {time:timeClamped,index,record:a,position:vector(a.pose.position,b.pose.position),
    quaternion:{x:q.x,y:q.y,z:q.z,w:q.w},body:vector(a.body,b.body),
    target:{...ta,position:vector(ta.position,tb.position)},active_plan_id:a.active_plan_id};
}
export function suffixStart(plan,time){
  const relative=time-plan.plan_start_sim_time,points=plan.points;
  if(relative>points.at(-1).t_rel)return {index:points.length,point:null,relative};
  const index=floorIndex(points,relative,'t_rel'),a=points[index],b=points[Math.min(index+1,points.length-1)];
  const q=b.t_rel>a.t_rel?Math.max(0,(relative-a.t_rel)/(b.t_rel-a.t_rel)):0;
  return {index,relative,point:{x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q}};
}
export class ReplayClock {
  constructor(start,end){this.start=start;this.end=end;this.time=start;this.playing=false;this.speed=1;this.anchorWall=0;this.anchorTime=start;}
  seek(time,wall=performance.now()){this.time=Math.max(this.start,Math.min(this.end,time));this.anchorTime=this.time;this.anchorWall=wall;return this.time;}
  play(on,wall=performance.now()){this.tick(wall);this.playing=on;this.seek(this.time,wall);}
  rate(speed,wall=performance.now()){this.tick(wall);this.speed=speed;this.seek(this.time,wall);}
  tick(wall){if(this.playing){this.time=Math.min(this.end,this.anchorTime+(wall-this.anchorWall)*.001*this.speed);if(this.time>=this.end)this.playing=false;}return this.time;}
}
