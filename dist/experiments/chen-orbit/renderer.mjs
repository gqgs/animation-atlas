import {buildAttractor,cameraAt,palettes,TAU,wrap} from './core.mjs';
import {buildSurface,surfaceGLSL} from './surface.mjs';
import {createRenderer as createTraceRenderer} from './trace-renderer.mjs';
let meshCache,textureCache;
function flowTexture(){
 if(textureCache)return textureCache;
 const size=512,raw=new Float32Array(size*size),blur=new Float32Array(size*size),bytes=new Uint8Array(size*size),{data}=buildAttractor();
 for(let i=0;i<data.length;i+=4){const x=Math.round((data[i]*1.16/3.4+.5)*(size-1)),y=Math.round((data[i+1]*1.35/2.4+.5)*(size-1));if(x>=0&&x<size&&y>=0&&y<size)raw[x+y*size]++;}
 for(let y=0;y<size;y++)for(let x=2;x<size-2;x++){const i=x+y*size;blur[i]=(raw[i-2]+2*raw[i-1]+3*raw[i]+2*raw[i+1]+raw[i+2])/9;}
 for(let y=2;y<size-2;y++)for(let x=0;x<size;x++){const i=x+y*size,d=(blur[i-size*2]+2*blur[i-size]+3*blur[i]+2*blur[i+size]+blur[i+size*2])/9;bytes[i]=Math.min(255,Math.round(255*Math.log1p(d)/Math.log(35)));}
 return textureCache={size,bytes};
}
const vertex=`#version 300 es
precision highp float;
in vec3 position,normal;
uniform vec2 resolution;
uniform float azimuth,elevation,distance;
out vec3 worldPosition,worldNormal;
void main(){
 float c=cos(azimuth),s=sin(azimuth),ce=cos(elevation),se=sin(elevation);
 vec3 p=vec3(c*position.x+s*position.z,position.y,-s*position.x+c*position.z);
 p=vec3(p.x,ce*p.y-se*p.z,se*p.y+ce*p.z);float z=distance-p.z;
 vec2 xy=p.xy*2.55*min(resolution.x,resolution.y)/resolution;
 gl_Position=vec4(xy,1.0134228*z-.2013423,z);worldPosition=position;worldNormal=normal;
}`;
const fragment=`#version 300 es
precision highp float;
uniform sampler2D flow;
uniform vec3 eye;
uniform float glow,phase;
uniform int palette;
in vec3 worldPosition,worldNormal;
out vec4 color;
${surfaceGLSL}
float shadow(vec3 p,vec3 light){float t=.018,res=1.;for(int i=0;i<24;i++){float d=surfaceDistance(p+t*light);res=min(res,10.*d/t);t+=clamp(d,.025,.16);if(d<.0005||t>2.8)break;}return clamp(res,.08,1.);}
float occlusion(vec3 p,vec3 n){float o=0.,w=1.;for(int i=1;i<=4;i++){float d=.055*float(i);o+=(d-surfaceDistance(p+n*d))*w;w*=.62;}return clamp(1.-o*2.,.22,1.);}
void main(){
 vec3 p=worldPosition,n=normalize(worldNormal),v=normalize(eye-p),key=normalize(vec3(-.65,.9,1.)),rim=normalize(vec3(.7,.45,-1.));
 float density=texture(flow,vec2(p.x/3.4+.5,p.y/2.4+.5)).r;
 float engraving=smoothstep(.08,.7,density),height=clamp(.5-p.y*.55,0.,1.);
 vec3 base=mix(vec3(.12,.026,.23),vec3(.66,.22,.075),height);
 vec3 warm=vec3(1.,.72,.46),cool=vec3(.35,.42,1.);
 if(palette==1){base=mix(vec3(.025,.12,.20),vec3(.20,.55,.46),height);warm=vec3(.72,1.,.92);cool=vec3(.28,.55,1.);}
 if(palette==2){base=mix(vec3(.13,.15,.23),vec3(.55,.43,.27),height);warm=vec3(1.,.92,.75);cool=vec3(.46,.58,1.);}
 base*=.7+.42*engraving;
 float ao=occlusion(p,n),shade=shadow(p+n*.009,key),diffuse=max(dot(n,key),0.),edge=pow(1.-max(dot(n,v),0.),3.);
 float spec=pow(max(dot(n,normalize(key+v)),0.),60.),back=pow(max(dot(n,normalize(rim+v)),0.),35.);
 vec3 lit=base*(.20*ao+1.4*diffuse*shade)*warm;
 lit+=cool*base*(.22+.34*max(dot(n,rim),0.))*ao;
 lit+=warm*spec*shade*(.65+.35*engraving)+cool*back*.65;
 lit+=warm*edge*.14*ao;
 // Actual integrated Chen trajectories become luminous grain on the solid skin.
 float pulse=.8+.2*sin(phase+p.x*2.+p.y*3.);
 lit+=mix(cool,warm,height)*engraving*.13*glow*pulse*ao;
 lit=pow(vec3(1.)-exp(-lit*1.45),vec3(1./2.2));
 color=vec4(lit,1.);
}`;
export function createRenderer(canvas){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw new Error('WebGL2 is unavailable. Try a browser with hardware acceleration.');
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 const mesh=meshCache||(meshCache=buildSurface()),vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);
 for(const [name,data] of [['position',mesh.positions],['normal',mesh.normals]]){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}
 const index=gl.createBuffer();buffers.push(index);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
 const texture=gl.createTexture(),flow=flowTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,flow.size,flow.size,0,gl.RED,gl.UNSIGNED_BYTE,flow.bytes);for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
 const u=Object.fromEntries(['resolution','azimuth','elevation','distance','eye','glow','phase','palette','flow'].map(k=>[k,gl.getUniformLocation(program,k)]));let trace;
 return {
  draw(p,phase,width=canvas.width,height=canvas.height){
   if(p.form==='trace'){trace||=createTraceRenderer(canvas);return trace.draw(p,phase,width,height);}
   if(gl.isContextLost())throw new Error('Graphics context lost. Reload to restore the study.');
   if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
   gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.012,.009,.021,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(u.flow,0);
   const camera=cameraAt(p,phase);for(const k of ['azimuth','elevation','distance'])gl.uniform1f(u[k],camera[k]);gl.uniform2f(u.resolution,width,height);gl.uniform3f(u.eye,-Math.sin(camera.azimuth)*Math.cos(camera.elevation)*camera.distance,Math.sin(camera.elevation)*camera.distance,Math.cos(camera.azimuth)*Math.cos(camera.elevation)*camera.distance);gl.uniform1f(u.glow,p.glow);gl.uniform1f(u.phase,TAU*wrap(phase));gl.uniform1i(u.palette,palettes.indexOf(p.palette));gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_INT,0);return camera;
  },
  dispose(){for(const b of buffers)gl.deleteBuffer(b);gl.deleteTexture(texture);gl.deleteVertexArray(vao);gl.deleteProgram(program);if(trace)trace.dispose();else gl.getExtension('WEBGL_lose_context')?.loseContext();},
 };
}
