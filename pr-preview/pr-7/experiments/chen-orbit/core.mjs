// Chen–Čelikovský system, parameters from Paul Bourke's October 2010 reference.
export const TAU = 2 * Math.PI;
export const parameters = Object.freeze({a:36, b:3, c:20});
export const defaults = Object.freeze({duration:48, azimuth:0, elevation:12, zoom:1, glow:1, palette:'ember', motion:'orbit'});
export const limits = {duration:[8,120], azimuth:[-180,180], elevation:[-80,80], zoom:[.65,1.65], glow:[.4,1.8]};
export const palettes = ['ember','glacier','pearl'];
export const wrap = t => ((t % 1) + 1) % 1;
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
  const t=TAU*wrap(phase),moving=p.motion==='orbit';
  return {azimuth:p.azimuth*Math.PI/180+(moving?t:0),elevation:Math.max(-80*Math.PI/180,Math.min(80*Math.PI/180,p.elevation*Math.PI/180+(moving?.11*Math.sin(t):0))),distance:4.4/p.zoom};
}
export function readSettings(search) {
  const q=new URLSearchParams(search),p={...defaults};
  for(const [key,[lo,hi]] of Object.entries(limits))if(q.has(key)&&q.get(key).trim()&&Number.isFinite(Number(q.get(key))))p[key]=Math.max(lo,Math.min(hi,Number(q.get(key))));
  if(palettes.includes(q.get('palette')))p.palette=q.get('palette');
  if(['orbit','still'].includes(q.get('motion')))p.motion=q.get('motion');
  const v=Number(q.get('phase'));return {parameters:p,phase:Number.isFinite(v)?wrap(v):0,paused:q.has('phase')};
}
export function settingsQuery(p,phase){return new URLSearchParams({...p,phase:wrap(phase)}).toString();}
