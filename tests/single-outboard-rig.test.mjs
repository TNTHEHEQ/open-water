import test from 'node:test';
import assert from 'node:assert/strict';
import { loadZodiacGeometry, normalizeZodiac } from '../tools/zodiac-geometry.mjs';
import { VesselAnimationRig } from '../site/js/simulation/vessel-animations.js';
import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';

test('actual Zodiac GLB: complete original engine centered, no second rig or side geometry, one jet anchor',async()=>{
  const spec=VESSEL_SPECS.zodiac_boat, cfg=spec.rig.singleOutboard;
  const original=normalizeZodiac(await loadZodiacGeometry());
  const twin=new VesselAnimationRig(original,{...spec,rig:{regionMotors:{exclude:cfg.exclude,motors:cfg.sourceMotors}}});
  const model=normalizeZodiac(await loadZodiacGeometry());
  const rig=new VesselAnimationRig(model,spec);
  assert.equal(rig.steerPivots.length,1);assert.equal(rig.propellers.length,1);
  const oldProps=twin.getPropellerWorldPositions();
  const expected=oldProps[0].clone().add(oldProps[1]).multiplyScalar(.5);
  assert.ok(expected.distanceTo(rig.getPropellerWorldPositions()[0])<1e-12);
  assert.ok(Math.abs(expected.x)<.005);assert.ok(expected.y<-.3);
  assert.deepEqual(rig.steerPivots[0].pivot.position.toArray(),[78,38,48]);
  // Same retained triangle indices/materials; fixed merged hull matches extraction of both originals.
  const meshes=root=>{const a=[];root.traverse(o=>{if(o.isMesh)a.push([o.name,o.material.name,Array.from(o.geometry.index.array)]);});return a;};
  assert.deepEqual(meshes(rig.singleOutboard),meshes(twin.steerPivots[0].pivot));
  const originalHull=original.getObjectByName('Collada_visual_scene_group').children.filter(o=>o.isMesh);
  const hull=model.getObjectByName('Collada_visual_scene_group').children.filter(o=>o.isMesh);
  assert.equal(hull.length,originalHull.length);
  for(let i=0;i<hull.length;i++)assert.deepEqual(hull[i].geometry.index.array,originalHull[i].geometry.index.array);
  model.traverse(o=>assert.ok(o.scale.x>0&&o.scale.y>0&&o.scale.z>0));
  const boat={throttle:1,_effSteer:.4};
  const pivot=rig.propellers[0].pivot;
  rig.update(.2,boat);const angle=pivot.rotation.y;
  assert.ok(angle>0);assert.ok(rig._steer>0&&rig._steer<.4);
  boat._effSteer=-.4;boat.throttle=-1;rig.update(1,boat);
  assert.ok(rig._steer<0);assert.ok(pivot.rotation.y<angle);
  boat.throttle=0;const stopped=pivot.rotation.y;rig.update(.2,boat);assert.equal(pivot.rotation.y,stopped);
  assert.equal(rig.getPropellerWorldPositions().length,1);
  // P0-A: mechanical actuator angle is authoritative, no second visual lag.
  boat.outboardActuator={actualSteeringRad:.2,actualPropulsion:.5};
  boat._effSteer=.1;rig.update(1/60,boat);assert.equal(rig._steer,.2);
  boat.outboardActuator.actualSteeringRad=-.15;rig.update(1/144,boat);assert.equal(rig._steer,-.15);
});
