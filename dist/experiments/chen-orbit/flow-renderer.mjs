import {cameraAt,palettes,TAU,wrap} from './core.mjs';
import {buildFlowVolume} from './flow-volume.mjs';
const meshCache=new Map();
const vertex=`#version 300 es
precision highp float;
in vec3 position,normal;
in float speed;
out float flowSpeed;
uniform vec2 resolution;
uniform float azimuth,elevation,distance;
out vec3 worldPosition,worldNormal;
void main(){
 float c=cos(azimuth),s=sin(azimuth),ce=cos(elevation),se=sin(elevation);
 vec3 p=vec3(c*position.x+s*position.z,position.y,-s*position.x+c*position.z);
 p=vec3(p.x,ce*p.y-se*p.z,se*p.y+ce*p.z);float z=distance-p.z;
 vec2 xy=p.xy*2.55*min(resolution.x,resolution.y)/resolution;
 gl_Position=vec4(xy,1.0134228*z-.2013423,z);worldPosition=position;worldNormal=normal;flowSpeed=speed;
}`;
const fragment=`#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D density;
uniform vec3 eye;
uniform float glow,phase,threshold;
uniform int palette;
in vec3 worldPosition,worldNormal;
in float flowSpeed;
out vec4 color;
float field(vec3 p){vec3 uv=(p-vec3(-1.55,-1.05,-.6))/vec3(3.1,2.1,1.2);if(any(lessThan(uv,vec3(0.)))||any(greaterThan(uv,vec3(1.))))return 0.;uv=uv*vec3(112./113.,80./81.,48./49.)+.5/vec3(113.,81.,49.);return texture(density,uv).r;}
float shadow(vec3 p,vec3 light){float shade=1.;for(int i=1;i<=24;i++){float d=.025+.034*float(i);float f=field(p+light*d);shade*=1.-.18*smoothstep(threshold*.85,threshold*1.3,f);}return max(.1,shade);}
float occlusion(vec3 p,vec3 n){float ao=0.;for(int i=1;i<=4;i++){float d=.035*float(i);ao+=smoothstep(threshold*.6,threshold*1.2,field(p+n*d))*.14;}return 1.-ao;}
void main(){
 vec3 p=worldPosition,n=normalize(worldNormal),v=normalize(eye-p),key=normalize(vec3(-.65,.9,1.)),rim=normalize(vec3(.7,.45,-1.));
 // Colour follows locally averaged speed measured from the integrated samples.
 float slow=1.-smoothstep(.06,.58,flowSpeed);
 vec3 base=mix(vec3(.20,.028,.34),vec3(.85,.21,.045),slow);
 vec3 warm=vec3(1.,.76,.55),cool=vec3(.40,.32,1.);
 if(palette==1){base=mix(vec3(.025,.15,.24),vec3(.20,.65,.44),slow);warm=vec3(.72,1.,.92);cool=vec3(.28,.55,1.);}
 if(palette==2){base=mix(vec3(.13,.15,.23),vec3(.65,.48,.24),slow);warm=vec3(1.,.92,.75);cool=vec3(.46,.58,1.);}
 float ao=occlusion(p,n),shade=shadow(p+n*.018,key),diffuse=max(dot(n,key),0.),edge=pow(1.-max(dot(n,v),0.),3.);
 float spec=pow(max(dot(n,normalize(key+v)),0.),48.),back=pow(max(dot(n,normalize(rim+v)),0.),28.);
 vec3 lit=base*(.20*ao+1.5*diffuse*shade)*warm;
 lit+=cool*base*(.22+.32*max(dot(n,rim),0.))*ao;
 lit+=warm*spec*shade*.65+cool*back*.55;
 // A gentle, periodic illumination sweep, not a looping chaotic simulation.
 float pulse=.85+.15*sin(phase+p.x*2.+p.y*3.);
 lit+=mix(cool,warm,slow)*edge*.25*glow*pulse*ao;
 lit=pow(vec3(1.)-exp(-lit*1.5),vec3(1./2.2));color=vec4(lit,1.);
}`;
export function createFlowRenderer(canvas){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 const resources=new Map();
 function prepare(origin){
  if(resources.has(origin))return resources.get(origin);
  let mesh=meshCache.get(origin);if(!mesh){mesh=buildFlowVolume({amplitude:origin==='cyclic'?3:0});meshCache.set(origin,mesh);}
  const vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);
  for(const [name,data,size] of [['position',mesh.positions,3],['normal',mesh.normals,3],['speed',mesh.speeds,1]]){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}
  const index=gl.createBuffer();buffers.push(index);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,...mesh.density.dimensions,0,gl.RED,gl.UNSIGNED_BYTE,mesh.texture);for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_3D,k,gl.LINEAR);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,k,gl.CLAMP_TO_EDGE);
  const result={mesh,vao,buffers,texture};resources.set(origin,result);return result;
 }
 const u=Object.fromEntries(['resolution','azimuth','elevation','distance','eye','glow','phase','palette','density','threshold'].map(k=>[k,gl.getUniformLocation(program,k)]));
 return {draw(p,phase,width=canvas.width,height=canvas.height){
  if(gl.isContextLost())throw new Error('Graphics context lost. Reload to restore the study.');
  const {mesh,vao,texture}=prepare(p.origin||'fixed');
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.012,.009,.021,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);gl.uniform1i(u.density,0);gl.uniform1f(u.threshold,mesh.threshold);
  const camera=cameraAt(p,phase);for(const k of ['azimuth','elevation','distance'])gl.uniform1f(u[k],camera[k]);gl.uniform2f(u.resolution,width,height);gl.uniform3f(u.eye,-Math.sin(camera.azimuth)*Math.cos(camera.elevation)*camera.distance,Math.sin(camera.elevation)*camera.distance,Math.cos(camera.azimuth)*Math.cos(camera.elevation)*camera.distance);gl.uniform1f(u.glow,p.glow);gl.uniform1f(u.phase,TAU*wrap(phase));gl.uniform1i(u.palette,palettes.indexOf(p.palette));gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_INT,0);return camera;
 },dispose(){for(const {vao,buffers,texture} of resources.values()){for(const b of buffers)gl.deleteBuffer(b);gl.deleteTexture(texture);gl.deleteVertexArray(vao);}gl.deleteProgram(program);}};
}
