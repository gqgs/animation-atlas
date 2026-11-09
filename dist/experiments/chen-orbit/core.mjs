// Chen–Čelikovský system, parameters from Paul Bourke's October 2010 reference.
export const TAU = 2 * Math.PI;
export const parameters = Object.freeze({a:36, b:3, c:20});
export const defaults = Object.freeze({duration:48, azimuth:0, elevation:12, zoom:1, glow:1, palette:'ember', motion:'orbit', pattern:'ribbons', cameraOffset:0, study:'trajectory', level:2, guides:false, stride:8, lines:false, opacity:'scaled', sweepGain:1, sweepCutoff:.02});
export const limits = {duration:[8,120], azimuth:[-180,180], elevation:[-180,180], zoom:[.65,1.65], glow:[.4,1.8], sweepGain:[.3,3], sweepCutoff:[0,.5]};
export const palettes = ['ember','glacier','pearl'];
export const wrap = t => ((t % 1) + 1) % 1;
export const wrapDegrees = degrees => ((degrees+180)%360+360)%360-180;
export function derivative([x,y,z], {a,b,c}=parameters) { return [a*(y-x), c*y-x*z, x*y-b*z]; }
export function rk4(p, dt=.002) {
  const add=(v,k,s)=>v.map((x,i)=>x+s*k[i]);
  const a=derivative(p),b=derivative(add(p,a,dt/2)),c=derivative(add(p,b,dt/2)),d=derivative(add(p,c,dt));
  return p.map((x,i)=>x+dt/6*(a[i]+2*b[i]+2*c[i]+d[i]));
}
export function buildAttractor({count=180000, burn=6000, dt=.002}={}) {
  if(!Number.isInteger(count)||count<2||count>500000||!Number.isInteger(burn)||burn<0||!Number.isFinite(dt)||dt<=0||dt>.005)throw new RangeError('Invalid integration settings');
  let p=[.1,.1,.1];
  for(let i=0;i<burn;i++)p=rk4(p,dt);
  const data=new Float32Array(count*4),bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(let i=0;i<count;i++){
    p=rk4(p,dt);
    if(!p.every(Number.isFinite))throw new Error('Attractor integration diverged');
    // A rigid change of basis, with z up. No fabricated depth or flattened axes.
    const q=[(p[0]+p[1])/Math.SQRT2*.038,(p[2]-22)*.038,(p[1]-p[0])/Math.SQRT2*.038];
    for(let j=0;j<3;j++){data[i*4+j]=q[j];bounds.min[j]=Math.min(bounds.min[j],q[j]);bounds.max[j]=Math.max(bounds.max[j],q[j]);}
    data[i*4+3]=i/(count-1);
  }
  return {data,count,bounds,dt,burn};
}
export function cameraAt(p, phase) {
  const t=TAU*wrap(phase+(p.cameraOffset||0)),moving=p.motion==='orbit';
  const pitch=p.elevation*Math.PI/180,amplitude=Math.min(.11,Math.max(0,(80-Math.abs(p.elevation))*Math.PI/180));
  return {azimuth:p.azimuth*Math.PI/180+(moving?t:0),elevation:pitch+(p.motion==='vertical'?t:moving?amplitude*Math.sin(t):0),distance:4.4/p.zoom};
}
// Keep the full camera frame and light phase when changing paths, including
// the inverted back half of the vertical circuit. Euler angles may wrap, but
// their rotation matrix stays continuous through both poles.
export function switchCameraMotion(p,motion,phase){
 if(!['orbit','vertical','still'].includes(motion))throw new RangeError('Invalid camera motion');
 const camera=cameraAt(p,phase);
 return {...p,motion,azimuth:wrapDegrees(camera.azimuth*180/Math.PI),elevation:wrapDegrees(camera.elevation*180/Math.PI),cameraOffset:wrap(-phase)};
}
export function readSettings(search) {
  const q=new URLSearchParams(search),p={...defaults};
  for(const [key,[lo,hi]] of Object.entries(limits))if(q.has(key)&&q.get(key).trim()&&Number.isFinite(Number(q.get(key))))p[key]=Math.max(lo,Math.min(hi,Number(q.get(key))));
  if(q.has('cameraOffset')&&Number.isFinite(Number(q.get('cameraOffset'))))p.cameraOffset=wrap(Number(q.get('cameraOffset')));
  if(['ribbons','original'].includes(q.get('pattern')))p.pattern=q.get('pattern');
  if(['planes','sweep'].includes(q.get('study')))p.study=q.get('study');
  if(q.has('level')&&/^[0-4]$/.test(q.get('level')))p.level=Number(q.get('level'));
  if(q.has('stride')&&/^[1248]$/.test(q.get('stride')))p.stride=Number(q.get('stride'));
  if(['scaled','fixed'].includes(q.get('opacity')))p.opacity=q.get('opacity');
  if(q.get('lines')==='true')p.lines=true;
  if(q.get('guides')==='true')p.guides=true;
  if(palettes.includes(q.get('palette')))p.palette=q.get('palette');
  if(['orbit','vertical','still'].includes(q.get('motion')))p.motion=q.get('motion');
  const v=Number(q.get('phase'));return {parameters:p,phase:Number.isFinite(v)?wrap(v):0,paused:q.has('phase')};
}
export function settingsQuery(p,phase){return new URLSearchParams({...p,phase:wrap(phase)}).toString();}
