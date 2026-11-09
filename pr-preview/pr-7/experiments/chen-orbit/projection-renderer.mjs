import {cameraAt,palettes,TAU,wrap} from './core.mjs';
import {buildLightTrail} from './patterns.mjs';
import {projectionSamples,guideVertices} from './projections.mjs?v=density-1';
export const vertexShader=`#version 300 es
precision highp float;
precision highp int;
in highp vec4 point;
uniform highp vec2 resolution;
uniform highp float azimuth,elevation,cameraDistance,phase,pointScale;
uniform highp int planeCount,guide;
out highp float height,depth,light,orientation;
float packet(float age){return smoothstep(0.,.008,age)*exp(-pow(age/.065,2.));}
void main(){
 float theta=float(gl_InstanceID)*3.141592653589793/float(planeCount);
 vec2 d=vec2(cos(theta)+sin(theta),sin(theta)-cos(theta))*.7071067811865476;
 // Orthogonal projection of each real sample, not a rotated silhouette.
 float u=guide==1?point.x:dot(point.xz,d);
 vec3 projected=vec3(u*d.x,point.y,u*d.y);
 float c=cos(azimuth),s=sin(azimuth),ce=cos(elevation),se=sin(elevation);
 vec3 p=vec3(c*projected.x+s*projected.z,projected.y,-s*projected.x+c*projected.z);
 p=vec3(p.x,ce*p.y-se*p.z,se*p.y+ce*p.z);
 float z=cameraDistance-p.z;vec2 xy=p.xy*2.55/z;
 xy*=min(resolution.x,resolution.y)/resolution;
 gl_Position=vec4(xy*z,0.,z);
 gl_PointSize=max(1.,pointScale*min(resolution.x,resolution.y)/900.*4.4/z);
 height=clamp((point.y+.65)/1.75,0.,1.);depth=clamp((p.z+1.7)/3.4,0.,1.);
 orientation=float(gl_InstanceID)/float(planeCount);
 float t=phase/6.28318530718;
 light=(packet(fract(t-point.w))+.65*packet(fract(t+.5-point.w)))*smoothstep(0.,.035,point.w)*(1.-smoothstep(.965,1.,point.w));
}`;
export const fragmentShader=`#version 300 es
precision highp float;
precision highp int;
uniform highp int palette,pass,layer,pattern,planeCount,guide;
uniform highp float glow,sampleWeight;
in highp float height,depth,light,orientation;
out highp vec4 color;
vec3 ink(float h){
 if(palette==1)return mix(vec3(.04,.26,.44),vec3(.64,1.,.84),h);
 if(palette==2)return mix(vec3(.24,.30,.51),vec3(1.,.91,.76),h);
 vec3 violet=vec3(.48,.07,.95),coral=vec3(1.,.17,.17),gold=vec3(1.,.72,.26);
 return h<.62?mix(violet,coral,smoothstep(0.,.62,h)):mix(coral,gold,smoothstep(.62,1.,h));
}
void main(){
 float density=1./sqrt(float(planeCount));
 if(guide==1){color=vec4(mix(vec3(.30,.25,.45),vec3(.62,.42,.30),orientation),.20*density);return;}
 float alpha;
 if(pass==1)alpha=layer==1?.75:.045;
 else{float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;alpha=exp(-r*r*4.5)*(pass==2?.06:.55);}
 vec3 rgb=ink(1.-height);
 // A small orientation tint helps distinguish adjacent sheets without inventing flow.
 rgb=mix(rgb,vec3(.25,.65,1.),.18*pow(sin(orientation*3.14159265),2.));
 if(layer==1){alpha*=light*1.65;rgb=mix(rgb,vec3(1.,.88,.72),.40*light);}
 else {alpha*=pattern==1?.64:1.;if(pass!=1)alpha*=sampleWeight;}
 color=vec4(rgb,alpha*glow*density*(.45+.55*depth));
}`;
export function createProjectionRenderer(canvas,model){
 const gl=canvas.getContext('webgl2'),resources=[];
 function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertexShader),fs=compile(gl.FRAGMENT_SHADER,fragmentShader);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 function upload(data){const buffer=gl.createBuffer(),vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);resources.push({buffer,vao});return vao;}
 const variants=new Map();
 function variant(stride){
  if(!variants.has(stride)){const samples=projectionSamples(model,stride);variants.set(stride,{count:samples.count,vao:upload(samples.data)});}
  return variants.get(stride);
 }
 const trail=buildLightTrail(model),guides=guideVertices(),trailVao=upload(trail.data),guideVao=upload(guides);
 const uniforms=Object.fromEntries(['resolution','azimuth','elevation','cameraDistance','phase','pointScale','palette','pass','glow','layer','pattern','planeCount','guide','sampleWeight'].map(k=>[k,gl.getUniformLocation(program,k)]));
 return {
  draw(p,phase,width,height){
   if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
   gl.viewport(0,0,width,height);gl.clearColor(.012,.009,.021,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);
   const camera=cameraAt(p,phase),count=2**p.level,samples=variant(p.stride??8);
   gl.uniform2f(uniforms.resolution,width,height);gl.uniform1f(uniforms.azimuth,camera.azimuth);gl.uniform1f(uniforms.elevation,camera.elevation);gl.uniform1f(uniforms.cameraDistance,camera.distance);
   gl.uniform1f(uniforms.sampleWeight,(p.stride??8)/8);gl.uniform1f(uniforms.phase,TAU*wrap(phase));gl.uniform1f(uniforms.glow,p.glow);gl.uniform1i(uniforms.palette,palettes.indexOf(p.palette));gl.uniform1i(uniforms.planeCount,count);gl.uniform1i(uniforms.pattern,p.pattern==='original'?0:1);
   const draw=(mode,n)=>gl.drawArraysInstanced(mode,0,n,count);
   if(p.guides){gl.bindVertexArray(guideVao);gl.uniform1i(uniforms.guide,1);draw(gl.LINES,guides.length/4);}
   gl.uniform1i(uniforms.guide,0);gl.uniform1i(uniforms.layer,0);gl.bindVertexArray(samples.vao);
   gl.uniform1i(uniforms.pass,2);gl.uniform1f(uniforms.pointScale,9.);draw(gl.POINTS,samples.count);
   gl.uniform1i(uniforms.pass,0);gl.uniform1f(uniforms.pointScale,2.4);draw(gl.POINTS,samples.count);
   if(p.lines){gl.uniform1i(uniforms.pass,1);draw(gl.LINE_STRIP,samples.count);}
   if(p.pattern!=='original'){
    gl.bindVertexArray(trailVao);gl.uniform1i(uniforms.layer,1);
    gl.uniform1i(uniforms.pass,0);gl.uniform1f(uniforms.pointScale,2.8);draw(gl.POINTS,trail.count);
    gl.uniform1i(uniforms.pass,1);draw(gl.LINE_STRIP,trail.count);
   }
   return camera;
  },
  dispose(){for(const {buffer,vao} of resources){gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);}gl.deleteProgram(program);},
 };
}
