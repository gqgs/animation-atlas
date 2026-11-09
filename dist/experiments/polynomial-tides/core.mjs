// J. C. Sprott's 1993 quadratic maps. A..Y encode coefficients -1.2..1.2.
export const references = [
  'GLXOESFTTPSV','MCRBIPOPHTBN','VBWNBDELYHUL','FIRCDERRPVLD',
  'QFFVSLMJJCCR','LUFBBFISGJYS','EJYDREGLYQPV','HIYIWHOKNVCG',
  'MSSSRRPADDSO','OIHVGHAHGYRK','RALLTIOBDULT','WJJFXGXHTRPG',
];
export function decodeSeed(text) {
  const seed=String(text).trim().toUpperCase();
  if(!/^[A-Y]{12}$/.test(seed)) throw new RangeError('Seed must be exactly 12 letters from A to Y (no Z).');
  return Array.from(seed,c=>(c.charCodeAt(0)-77)/10);
}
export function step(x,y,a) {
  const xx=x*x, xy=x*y, yy=y*y;
  return [
    a[0]+a[1]*x+a[2]*xx+a[3]*xy+a[4]*y+a[5]*yy,
    a[6]+a[7]*x+a[8]*xx+a[9]*xy+a[10]*y+a[11]*yy,
  ];
}
function escaped(x,y,limit=100) {
  return !Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>limit||Math.abs(y)>limit;
}
export function inspectSeed(seed,{steps=3200,burn=500}={}) {
  if(steps<=burn||burn<0) throw new RangeError('Invalid sampling window');
  const a=decodeSeed(seed),points=new Float64Array((steps-burn)*2);
  let x=.05,y=.05,tx=1,ty=0,logExpansion=0,samples=0;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let n=0;n<steps;n++){
    const [nx,ny]=step(x,y,a);
    if(escaped(nx,ny))return {accepted:false,reason:'Diverges',lambda:null,occupancy:0};
    // Largest finite-time Lyapunov exponent from the analytic Jacobian.
    const u=(a[1]+2*a[2]*x+a[3]*y)*tx+(a[3]*x+a[4]+2*a[5]*y)*ty;
    const v=(a[7]+2*a[8]*x+a[9]*y)*tx+(a[9]*x+a[10]+2*a[11]*y)*ty;
    const len=Math.hypot(u,v);
    if(len>1e-250&&Number.isFinite(len)){
      if(n>=burn)logExpansion+=Math.log(len);
      tx=u/len;ty=v/len;
    }else{tx=1;ty=0;if(n>=burn)logExpansion+=Math.log(1e-250);}
    x=nx;y=ny;
    if(n>=burn){
      points[2*samples]=x;points[2*samples+1]=y;samples++;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
  }
  const width=maxX-minX,height=maxY-minY,lambda=logExpansion/samples;
  if(width<.12||height<.12)return {accepted:false,reason:'Collapsed to a point or line',lambda,occupancy:0};
  // Occupancy rejects simple cycles that can have a misleading transient exponent.
  const grid=new Uint8Array(24*24);let occupancy=0;
  for(let i=0;i<samples;i++){
    const ix=Math.min(23,Math.floor(24*(points[2*i]-minX)/width));
    const iy=Math.min(23,Math.floor(24*(points[2*i+1]-minY)/height));
    const idx=iy*24+ix;if(!grid[idx]){grid[idx]=1;occupancy++;}
  }
  const accepted=lambda>.012&&occupancy>=65&&width<25&&height<25;
  return {accepted,reason:accepted?'Promising candidate':'Periodic, insufficiently varied, or weak stretching',
    lambda,occupancy,width,height};
}
export function buildOrbit(seed,count=52000,burn=1500){
  const a=decodeSeed(seed),points=new Float32Array(count*2),stretch=new Float32Array(count);
  let x=.05,y=.05,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let n=0;n<count+burn;n++){
    const [nx,ny]=step(x,y,a);
    if(escaped(nx,ny))throw new RangeError('This trajectory diverges; choose another seed.');
    x=nx;y=ny;
    if(n>=burn){
      const j=n-burn,i=j*2;
      points[i]=x;points[i+1]=y;
      // Frobenius norm of the Jacobian is a proxy for local stretching.
      const j00=a[1]+2*a[2]*x+a[3]*y,j01=a[3]*x+a[4]+2*a[5]*y;
      const j10=a[7]+2*a[8]*x+a[9]*y,j11=a[9]*x+a[10]+2*a[11]*y;
      stretch[j]=Math.log1p(Math.hypot(j00,j01,j10,j11));
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
  }
  return {seed,points,stretch,count,bounds:{minX,minY,maxX,maxY}};
}
// Draw unbiased A..Y selections, avoiding collisions with the example list.
export function randomSeed(){
  let out='';
  while(out.length<12){
    const bytes=new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for(const byte of bytes){
      if(byte<250){out+=String.fromCharCode(65+byte%25);if(out.length===12)break;}
    }
  }
  return out;
}
