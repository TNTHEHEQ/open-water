// Offline acceptance only. No runtime recorder/UI or transport.
import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
globalThis.window ??= {location:{search:''}};
globalThis.matchMedia ??= ()=>({matches:false});
const { Boat } = await import('../site/js/simulation/boat.js');
export const DT=1/240;
export function createPlant() {
  const water={time:0,preset:1,heightAt:()=>0,
    velocityAt:(_x,_z,out)=>out.set(0,0,0),normalAt:(_x,_z,out)=>out.set(0,1,0),
    currentAt:(_x,_z,out)=>out.set(0,0,0),windAt:(_x,_z,out)=>out.set(0,0,0)};
  const b=new Boat(water,new THREE.Scene(),0);b.setSpec(VESSEL_SPECS.zodiac_boat);b.reset();return b;
}
export function save(name,columns,rows,summary) {
  mkdirSync('artifacts/p0a',{recursive:true});
  writeFileSync(`artifacts/p0a/${name}.csv`,columns.join(',')+'\n'+rows.map(r=>r.join(',')).join('\n')+'\n');
  writeFileSync(`artifacts/p0a/${name}.json`,JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
}
export function responseTimes(rows,timeColumn,valueColumn,start,initial,target) {
  const fraction=row=>(row[valueColumn]-initial)/(target-initial);
  const crossing=level=>rows.find(r=>r[timeColumn]>=start&&fraction(r)>=level)?.[timeColumn]-start;
  const t10=crossing(.1),t50=crossing(.5),t90=crossing(.9);
  // Last sample outside 2%; settling is the following sample, not the first crossing.
  let last=-1;for(let i=0;i<rows.length;i++)if(rows[i][timeColumn]>=start&&Math.abs(1-fraction(rows[i]))>.02)last=i;
  const settling=last>=0&&last<rows.length-1?rows[last+1][timeColumn]-start:null;
  return {t10,t50,t90,riseTime10to90:t90-t10,settlingTime2Percent:settling};
}
