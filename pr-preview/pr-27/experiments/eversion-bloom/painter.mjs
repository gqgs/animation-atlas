import {poseAt,geometryAt,indices,ANGULAR,RADIAL} from './core.mjs';
const renderers=new WeakMap();
function renderer(target){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
 if(!gl)throw new Error('Eversion Bloom needs WebGL2. Try a browser with hardware acceleration.');
 const vs=`#version 300 es
 in vec3 position; in float radial; uniform vec4 view; uniform float aspect; out vec3 vPosition; out float vRadial;
 void main(){float c=cos(view.x),s=sin(view.x),e=view.y;vec3 q=vec3(position.x*c-position.z*s,position.y,position.x*s+position.z*c);q=vec3(q.x,q.y*cos(e)-q.z*sin(e),q.y*sin(e)+q.z*cos(e));vPosition=q;vRadial=radial;gl_Position=vec4(q.x*view.z/aspect,q.y*view.z-.08,-q.z/8.,1.);}`;
 const fs=`#version 300 es
 precision highp float; in vec3 vPosition; in float vRadial; out vec4 color;
 void main(){vec3 n=normalize(cross(dFdx(vPosition),dFdy(vPosition)));vec3 light=normalize(vec3(-.45,.65,1.));float diffuse=.27+.73*max(0.,dot(n,light));float spec=pow(max(0.,dot(n,normalize(light+vec3(0.,0.,1.)))),36.);
 vec3 teal=mix(vec3(.07,.30,.33),vec3(.28,.69,.65),vRadial);vec3 plum=mix(vec3(.25,.075,.22),vec3(.77,.35,.31),vRadial);vec3 base=gl_FrontFacing?teal:plum;
 float rim=smoothstep(.975,1.,vRadial);base=mix(base,vec3(.87,.69,.42),rim*.75);color=vec4(base*diffuse+vec3(.8,.85,.78)*spec*.28,1.);}`;
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const positions=new Float32Array((ANGULAR+1)*(RADIAL+1)*3),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,positions.byteLength,gl.DYNAMIC_DRAW);const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
 const radial=new Float32Array((ANGULAR+1)*(RADIAL+1));for(let i=0;i<radial.length;i++)radial[i]=(i%(RADIAL+1))/RADIAL;
 const rb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,rb);gl.bufferData(gl.ARRAY_BUFFER,radial,gl.STATIC_DRAW);const rl=gl.getAttribLocation(program,'radial');gl.enableVertexAttribArray(rl);gl.vertexAttribPointer(rl,1,gl.FLOAT,false,0,0);
 const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 const view=gl.getUniformLocation(program,'view'),aspect=gl.getUniformLocation(program,'aspect');
 const result={render(p,phase,w,h){
  if(gl.isContextLost())throw new Error('Graphics context lost. Reload to restore the shell.');
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  geometryAt(p,phase,positions);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,positions);gl.uniform4f(view,p.rotation*Math.PI/180+.12,p.elevation*Math.PI/180,.27*p.zoom,0);gl.uniform1f(aspect,w/h);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);return canvas;
 }};renderers.set(target,result);return result;
}
export function draw(canvas,settings,tracks,phase){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=Math.min(w,h),p=poseAt(settings,tracks,phase);
 const g=ctx.createRadialGradient(w*.5,h*.52,0,w*.5,h*.52,s*.68);g.addColorStop(0,'#26313a');g.addColorStop(.55,'#101922');g.addColorStop(1,'#080d16');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const layer=(renderers.get(canvas)||renderer(canvas)).render(p,phase,w,h);ctx.drawImage(layer,0,0);
}
