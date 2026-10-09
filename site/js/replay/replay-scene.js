import * as THREE from 'three';
import { createReplayVessel,applyRecordedPose } from './replay-vessel.js';
import { enuPositionToOpenWater } from '../twin/coordinate-adapter.js';
import { plannerToEnu } from '../scenario/p8f-ar10-crossing.js';
import { suffixStart } from './replay-state-sampler.js';
import { illustrativeEnvironment,readableLine } from './replay-rendering.js';
export const CAMERAS=['Chase','Top','Free Orbit','Encounter Overview'];
const vec=p=>{const v=enuPositionToOpenWater({...p,z:p.z??.12});return new THREE.Vector3(v.x,v.y,v.z);};
export async function createReplayScene(data,container){
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,2),3));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xb9d0df);
  scene.add(new THREE.HemisphereLight(0xe4f3ff,0x294a59,2));
  const sun=new THREE.DirectionalLight(0xffefd9,3);sun.position.set(-30,60,15);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(52,1,.1,1000);
  const boat=await createReplayVessel(scene,data.asset);
  const layers={};for(const name of ['planned','executed','targetPath','banks','footprint','buffer','switches','ghosts']){layers[name]=new THREE.Group();scene.add(layers[name]);}
  layers.ghosts.visible=false;layers.footprint.visible=false;layers.switches.visible=false;
  const lineSync=[];
  const line=(points,color,group,dashed=false)=>{
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const material=dashed?new THREE.LineDashedMaterial({color,dashSize:1,gapSize:.8,depthTest:false,transparent:true,opacity:.35}):new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true});
    const o=new THREE.Line(geometry,material);o.frustumCulled=false;o.renderOrder=4;if(dashed)o.computeLineDistances();group.add(o);
    if(!dashed)lineSync.push(readableLine(o,renderer,group===layers.banks?1.5:3));
    return o;
  };
  const sl=(s,l,height=.1)=>{const p=plannerToEnu(data.manifest.episode_frame,s,l);return new THREE.Vector3(p.x,height,p.y);};
  for(const l of [-10,10])line([sl(-10,l),sl(100,l)],0xd4e1e7,layers.banks);
  for(const l of [-9.5,9.5])line([sl(-10,l),sl(100,l)],0x879da7,layers.buffer,true);
  line([sl(-10,0),sl(100,0)],0x9cb3bf,layers.banks,true);
  const labels=[];
  function label(text,position){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d');
    ctx.font='26px sans-serif';ctx.fillStyle='#eef5f9';ctx.fillText(text,8,42);
    const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
    sprite.scale.set(17,2.125,1);sprite.position.copy(position);sprite.renderOrder=6;layers.banks.add(sprite);labels.push(sprite);
  }
  for(const [s,text] of [[50,'Conflict section · s = 50 m'],[75,'Mission progress · s = 75 m']]){
    line([sl(s,-10),sl(s,10)],s===50?0xe8baa5:0xc7d9d6,layers.banks,true);label(text,sl(s+1,13,1));
  }
  label('l = −10 m',sl(7,-12,1));label('l = +10 m',sl(7,12,1));
  const environment=await illustrativeEnvironment(renderer,scene),water=environment.water;
  const grid=new THREE.GridHelper(180,36,0x6c9aa8,0x4b8493);grid.position.set(0,-.23,65);grid.material.transparent=true;grid.material.opacity=.13;scene.add(grid);
  const actual=line(data.frames.map(f=>vec(f.pose.position).setY(.16)),0xffde45,layers.executed);
  const targetTrail=line(data.targets.map(f=>vec(f.obstacles[0].position)),0xf15c62,layers.targetPath);
  const target=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,.7,64),new THREE.MeshStandardMaterial({color:0xdb3548,roughness:.5}));scene.add(target);
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.5,3,64),new THREE.MeshBasicMaterial({color:0xf55c68,transparent:true,opacity:.3,side:THREE.DoubleSide,depthTest:false}));
  ring.rotation.x=-Math.PI/2;layers.buffer.add(ring);
  const velocity=data.targets[0].obstacles[0].velocity;
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(velocity.x,0,velocity.y).normalize(),new THREE.Vector3(),5,0xff8190,1,.6);scene.add(arrow);
  const hull=new THREE.Group();layers.footprint.add(hull);
  for(const off of [-6.4/3,0,6.4/3]){
    const circle=new THREE.Mesh(new THREE.RingGeometry(Math.hypot(3.2/3,1)-.025,Math.hypot(3.2/3,1)+.025,48),new THREE.MeshBasicMaterial({color:0xffde45,side:THREE.DoubleSide,depthTest:false}));
    circle.rotation.x=-Math.PI/2;circle.position.set(0,.3,off);hull.add(circle);
  }
  const active=line(Array.from({length:256},()=>new THREE.Vector3()),0x29e5ee,layers.planned);
  const ghostPlans=new Map(data.plans.map(p=>[p.plan_id,line(p.points.map(v=>vec(v)),0xa5b0b8,layers.ghosts,true)]));
  for(const a of data.metrics.activations.slice(1)){
    const f=data.frames.find(x=>x.time===a.first_sample_time),o=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),new THREE.MeshBasicMaterial({color:0xcff9fc}));o.position.copy(vec(f.pose.position)).y=.3;o.userData.time=f.time;layers.switches.add(o);
  }
  const plans=new Map(data.plans.map(p=>[p.plan_id,p]));
  let mode=0,entire=false,last=null,orbit={yaw:-.65,pitch:.8,distance:60,target:sl(45,0,0)};
  const forward=new THREE.Vector3(),look=new THREE.Vector3();
  const reset=()=>{orbit={yaw:-.65,pitch:.8,distance:60,target:sl(45,0,0)};};
  const canvas=renderer.domElement;let drag=null;
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{if(mode!==2)return;drag={x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointerup',()=>drag=null);
  canvas.addEventListener('pointermove',e=>{if(!drag||mode!==2)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(drag.pan){orbit.target.x-=dx*orbit.distance*.001;orbit.target.z-=dy*orbit.distance*.001;}else{orbit.yaw-=dx*.006;orbit.pitch=THREE.MathUtils.clamp(orbit.pitch+dy*.005,.06,1.55);}drag.x=e.clientX;drag.y=e.clientY;});
  canvas.addEventListener('wheel',e=>{if(mode!==2)return;e.preventDefault();orbit.distance=THREE.MathUtils.clamp(orbit.distance*Math.exp(e.deltaY*.001),5,180);},{passive:false});
  function update(sample){
    last=sample;environment.update(sample.time);applyRecordedPose(boat,sample);
    target.position.copy(vec(sample.target.position)).y=.35;ring.position.copy(target.position).y=.12;
    arrow.position.copy(target.position).y=1;
    hull.position.copy(boat.pos);hull.rotation.y=sample.record.pose.headingRad;
    actual.geometry.setDrawRange(0,entire?data.frames.length:sample.index+1);
    targetTrail.geometry.setDrawRange(0,entire?data.targets.length:sample.index+1);
    const plan=plans.get(sample.active_plan_id),suffix=suffixStart(plan,sample.time),attr=active.geometry.attributes.position;
    let count=0;
    if(suffix.point){attr.setXYZ(count++,suffix.point.x,.24,suffix.point.y);
      for(let i=suffix.index+1;i<plan.points.length;i++)attr.setXYZ(count++,plan.points[i].x,.24,plan.points[i].y);}
    attr.needsUpdate=true;active.geometry.setDrawRange(0,count);
    for(const [id,o] of ghostPlans)o.visible=id!==sample.active_plan_id&&data.metrics.activations.find(a=>a.plan_id===id).first_sample_time<=sample.time;
    for(const o of layers.switches.children)o.visible=o.userData.time<=sample.time;
    render();
  }
  function render(){
    if(!last)return;
    camera.up.set(0,1,0);
    if(mode===0){
      forward.set(0,0,1).applyQuaternion(boat.quat);forward.y=0;forward.normalize();
      camera.position.copy(boat.pos).addScaledVector(forward,-14);camera.position.y+=8;look.copy(boat.pos).addScaledVector(forward,5);camera.lookAt(look);
    }else if(mode===1){camera.position.copy(sl(45,0,113));camera.up.set(0,0,-1);camera.lookAt(sl(45,0,0));}
    else if(mode===2){camera.position.set(orbit.target.x+Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*orbit.distance,orbit.target.y+Math.sin(orbit.pitch)*orbit.distance,orbit.target.z+Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*orbit.distance);camera.lookAt(orbit.target);}
    else{camera.position.copy(sl(15,-65,85));camera.lookAt(sl(48,0,0));}
    for(const sprite of labels){
      sprite.visible=mode!==0;
      const h=camera.position.distanceTo(sprite.position)*.035;
      sprite.scale.set(h*8,h,1);
    }
    for(const sync of lineSync)sync();
    renderer.render(scene,camera);
  }
  function resize(){const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
  window.addEventListener('resize',resize);resize();
  return {renderer,scene,boat,layers,water,update,render,reset,actual,active,target,arrow,
    setCamera(i){mode=i;return CAMERAS[mode];},get cameraMode(){return mode;},setEntire(value){entire=value;},
    setPaper(on){water.material.roughness=on?.85:.48;water.material.normalScale.setScalar(on?.035:.18);water.material.envMapIntensity=on?.12:.45;water.material.clearcoat=on?0:.12;},
    setResolution(ratio){renderer.setPixelRatio(ratio);resize();},
    resourceStats(){let objects=0;scene.traverse(()=>objects++);return {objects,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};}};
}
