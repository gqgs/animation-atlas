import {sceneAt,paletteNames} from './core.mjs';
const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution,center,parameter;
uniform float extent,rotation,colorCycles;
uniform int iterations,palette;
out vec4 outputColor;
const float TAU=6.28318530718;
vec3 ink(float t){
 if(palette==3)return vec3(1.-clamp(t*.7,0.,1.));
 if(palette==2){
  vec3 quiet=mix(vec3(.98),vec3(.015,.055,.055),clamp(t/.82,0.,1.));
  vec3 fire=mix(vec3(.55,.015,.035),vec3(1.,.72,.22),clamp((t-.95)*2.3,0.,1.));
  return mix(quiet,fire,smoothstep(.82,.99,t));
 }
 if(palette==1)return .49+.46*cos(TAU*(vec3(.10,.38,.57)+t*.65));
 vec3 pearl=mix(vec3(.98,.98,1.),vec3(.36,.51,1.),clamp(t/.95,0.,1.));
 return mix(pearl,vec3(.96,.08,.23),smoothstep(.98,1.48,t));
}
vec3 sampleField(vec2 pixel){
 vec2 z=(2.*pixel-resolution)/min(resolution.x,resolution.y)*extent;
 float c=cos(rotation),s=sin(rotation);
 z=center+mat2(c,s,-s,c)*z;
 float count=0.;bool stopped=false;float before=length(z),after=before;
 for(int n=0;n<512;n++){
  if(n>=iterations)break;
  if(dot(z,z)>4.){stopped=true;break;}
  before=length(z);
  vec2 w=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+parameter;
  float e=exp(-2.*abs(w.y)),cs=cos(w.x);
  float d=(1.-e)*(1.-e)+4.*e*cs*cs;
  count=float(n+1);
  if(d<1e-12){stopped=true;break;}
  z=vec2(2.*e*sin(2.*w.x),sign(w.y)*(1.-e*e))/d;
  after=length(z);
 }
 if(dot(z,z)>4.)stopped=true;
 if(!stopped)return palette==0?vec3(1.):palette==2?vec3(.16,.006,.018):vec3(.015);
 // Artistic sub-band interpolation, NOT a polynomial escape potential.
 float crossing=clamp((2.-before)/max(after-before,.00001),0.,1.);
 float level=log(1.+max(0.,count-1.+crossing));
 float t=level*.27*colorCycles;
 vec3 col=ink(t);
 float contour=.94+.06*cos(TAU*(count-1.+crossing));
 return col*contour;
}
void main(){
 // Four sub-pixel samples soften fine filaments without a viewport upscale.
 vec3 col=sampleField(gl_FragCoord.xy+vec2(-.25,-.25));
 col+=sampleField(gl_FragCoord.xy+vec2(.25,-.25));
 col+=sampleField(gl_FragCoord.xy+vec2(-.25,.25));
 col+=sampleField(gl_FragCoord.xy+vec2(.25,.25));
 outputColor=vec4(col*.25,1.);
}`;
export function createRenderer(canvas) {
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl)throw new Error('WebGL2 is unavailable. Enable hardware acceleration or use a compatible browser.');
  function shader(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);}
    return shader;
  }
  const program=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
  const uniforms=Object.fromEntries(['resolution','center','parameter','extent','rotation','colorCycles','iterations','palette'].map(n=>[n,gl.getUniformLocation(program,n)]));
  return {
    draw(parameters,phase,width=canvas.width,height=canvas.height){
      if(gl.isContextLost())throw new Error('Graphics context was lost. Reload the study to restore it.');
      if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
      const p=sceneAt(parameters,phase);gl.viewport(0,0,width,height);gl.useProgram(program);
      gl.uniform2f(uniforms.resolution,width,height);gl.uniform2f(uniforms.center,p.centerX,p.centerY);
      gl.uniform2f(uniforms.parameter,p.real,p.imaginary);gl.uniform1f(uniforms.extent,p.extent);
      gl.uniform1f(uniforms.rotation,p.rotation*Math.PI/180);gl.uniform1f(uniforms.colorCycles,p.colorCycles);
      gl.uniform1i(uniforms.iterations,p.iterations);gl.uniform1i(uniforms.palette,paletteNames.indexOf(p.palette));
      gl.drawArrays(gl.TRIANGLES,0,3);
      return p;
    },
    dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();},
  };
}
