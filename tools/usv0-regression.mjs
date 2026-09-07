// Record with pristine 285b6ce before changing the composition root.
import * as THREE from 'three';
import { WaveField } from '../site/js/simulation/waves.js';
import { WakeField } from '../site/js/simulation/wake-field.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
globalThis.window ??= { location: { search: '' } };
globalThis.matchMedia ??= () => ({ matches: false });
const { Boat } = await import('../site/js/simulation/boat.js');
export function runRegression(preset = 1) {
  const water = new WaveField(); water.setSeaPreset(preset);
  // Settle the preset interpolation before starting the experiment.
  for(let i=0;i<1800;i++) water.update(1/60,0,0);
  const wake=new WakeField();water.setWakeField(wake);
  const boat=new Boat(water,new THREE.Scene(),.37);
  boat.setSpec(VESSEL_SPECS.zodiac_boat);boat.setActuatorMode('ideal');boat.reset();
  let planing=0;
  // Observe the existing force accumulator; no force or integration changes.
  const add=boat._F.add;
  boat._F.add=function(v){
    if(v===boat._s[1]&&v.x===0&&v.z===0&&v.y>0) planing=v.y;
    return add.call(this,v);
  };
  const step=boat._step;
  boat._step=function(h){planing=0;return step.call(this,h);};
  const samples=[];
  for(let i=0;i<1800;i++){
    water.update(1/60,boat.pos.x,boat.pos.z);wake.update(1/60,boat,water);
    boat.setControls(i<300?0:i<1200?.8:-.3,i>=600&&i<1000?.4:0);
    boat.update(1/60);
    if((i+1)%300===0) samples.push({time:(i+1)/60,position:boat.pos.toArray(),
      orientation:boat.quat.toArray(),linearVelocity:boat.vel.toArray(),angularVelocity:boat.angVelB.toArray(),
      planingForceY:planing,waveHeight:water.heightAt(boat.pos.x,boat.pos.z),wakeSources:wake.activeCount});
  }
  return samples;
}
if(process.argv.includes('--record')){
  mkdirSync('tests/fixtures',{recursive:true});
  writeFileSync('tests/fixtures/usv0-regression.json',JSON.stringify({
    commit:'285b6ce32057c70191a7fe16c31d979fa383ac64',seed:987654321,vessel:'zodiac_boat',
    duration:30,frameHz:60,physicsHz:240,cases:[1,2,3,4].map(preset=>({preset,samples:runRegression(preset)})),
  },null,2)+'\n');
}
