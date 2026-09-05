// Optional ?debug&validate=drive browser acceptance sequence. Uses actual key input,
// never sets Boat position, velocity, controls, or physics coefficients.
import * as THREE from 'three';
const EVENTS = [
  [0, 'reset', 'static'], [2, 'press', 'KeyW'], [4, 'release', 'KeyW'],
  [5, 'sample', 'forward'], [5, 'press', 'KeyD'], [9, 'sample', 'starboard-input'],
  [9, 'release', 'KeyD'], [10, 'press', 'KeyA'], [14, 'sample', 'port-input'],
  [14, 'release', 'KeyA'], [15, 'press', 'Space'], [15.1, 'release', 'Space'],
  [20, 'sample', 'coast'], [20, 'press', 'KeyS'], [23, 'release', 'KeyS'],
  [32, 'sample', 'reverse'], [32, 'press', 'Space'], [32.1, 'release', 'Space'],
];
export class DriveValidation {
  constructor(drive, boat, element) {
    this.drive=drive;this.boat=boat;this.element=element;
    this.time=0;this.index=0;this.samples=[];
    this.bodyVelocity=new THREE.Vector3();this.inverse=new THREE.Quaternion();
  }
  update(dt) {
    if(dt<=0)return;
    this.time+=dt;
    while(this.index<EVENTS.length&&EVENTS[this.index][0]<=this.time){
      const [,action,value]=EVENTS[this.index++];
      if(action==='sample'){
        const b=this.boat,v=this.bodyVelocity.copy(b.vel).applyQuaternion(this.inverse.copy(b.quat).invert());
        this.samples.push({stage:value,time:+this.time.toFixed(2),u:+v.z.toFixed(4),
          steering:+b.steer.toFixed(3),throttle:+b.throttle.toFixed(3),yawRate:+b.angVelB.y.toFixed(4),
          y:+b.pos.y.toFixed(4),wakeSources:b.wf.wakeField.activeCount});
        if(this.element)this.element.textContent=JSON.stringify(this.samples,null,2);
      }else if(action==='reset')this.drive.reset();
      else this.drive[action](value);
    }
  }
}
