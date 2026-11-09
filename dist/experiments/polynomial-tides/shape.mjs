// Geometry descriptors for *sampled* 2D quadratic-map trajectories.
// These are ranking heuristics, not guarantees of rotational invariance,
// chaoticity, or visual quality. No display-only deformation is included.
import {decodeSeed} from './core.mjs';

const TAU=2*Math.PI,ANGLES=96,RADII=8;
const clamp=x=>Math.max(0,Math.min(1,x));

export function coefficientResidual(seed){
  const a=decodeSeed(seed);
  // Zero iff the linear part at the origin is [[p,-q],[q,p]].
  // Useful as a research diagnostic; not assumed necessary for a round attractor.
  return Math.hypot(a[1]-a[10],a[4]+a[7]);
}

export function shapeMetrics(points,{limit=6000}={}){
  if(!points||points.length%2||points.length<64)throw new RangeError('Expected at least 32 (x,y) points');
  const count=points.length/2,step=Math.max(1,Math.ceil(count/limit));
  let n=0,mx=0,my=0;
  for(let i=0;i<count;i+=step){mx+=points[2*i];my+=points[2*i+1];n++;}
  mx/=n;my/=n;
  let xx=0,yy=0,xy=0,meanR=0,meanR2=0,maxR=0;
  for(let i=0;i<count;i+=step){
    const x=points[2*i]-mx,y=points[2*i+1]-my,r=Math.hypot(x,y);
    if(!Number.isFinite(r))throw new RangeError('Non-finite orbit');
    xx+=x*x;yy+=y*y;xy+=x*y;
    meanR+=r;meanR2+=r*r;maxR=Math.max(maxR,r);
  }
  xx/=n;yy/=n;xy/=n;meanR/=n;meanR2/=n;
  if(maxR<1e-9||meanR<1e-9){
    return {isotropy:0,radial:0,radialCV:Infinity,symmetry:0,order:null,angularModulation:0,roundness:0};
  }
  const d=Math.hypot(xx-yy,2*xy),tr=xx+yy;
  const isotropy=clamp((tr-d)/Math.max(tr+d,1e-20));
  const radialCV=Math.sqrt(Math.max(0,meanR2-meanR*meanR))/meanR;
  const radial=Math.exp(-3*radialCV);

  // Polar histogram retains both angle and radius. Unlike a raw covariance
  // score, it distinguishes 3-fold and 4-fold forms from generic ellipses.
  const hist=new Float64Array(ANGLES*RADII);
  for(let i=0;i<count;i+=step){
    const x=points[2*i]-mx,y=points[2*i+1]-my;
    const r=Math.hypot(x,y);
    const radius=Math.min(RADII-1,Math.floor((r/maxR)*RADII));
    const angle=(Math.atan2(y,x)+TAU)%TAU;
    hist[radius*ANGLES+Math.floor(angle/TAU*ANGLES)%ANGLES]++;
  }
  // Circular blur reduces finite-sample angular bin noise without inventing
  // new orbit geometry. The same kernel is used for every candidate.
  const blur=new Float64Array(hist.length),angular=new Float64Array(ANGLES);
  let total=0,angularSumSq=0;
  for(let ring=0;ring<RADII;ring++){
    const base=ring*ANGLES;
    for(let a=0;a<ANGLES;a++){
      const v=(hist[base+(a+ANGLES-2)%ANGLES]+
        2*hist[base+(a+ANGLES-1)%ANGLES]+
        3*hist[base+a]+
        2*hist[base+(a+1)%ANGLES]+
        hist[base+(a+2)%ANGLES])/9;
      blur[base+a]=v;angular[a]+=v;total+=v;
    }
  }
  const avg=total/ANGLES;
  for(const v of angular)angularSumSq+=(v-avg)**2;
  const angularModulation=Math.sqrt(angularSumSq/ANGLES)/Math.max(avg,1e-9);

  let norm=0;
  for(const v of blur)norm+=v*v;
  let symmetry=0,order=2;
  const perOrder={};
  for(let m=2;m<=8;m++){
    const delta=ANGLES/m,shift=Math.floor(delta),fraction=delta-shift;
    let dot=0;
    for(let ring=0;ring<RADII;ring++){
      const base=ring*ANGLES;
      for(let a=0;a<ANGLES;a++){
        const j=(a+shift)%ANGLES,k=(j+1)%ANGLES;
        const rotated=blur[base+j]*(1-fraction)+blur[base+k]*fraction;
        dot+=blur[base+a]*rotated;
      }
    }
    // Shift preserves L2 norm for integral offsets; interpolation produces
    // a mild optimistic bias for fractional offsets, acceptable for ranking.
    const similarity=clamp(dot/Math.max(norm,1e-20));
    perOrder[m]=similarity;
    if(similarity>symmetry+1e-12){symmetry=similarity;order=m;}
  }
  // Uniform annuli are approximately symmetric at every rotation. Avoid
  // claiming a specific rotational order from sampling noise alone.
  if(radial>.80&&angularModulation<.17)order=null;
  return {isotropy,radial,radialCV,symmetry,order,
    angularModulation,roundness:isotropy*radial,perOrder};
}

export function scoreShape(metrics,mode='ring'){
  if(mode==='ring')return .50*metrics.isotropy+.43*metrics.radial+.07*metrics.symmetry;
  if(mode==='symmetry')return .18*metrics.isotropy+.12*metrics.radial+.70*metrics.symmetry;
  if(mode==='balanced')return .33*metrics.isotropy+.27*metrics.radial+.40*metrics.symmetry;
  throw new RangeError('Unknown shape objective: '+mode);
}

export function rankCandidates(candidates,mode='ring',keep=8){
  return [...candidates].sort((a,b)=>scoreShape(b.metrics,mode)-scoreShape(a.metrics,mode)
    ||a.seed.localeCompare(b.seed)).slice(0,keep);
}
