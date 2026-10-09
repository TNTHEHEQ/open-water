import { Boat } from '../simulation/boat.js';
import { VESSEL_SPECS } from '../simulation/vessels.js';
import { enuPositionToOpenWater,enuQuaternionToOpenWater } from '../twin/coordinate-adapter.js';
export function applyRecordedPose(boat,sample){
  enuPositionToOpenWater(sample.position,boat.pos);enuQuaternionToOpenWater(sample.quaternion,boat.quat);
  boat.update(0);
}
export async function createReplayVessel(scene,asset){
  // No WaveField and no controller. Boat is only the original asset loader + transform container.
  const boat=new Boat(null,scene,0);
  boat.setSpec(VESSEL_SPECS.zodiac_boat);
  const forbidden=()=>{throw Error('REPLAY_PHYSICS_FORBIDDEN');};
  boat._step=forbidden;boat.outboardActuator.update=forbidden;
  const update=boat.update.bind(boat);
  boat.update=dt=>{if(dt!==0)throw Error('REPLAY_PHYSICS_FORBIDDEN');update(0);};
  const url=URL.createObjectURL(new Blob([asset],{type:'model/gltf-binary'}));
  try{await boat.loadModel(url,boat.spec.length,!!boat.spec.reversed);}finally{URL.revokeObjectURL(url);}
  if(!boat.model?.isGroup || boat.model.name!=='Sketchfab_Scene' || !boat.model.getObjectByName('Sketchfab_model'))
    throw Error('REPLAY_DATA_VALIDATION_FAILED: original Zodiac scene unavailable');
  boat.waterMask.visible=false;boat._maskWanted=false;
  // Rig remains static: no new motor/flag/propeller dynamics are inferred.
  return boat;
}
