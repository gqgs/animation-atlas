import {rotationSequence} from '../../shared/rotation-sequence.mjs';
// Independent implementation of a dihedral mirror chamber. No Egan source is copied.
export const TAU = 2 * Math.PI;
export const defaults = Object.freeze({seed:13013, symmetry:12, sides:4, density:1.1, size:.075, drift:.09, duration:48, zoom:1, rotation:0, palette:'jewel', mirrors:false});
export function random(seed) {
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function makeChamber(p) {
  const rand=random(p.seed), angle=Math.PI/p.symmetry, radius=2.6;
  const count=Math.ceil(radius*radius*angle*.5/(Math.PI*p.size*p.size)*p.density*1.7);
  return Array.from({length:count},()=>{
    // Uniform area distribution, including a margin on either side of the mirrors.
    const r=radius*Math.sqrt(rand()), a=(rand()*1.3-.15)*angle;
    return {x:r*Math.cos(a),y:r*Math.sin(a),dx:(.35+.65*rand())*p.drift,dy:(.35+.65*rand())*p.drift,
      phase:rand()*TAU, orientation:rand()*TAU, radius:p.size*(.6+.65*rand()), color:rand(), saturation:.55+.4*rand()};
  });
}
// Cache only immutable local geometry. Motion always comes from the supplied phase.
const polygonBases = new Map();
export function polygonAt(g,p,phase) {
  let basis=polygonBases.get(p.sides);
  if(!basis){basis=rotationSequence(p.sides,0,TAU/p.sides);polygonBases.set(p.sides,basis);}
  const t=TAU*phase, x=g.x+g.dx*Math.cos(t+g.phase), y=g.y+g.dy*Math.sin(t+g.phase);
  // 2π/sides returns the same unlabelled regular polygon after one loop.
  const angle=g.orientation+t/p.sides,c=Math.cos(angle),s=Math.sin(angle);
  return Array.from({length:p.sides},(_,i)=>[
    x+g.radius*(c*basis[2*i]-s*basis[2*i+1]),
    y+g.radius*(s*basis[2*i]+c*basis[2*i+1]),
  ]);
}
export function clipHalfPlane(poly,nx,ny) {
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*ny,db=b[0]*nx+b[1]*ny;
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  return out;
}
export function clipWedge(poly,n) {const a=Math.PI/n;return clipHalfPlane(clipHalfPlane(poly,0,1),Math.sin(a),-Math.cos(a));}
export function reflectPoint(point,n,sector) {
  const a=TAU*Math.floor(sector/2)/n, x=point[0],y=point[1]*(sector%2?-1:1);
  return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
}
export function colorFor(g,p) {
  const h=g.color;
  if(p.palette==='ember')return `hsl(${h<.6?18+h*65:260+h*40} 85% ${48+h*22}%)`;
  if(p.palette==='lagoon')return `hsl(${155+h*115} 70% ${40+h*30}%)`;
  if(p.palette==='porcelain')return `hsl(42 22% ${55+h*40}%)`;
  return `hsl(${h*360} ${g.saturation*100}% ${48+h*18}%)`;
}
