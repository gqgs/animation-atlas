import {cameraAt,palettes} from './core.mjs?v=camera-1';

let loadedDensity,loadingDensity;

// The two channels carry one little-endian UNORM16 value. RG8 filtering needs
// no floating-point texture extension, and linearly interpolates the log value.
export async function loadSweepDensity(){
 if(loadedDensity)return loadedDensity;
 if(loadingDensity)return loadingDensity;
 loadingDensity=(async()=>{
  const assetURL=name=>{const url=new URL(name,import.meta.url);url.search=new URL(import.meta.url).search;return url;};
  const [metadataResponse,dataResponse]=await Promise.all([
   fetch(assetURL('./sweep-density.json')),
   fetch(assetURL('./sweep-density.u16.gz')),
  ]);
  if(!metadataResponse.ok||!dataResponse.ok)throw new Error('Unable to load the continuous density. Reload to retry.');
  const metadata=await metadataResponse.json();
  const finiteVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  if(!Number.isInteger(metadata.size)||metadata.size<2||metadata.size>256||metadata.channels!==2||metadata.encoding!=='log-unorm16-le'||
    !finiteVector(metadata.boundsMin)||!finiteVector(metadata.boundsMax)||metadata.boundsMax.some((v,i)=>v<=metadata.boundsMin[i])||
    !Number.isFinite(metadata.referenceDensity)||metadata.referenceDensity<=0||!Number.isFinite(metadata.logMax)||metadata.logMax<=0||metadata.logMax>40){
   throw new Error('The continuous density metadata is invalid.');
  }
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress the continuous density. Try a current browser.');
  const compressed=new Blob([await dataResponse.arrayBuffer()]);
  const data=new Uint8Array(await new Response(compressed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(data.byteLength!==metadata.size**3*2)throw new Error('The continuous density is incomplete. Reload to retry.');
  loadedDensity={metadata,data};
  return loadedDensity;
 })();
 try{return await loadingDensity;}catch(error){loadingDensity=undefined;throw error;}
}

export const vertexShader=`#version 300 es
precision highp float;
precision highp int;
void main(){
 // One oversized triangle avoids a seam across the volume.
 vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
 gl_Position=vec4(p*2.-1.,0.,1.);
}`;

export const fragmentShader=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
uniform highp sampler3D density;
uniform highp vec2 resolution;
uniform highp vec3 boundsMin,boundsMax,voxelSize;
uniform highp float azimuth,elevation,cameraDistance,gridSize,logMax,referenceDensity,gain,cutoff,glow;
uniform highp int palette;
out highp vec4 color;

const int STEPS=224;
const vec3 BACKGROUND=vec3(.012,.009,.021);

vec3 worldFromView(vec3 p){
 // Exact inverse of the trajectory renderer's yaw, then pitch transform.
 float c=cos(azimuth),s=sin(azimuth),ce=cos(elevation),se=sin(elevation);
 vec3 q=vec3(p.x,ce*p.y+se*p.z,-se*p.y+ce*p.z);
 return vec3(c*q.x-s*q.z,q.y,s*q.x+c*q.z);
}

float sampleDensity(vec3 p){
 vec3 u=(p-boundsMin)/(boundsMax-boundsMin);
 // Bounds describe voxel centers, not texture edges.
 vec3 uv=(u*(gridSize-1.)+.5)/gridSize;
 float encoded=dot(texture(density,uv).rg,vec2(1.,256.))/257.;
 return (exp(encoded*logMax)-1.)*referenceDensity;
}

vec3 densityNormal(vec3 p){
 // Four tetrahedral samples recover a world-space gradient on the anisotropic
 // voxel grid. This changes shading only, never the sampled density itself.
 vec3 a=vec3(1.,-1.,-1.),b=vec3(-1.,-1.,1.),c=vec3(-1.,1.,-1.),d=vec3(1.,1.,1.);
 vec3 g=(a*sampleDensity(p+a*voxelSize)+b*sampleDensity(p+b*voxelSize)+
         c*sampleDensity(p+c*voxelSize)+d*sampleDensity(p+d*voxelSize))/voxelSize;
 return -g/max(length(g),1e-5);
}

vec3 ink(float h){
 if(palette==1)return mix(vec3(.04,.26,.44),vec3(.64,1.,.84),h);
 if(palette==2)return mix(vec3(.24,.30,.51),vec3(1.,.91,.76),h);
 vec3 violet=vec3(.48,.07,.95),coral=vec3(1.,.17,.17),gold=vec3(1.,.72,.26);
 return h<.62?mix(violet,coral,smoothstep(0.,.62,h)):mix(coral,gold,smoothstep(.62,1.,h));
}

void main(){
 vec2 uv=(2.*gl_FragCoord.xy-resolution)/min(resolution.x,resolution.y);
 vec3 eye=worldFromView(vec3(0.,0.,cameraDistance));
 vec3 ray=normalize(worldFromView(vec3(uv/2.55,-1.)));
 vec3 safeRay=mix(vec3(-1.),vec3(1.),greaterThanEqual(ray,vec3(0.)))*max(abs(ray),vec3(1e-7));
 vec3 a=(boundsMin-eye)/safeRay,b=(boundsMax-eye)/safeRay;
 vec3 lo=min(a,b),hi=max(a,b);
 float near=max(0.,max(lo.x,max(lo.y,lo.z))),far=min(hi.x,min(hi.y,hi.z));
 if(far<=near){color=vec4(BACKGROUND,1.);return;}

 float stepLength=(far-near)/float(STEPS);
 // Static pixel dither avoids marching bands, with no invented density motion.
 float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
 float rayDistance=near+stepLength*(.35+.3*jitter);
 vec3 lightDirection=normalize(worldFromView(vec3(-.45,.75,1.)));
 vec3 radiance=vec3(0.);
 float transmission=1.;
 for(int i=0;i<STEPS;i++){
  vec3 p=eye+ray*rayDistance;
  float rho=sampleDensity(p)/referenceDensity;
  // Display cutoff is in reference-density units. The underlying normalized
  // angular-average field is retained intact, including when cutoff changes.
  float visible=max(rho-cutoff,0.);
  if(visible>1e-5){
   float alpha=1.-exp(-visible*40.*gain*stepLength);
   vec3 normal=densityNormal(p);
   float diffuse=max(dot(normal,lightDirection),0.);
   float rim=pow(1.-abs(dot(normal,-ray)),2.);
   float lighting=.55+.28*diffuse+.17*rim;
   float h=1.-clamp((p.y+.65)/1.75,0.,1.);
   vec3 emission=ink(h)*lighting*2.2*glow;
   radiance+=transmission*alpha*emission;
   transmission*=1.-alpha;
   if(transmission<.008)break;
  }
  rayDistance+=stepLength;
 }
 // Tone map emitted light separately, so the dark background stays identical
 // to the original and low-density gaps remain legible rather than whitening.
 color=vec4(1.-exp(-radiance)+BACKGROUND*transmission,1.);
}`;

export function createSweepRenderer(canvas){
 if(!loadedDensity)throw new Error('Load the continuous density before creating its renderer.');
 const gl=canvas.getContext('webgl2');
 if(!gl)throw new Error('WebGL2 is unavailable. Try a browser with hardware acceleration.');
 const {metadata,data}=loadedDensity;
 if(metadata.size>gl.getParameter(gl.MAX_3D_TEXTURE_SIZE))throw new Error('This device cannot display the continuous density texture.');
 let program,vao,texture,disposed=false;
 const cleanup=()=>{if(texture)gl.deleteTexture(texture);if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);};
 function compile(type,source){
  const shader=gl.createShader(type);
  if(!shader)throw new Error('Unable to allocate the density shader.');
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
   const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(`Density shader compilation failed: ${message}`);
  }
  return shader;
 }
 try{
  program=gl.createProgram();
  if(!program)throw new Error('Unable to allocate the density program.');
  let vertex,fragment;
  try{
   vertex=compile(gl.VERTEX_SHADER,vertexShader);fragment=compile(gl.FRAGMENT_SHADER,fragmentShader);
   gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(`Density shader link failed: ${gl.getProgramInfoLog(program)}`);
  }finally{if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);}
  vao=gl.createVertexArray();texture=gl.createTexture();
  if(!vao||!texture)throw new Error('Unable to allocate the density texture.');
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,axis,gl.CLAMP_TO_EDGE);
  const alignment=gl.getParameter(gl.UNPACK_ALIGNMENT);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  try{gl.texImage3D(gl.TEXTURE_3D,0,gl.RG8,metadata.size,metadata.size,metadata.size,0,gl.RG,gl.UNSIGNED_BYTE,data);}
  finally{gl.pixelStorei(gl.UNPACK_ALIGNMENT,alignment);}
  if(gl.getError()!==gl.NO_ERROR)throw new Error('Unable to upload the continuous density texture.');
 }catch(error){cleanup();throw error;}
 const uniforms=Object.fromEntries(['density','resolution','boundsMin','boundsMax','voxelSize','azimuth','elevation','cameraDistance','gridSize','logMax','referenceDensity','gain','cutoff','glow','palette'].map(key=>[key,gl.getUniformLocation(program,key)]));
 const voxelSize=metadata.boundsMax.map((v,i)=>(v-metadata.boundsMin[i])/(metadata.size-1));
 const finite=(value,fallback,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:fallback));
 return {
  draw(p,phase,width=canvas.width,height=canvas.height){
   if(disposed)throw new Error('The continuous density renderer has been disposed.');
   if(gl.isContextLost())throw new Error('Graphics context lost. Reload to restore the study.');
   if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
   gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
   gl.useProgram(program);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);
   const camera=cameraAt(p,phase);
   gl.uniform1i(uniforms.density,0);gl.uniform2f(uniforms.resolution,width,height);
   gl.uniform3fv(uniforms.boundsMin,metadata.boundsMin);gl.uniform3fv(uniforms.boundsMax,metadata.boundsMax);gl.uniform3fv(uniforms.voxelSize,voxelSize);
   gl.uniform1f(uniforms.azimuth,camera.azimuth);gl.uniform1f(uniforms.elevation,camera.elevation);gl.uniform1f(uniforms.cameraDistance,camera.distance);
   gl.uniform1f(uniforms.gridSize,metadata.size);gl.uniform1f(uniforms.logMax,metadata.logMax);gl.uniform1f(uniforms.referenceDensity,metadata.referenceDensity);
   gl.uniform1f(uniforms.gain,finite(p.sweepGain,1,.3,3));gl.uniform1f(uniforms.cutoff,finite(p.sweepCutoff,.02,0,.5));gl.uniform1f(uniforms.glow,finite(p.glow,1,.4,1.8));
   gl.uniform1i(uniforms.palette,Math.max(0,palettes.indexOf(p.palette)));
   gl.drawArrays(gl.TRIANGLES,0,3);
   return camera;
  },
  dispose(){if(!disposed){cleanup();disposed=true;}},
 };
}
