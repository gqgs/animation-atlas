import {sceneAt,sampleJulia,paletteNames} from './core.mjs';
const vertex=`#version 300 es
precision highp float;
in vec3 samplePoint;
uniform vec2 resolution,center,warp;
uniform float extent,rotation,pointSize;
out float hue;
void main(){
 vec2 focus=vec2(-.5,.05);
 vec2 z=(samplePoint.xy-focus)/.35, n=z+warp;
 vec2 d=vec2(1.-dot(warp,z),warp.y*z.x-warp.x*z.y);
 float denominator=dot(d,d);
 if(denominator<1e-10){gl_Position=vec4(4.,4.,0.,1.);gl_PointSize=1.;hue=0.;return;}
 z=.35*vec2(dot(n,d),n.y*d.x-n.x*d.y)/denominator+focus-center;
 float c=cos(rotation),s=sin(rotation);
 z=mat2(c,-s,s,c)*z;
 gl_Position=vec4(z/extent*min(resolution.x,resolution.y)/resolution,0.,1.);
 gl_PointSize=pointSize;
 hue=samplePoint.z;
}`;
const fragment=`#version 300 es
precision highp float;
in float hue;
uniform int palette;
uniform float colorCycles;
out vec4 color;
void main(){
 float radius=length(gl_PointCoord-.5)*2.;
 float alpha=(1.-smoothstep(.35,1.,radius))*.19;
 if(alpha<=0.)discard;
 float t=.5+.5*cos(6.2831853*(hue*colorCycles*2.+.12));
 vec3 ink=mix(vec3(.34,.12,.73),vec3(.91,.06,.28),pow(t,3.));
 if(palette==1)ink=mix(vec3(.07,.48,.7),vec3(.61,1.,.73),pow(t,2.));
 if(palette==2)ink=mix(vec3(.27,.12,.42),vec3(.94,.21,.08),pow(t,3.));
 if(palette==3)ink=vec3(.05);
 color=vec4(ink,alpha);
}`;
export function createRenderer(canvas){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
 if(!gl)throw Error('WebGL2 is unavailable. Enable hardware acceleration or use a compatible browser.');
 function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 const loc=gl.getAttribLocation(program,'samplePoint');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
 const u=Object.fromEntries(['resolution','center','warp','extent','rotation','pointSize','palette','colorCycles'].map(n=>[n,gl.getUniformLocation(program,n)]));
 const maxPointSize=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];let cached='';
 return {draw(parameters,phase,width=canvas.width,height=canvas.height){
  if(gl.isContextLost())throw Error('Graphics context lost. Reload the study to restore it.');
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  const key=[parameters.real,parameters.imaginary,parameters.bias,parameters.iterations].join(',');
  if(key!==cached){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,sampleJulia(parameters),gl.STATIC_DRAW);cached=key;}
  const p=sceneAt(parameters,phase),palette=paletteNames.indexOf(p.palette);
  gl.viewport(0,0,width,height);gl.useProgram(program);
  const bg=palette===1?[.015,.025,.065]:palette===2?[.99,.975,.9]:[.985,.98,1.];
  gl.clearColor(...bg,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform2f(u.resolution,width,height);gl.uniform2f(u.center,p.centerX,p.centerY);gl.uniform2f(u.warp,p.warpX,p.warpY);
  gl.uniform1f(u.extent,p.extent);gl.uniform1f(u.rotation,p.rotation*Math.PI/180);
  gl.uniform1f(u.pointSize,Math.min(maxPointSize,Math.max(1.25,1.6*Math.min(width,height)/1080)));
  gl.uniform1f(u.colorCycles,p.colorCycles);gl.uniform1i(u.palette,palette);
  gl.drawArrays(gl.POINTS,0,p.iterations);return p;
 },dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
