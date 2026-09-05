// Geometry-only audit: original GLB remains unchanged. Skip texture decoding in Node.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export async function loadZodiacGeometry() {
  const buffer = readFileSync(new URL('../site/assets/boats/zodiac_boat.glb', import.meta.url));
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + buffer.subarray(binStart).toString('base64');
  function stripTextures(value) {
    for (const key of Object.keys(value)) {
      if (/texture/i.test(key)) delete value[key];
      else if (value[key] && typeof value[key] === 'object') stripTextures(value[key]);
    }
  }
  stripTextures(json.materials);
  delete json.images; delete json.textures;
  globalThis.ProgressEvent ??= class { constructor(type, data) { this.type = type; Object.assign(this, data); } };
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  return gltf.scene;
}
export function normalizeZodiac(model) {
  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());
  if (size.x > size.z) model.rotation.y = Math.PI / 2;
  model.rotation.y += Math.PI;
  model.updateMatrixWorld(true);
  box.setFromObject(model); size = box.getSize(size);
  model.scale.setScalar(5.5 / Math.max(size.x, size.z));
  model.updateMatrixWorld(true); box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x; model.position.z -= center.z;
  model.position.y += -0.6 - box.min.y;
  model.updateMatrixWorld(true);
  return model;
}
