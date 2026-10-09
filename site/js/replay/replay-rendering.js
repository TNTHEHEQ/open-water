import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Display-only environment. No WaveField, boat forces, vertex displacement or wake simulation.
export async function illustrativeEnvironment(renderer,scene){
  const sky=await new RGBELoader().loadAsync('./assets/sky_clear_4k.hdr');
  sky.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky);
  scene.background=sky;scene.backgroundIntensity=.8;scene.environment=environment.texture;scene.environmentIntensity=.7;
  pmrem.dispose();
  const n=256,pixels=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n*Math.PI*2,v=y/n*Math.PI*2;
    const dx=.35*Math.cos(3*u+2*v)+.18*Math.cos(7*u-v)+.09*Math.cos(13*u+5*v);
    const dy=.23*Math.cos(3*u+2*v)-.08*Math.cos(7*u-v)+.14*Math.cos(5*u+11*v);
    const norm=new THREE.Vector3(-dx,-dy,1).normalize(),i=(y*n+x)*4;
    pixels[i]=Math.round((norm.x*.5+.5)*255);pixels[i+1]=Math.round((norm.y*.5+.5)*255);pixels[i+2]=Math.round((norm.z*.5+.5)*255);pixels[i+3]=255;
  }
  const normal=new THREE.DataTexture(pixels,n,n);
  normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.magFilter=THREE.LinearFilter;normal.minFilter=THREE.LinearMipmapLinearFilter;
  normal.generateMipmaps=true;normal.anisotropy=renderer.capabilities.getMaxAnisotropy();normal.repeat.set(220,220);normal.needsUpdate=true;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshPhysicalMaterial({
    color:0x07586c,roughness:.48,metalness:0,normalMap:normal,normalScale:new THREE.Vector2(.18,.18),envMapIntensity:.45,
    clearcoat:.12,clearcoatRoughness:.45,clearcoatNormalMap:normal,clearcoatNormalScale:new THREE.Vector2(.12,.12)
  }));
  water.rotation.x=-Math.PI/2;water.position.set(0,-.24,65);scene.add(water);
  return {water,update(time){normal.offset.set(time*.003,time*.001);}};
}

// Constant CSS-pixel width, cached instanced quads; hardware WebGL lines are only 1 px on Windows.
export function readableLine(line,renderer,width=2.5){
  const positions=line.geometry.attributes.position,count=positions.count;
  const starts=new Float32Array((count-1)*3),ends=new Float32Array((count-1)*3);
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0,1,-1,0,1,1,0,0,-1,0,1,1,0,0,1,0],3));
  geometry.setAttribute('start',new THREE.InstancedBufferAttribute(starts,3));
  geometry.setAttribute('end',new THREE.InstancedBufferAttribute(ends,3));
  const resolution=new THREE.Vector2();
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{color:{value:line.material.color.clone()},width:{value:width},resolution:{value:resolution}},
    vertexShader:`
      attribute vec3 start; attribute vec3 end;
      uniform vec2 resolution; uniform float width;
      varying float edge;
      void main(){
        vec4 a=projectionMatrix*modelViewMatrix*vec4(start,1.);
        vec4 b=projectionMatrix*modelViewMatrix*vec4(end,1.);
        vec2 delta=(b.xy/b.w-a.xy/a.w)*resolution;
        vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),.00001);
        vec4 clip=mix(a,b,position.x);
        clip.xy+=normal*position.y*width/resolution*clip.w;
        gl_Position=clip;edge=position.y;
      }`,
    fragmentShader:`
      uniform vec3 color;varying float edge;
      void main(){
        gl_FragColor=vec4(color,1.-smoothstep(.72,1.,abs(edge)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=5;
  line.material.visible=false;line.add(mesh);
  let version=-1;
  return ()=>{
    renderer.getSize(resolution);
    if(version!==positions.version){starts.set(positions.array.subarray(0,(count-1)*3));ends.set(positions.array.subarray(3,count*3));
      geometry.attributes.start.needsUpdate=true;geometry.attributes.end.needsUpdate=true;version=positions.version;}
    const range=line.geometry.drawRange;
    geometry.instanceCount=Math.max(0,Math.min(count,range.count)-1);
  };
}
