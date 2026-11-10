import {buildAttractor,cameraAt,palettes,TAU,wrap} from './core.mjs?v=camera-1';
import {createSweepRenderer} from './sweep-renderer.mjs?v=camera-1';
import {buildLightTrail} from './patterns.mjs';
import {createProjectionRenderer} from './projection-renderer.mjs?v=camera-1';
let cached;
export const vertexShader=`#version 300 es
precision highp float;
precision highp int;
in highp vec4 point;
uniform highp vec2 resolution;
uniform highp float azimuth,elevation,cameraDistance,phase,pointScale;
out highp float height,depth,flow,light;
float packet(float age){return smoothstep(0.,.008,age)*exp(-pow(age/.065,2.));}
void main(){
 float c=cos(azimuth),s=sin(azimuth),ce=cos(elevation),se=sin(elevation);
 vec3 p=vec3(c*point.x+s*point.z,point.y,-s*point.x+c*point.z);
 p=vec3(p.x,ce*p.y-se*p.z,se*p.y+ce*p.z);
 float z=cameraDistance-p.z;
 vec2 xy=p.xy*2.55/z;
 xy*=min(resolution.x,resolution.y)/resolution;
 gl_Position=vec4(xy*z,0.,z);
 gl_PointSize=max(1.,pointScale*min(resolution.x,resolution.y)/900.*4.4/z);
 height=clamp((point.y+.65)/1.75,0.,1.);
 depth=clamp((p.z+1.7)/3.4,0.,1.);
 flow=pow(.5+.5*cos(point.w*6.28318530718*18.-phase),24.);
 float u=point.w,t=phase/6.28318530718;
 light=(packet(fract(t-u))+ .65*packet(fract(t+.5-u)))*smoothstep(0.,.035,u)*(1.-smoothstep(.965,1.,u));
}`;
export const fragmentShader=`#version 300 es
precision highp float;
precision highp int;
uniform highp int palette,pass,layer,pattern;
uniform highp float glow;
in highp float height,depth,flow,light;
out highp vec4 color;
vec3 ink(float h){
 if(palette==1)return mix(vec3(.04,.26,.44),vec3(.64,1.,.84),h);
 if(palette==2)return mix(vec3(.24,.30,.51),vec3(1.,.91,.76),h);
 vec3 violet=vec3(.48,.07,.95),coral=vec3(1.,.17,.17),gold=vec3(1.,.72,.26);
 return h<.62?mix(violet,coral,smoothstep(0.,.62,h)):mix(coral,gold,smoothstep(.62,1.,h));
}
void main(){
 float alpha;
 if(pass==1){alpha=.026+.11*flow;}
 else {float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;alpha=exp(-r*r*4.5)*(pass==2?.012:.15);}
 vec3 rgb=ink(1.-height)*(.85+.25*flow);
 if(pattern==1){
  if(layer==0){alpha*=.60;rgb=ink(1.-height);}
  else {
   float r=pass==1?0.:length(gl_PointCoord-.5)*2.;
   alpha=(pass==1?.80:exp(-r*r*4.5)*(pass==2?.09:1.0))*light;
   rgb=mix(ink(1.-height),vec3(1.,.85,.65),.45*light);
  }
 }
 alpha*=glow*(.38+.62*depth);
 color=vec4(rgb,alpha);
}`;
export function createRenderer(canvas) {
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw new Error('WebGL2 is unavailable. Try a browser with hardware acceleration.');
 function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertexShader),fs=compile(gl.FRAGMENT_SHADER,fragmentShader);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 let projectionRenderer,sweepRenderer;
 const model=cached||(cached=buildAttractor()),trail=buildLightTrail(model),resources=[];
 function upload(data){const buffer=gl.createBuffer(),vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);resources.push({buffer,vao});return vao;}
 const vao=upload(model.data),trailVao=upload(trail.data);
 const uniforms=Object.fromEntries(['resolution','azimuth','elevation','distance','phase','pointScale','palette','pass','glow','layer','pattern'].map(k=>[k,gl.getUniformLocation(program,k==='distance'?'cameraDistance':k)]));
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);
 return {
  draw(p,phase,width=canvas.width,height=canvas.height){
   if(gl.isContextLost())throw new Error('Graphics context lost. Reload to restore the study.');
   if(p.study==='sweep'){sweepRenderer ||= createSweepRenderer(canvas);return sweepRenderer.draw(p,phase,width,height);}
   if(p.study==='planes'){projectionRenderer ||= createProjectionRenderer(canvas,model);return projectionRenderer.draw(p,phase,width,height);}
   if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);gl.viewport(0,0,width,height);gl.clearColor(.012,.009,.021,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);
   const camera=cameraAt(p,phase);gl.uniform2f(uniforms.resolution,width,height);
   for(const key of ['azimuth','elevation','distance'])gl.uniform1f(uniforms[key],camera[key]);
   gl.uniform1f(uniforms.phase,TAU*wrap(phase));gl.uniform1f(uniforms.glow,p.glow);gl.uniform1i(uniforms.palette,palettes.indexOf(p.palette));
   gl.uniform1i(uniforms.layer,0);gl.uniform1i(uniforms.pattern,p.pattern==='original'?0:1);
   gl.uniform1i(uniforms.pass,2);gl.uniform1f(uniforms.pointScale,8.);gl.drawArrays(gl.POINTS,0,model.count);
   gl.uniform1i(uniforms.pass,0);gl.uniform1f(uniforms.pointScale,2.2);gl.drawArrays(gl.POINTS,0,model.count);
   gl.uniform1i(uniforms.pass,1);gl.drawArrays(gl.LINE_STRIP,0,model.count);
   if(p.pattern!=='original'){
    gl.bindVertexArray(trailVao);gl.uniform1i(uniforms.layer,1);
    gl.uniform1i(uniforms.pass,2);gl.uniform1f(uniforms.pointScale,11.);gl.drawArrays(gl.POINTS,0,trail.count);
    gl.uniform1i(uniforms.pass,0);gl.uniform1f(uniforms.pointScale,2.8);gl.drawArrays(gl.POINTS,0,trail.count);
    gl.uniform1i(uniforms.pass,1);gl.drawArrays(gl.LINE_STRIP,0,trail.count);
   }
   return camera;
  },
  dispose(){projectionRenderer?.dispose();sweepRenderer?.dispose();for(const {buffer,vao} of resources){gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);}gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();},
 };
}
