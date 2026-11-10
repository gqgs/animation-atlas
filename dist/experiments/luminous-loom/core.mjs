import {rotationSequence} from '../../shared/rotation-sequence.mjs';
export const TAU = 2 * Math.PI;
export const defaults = Object.freeze({fibers:96, samples:640, p:2, q:3, spread:.62, width:1.05, opacity:.62, glow:1, zoom:1, duration:24, palette:'aurora', renderer:'direct'});
export const limits = Object.freeze({fibers:[8,384,1], samples:[128,1536,1], p:[1,5,1], q:[1,7,1], spread:[.05,1.4,.01], width:[.3,2.4,.05], opacity:[.1,1,.01], zoom:[.6,1.3,.01], duration:[4,60,1]});
export const palettes = Object.freeze({aurora:['#50d6e8','#88e0cc','#8b89f4','#eb93d7','#ffa780','#ffdfad'], ember:['#7d5bdb','#bb64cd','#ed7f9f','#ffac76','#ffd4a0','#fff0c9'], glacier:['#426abd','#64a6dd','#69d2d4','#a1e9d6','#d3f3d7','#f0e7b9']});
export function normalize(input={}) {
 const out={...defaults};
 for(const [key,[min,max,step]] of Object.entries(limits)) {
  if(input[key] === undefined || input[key] === '') continue;
  const n=Number(input[key]);
  if(Number.isFinite(n))out[key]=Math.max(min,Math.min(max,step===1?Math.round(n):n));
 }
 if(Object.hasOwn(palettes,input.palette))out.palette=input.palette;
 if(['direct','path2d','merged'].includes(input.renderer))out.renderer=input.renderer;
 if(input.glow!==undefined)out.glow=Number(input.glow)?1:0;
 return out;
}
export function wrapPhase(phase) {
 if(!Number.isFinite(phase))throw new RangeError('Phase must be finite');
 return ((phase%1)+1)%1;
}
// Fixed angular tables are shared across every fiber and every animation frame.
// Caller-local caching avoids coupling separate preview/export/benchmark scenes.
export function createGeometry(scene) {
 const p=normalize(scene),n=p.samples;
 const major=rotationSequence(n,0,TAU*p.p/n),minor=rotationSequence(n,0,TAU*p.q/n);
 const around=rotationSequence(p.fibers,-p.spread/2,p.spread/(p.fibers-1));
 const coordinates=new Float64Array(p.fibers*n*2);
 return {settings:p,major,minor,around,coordinates,spread:p.spread};
}
export function geometryAt(workspace,phase,scene=workspace.settings) {
 // Only spread varies continuously. Topology/density stay workspace-owned;
 // reuse the small fiber-angle buffer instead of reallocating all coordinates.
 const spread=Number.isFinite(scene.spread)?Math.max(limits.spread[0],Math.min(limits.spread[1],scene.spread)):workspace.settings.spread;
 if(spread!==workspace.spread){rotationSequence(workspace.settings.fibers,-spread/2,spread/(workspace.settings.fibers-1),workspace.around);workspace.spread=spread;}
 const p=workspace.settings,t=wrapPhase(phase)*TAU;
 const {major,minor,around,coordinates}=workspace,n=p.samples;
 const yaw=t+.32, pitch=.67+.22*Math.sin(t),roll=.12*Math.sin(t);
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
 const breathe=1+.055*Math.sin(2*t);
 for(let j=0;j<p.fibers;j++) {
  const u=j/(p.fibers-1),c=around[2*j],s=around[2*j+1];
  // A ribbon of neighboring (p,q) torus knots, not a changing topology.
  const radius=(.40+.13*(u-.5))*breathe;
  for(let i=0;i<n;i++) {
   const a=minor[2*i]*c-minor[2*i+1]*s,b=minor[2*i+1]*c+minor[2*i]*s;
   const ring=1+radius*a,x=ring*major[2*i],y=ring*major[2*i+1],z=radius*b;
   const xx=cy*x+sy*z,zz=-sy*x+cy*z,yy=cx*y-sx*zz;
   const index=2*(j*n+i);coordinates[index]=cr*xx-sr*yy;coordinates[index+1]=sr*xx+cr*yy;
  }
 }
 return coordinates;
}
export function colorIndex(fiber,fibers) {return Math.min(5,Math.floor(fiber*6/fibers));}
export function counts(p) {return {fibers:p.fibers,segments:p.fibers*p.samples,passes:p.glow?2:1,strokes:p.fibers*(p.glow?2:1)};}
