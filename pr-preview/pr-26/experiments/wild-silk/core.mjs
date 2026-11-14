// General 2D map: Antonio Sánchez / Paul Bourke. No singularity clamping.
export const presets = [
  ['Filigree · Atlas',[-.811,.425,-1.136,.505,-.531,-.021,-.585,.736,.964,-.233,-.673,-.392,-1.204,-.435]],
  ['Veil · Atlas',[-.771,.342,-1.145,.479,-.533,-.052,-.575,.848,.912,-.286,-.712,-.266,-1.236,-.277]],
];
export function encode(a){
  if(a.length!==14||a.some(v=>!Number.isFinite(v)||Math.abs(v)>2))throw Error('Expected 14 coefficients between −2 and 2');
  return 'WS1.'+a.map(v=>(Math.round(v*1000)+2000).toString(36).padStart(3,'0')).join('');
}
export function decode(code){
  if(!/^WS1\.[0-9a-z]{42}$/.test(code))throw Error('Use a WS1 seed (46 characters)');
  const a=code.slice(4).match(/.{3}/g).map(s=>(parseInt(s,36)-2000)/1000);
  if(a.some(v=>Math.abs(v)>2))throw Error('Coefficient out of range');
  return a;
}
export function step(x,y,a){
  return [a[0]+a[1]*x+a[2]*y+a[3]*Math.abs(x)**a[4]+a[5]*Math.abs(y)**a[6],
    a[7]+a[8]*x+a[9]*y+a[10]*Math.abs(x)**a[11]+a[12]*Math.abs(y)**a[13]];
}
const derivative=(x,p)=>p===0?0:p*Math.sign(x)*Math.abs(x)**(p-1);
export function jacobian(x,y,a){return [
  a[1]+a[3]*derivative(x,a[4]),a[2]+a[5]*derivative(y,a[6]),
  a[8]+a[10]*derivative(x,a[11]),a[9]+a[12]*derivative(y,a[13])];}
export function sample(a,count=180000,burn=1800,initialX=.05){
  const points=new Float64Array(count*2);
  let x=initialX,y=.05,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=-burn;i<count;i++){
    [x,y]=step(x,y,a);
    if(!Number.isFinite(x+y)||Math.max(Math.abs(x),Math.abs(y))>1000)throw Error('Orbit escapes or meets a singularity');
    if(i>=0){points[2*i]=x;points[2*i+1]=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  }
  if(Math.min(maxX-minX,maxY-minY)<1e-7)throw Error('Orbit collapses');
  // Robust framing is display-only: preserve every sample and full bounds.
  const xs=[],ys=[];
  for(let i=0;i<count;i+=Math.max(1,Math.floor(count/12000))){xs.push(points[2*i]);ys.push(points[2*i+1]);}
  xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
  const lo=Math.floor(xs.length*.01),hi=Math.min(xs.length-1,Math.floor(xs.length*.99));
  const coreBounds={minX:xs[lo],maxX:xs[hi],minY:ys[lo],maxY:ys[hi]};
  return {points,count,bounds:{minX,maxX,minY,maxY},coreBounds};
}
export function inspect(a,count=7000){
  let orbit;try{orbit=sample(a,count,1200);}catch{return {accepted:false};}
  let x=.05,y=.05,tx=1,ty=0,logs=0,n=0;
  for(let i=0;i<count+1200;i++){
    const [j00,j01,j10,j11]=jacobian(x,y,a),u=j00*tx+j01*ty,v=j10*tx+j11*ty,len=Math.hypot(u,v);
    if(!Number.isFinite(len))return {accepted:false};
    if(len>1e-200){tx=u/len;ty=v/len;}else{tx=1;ty=0;}
    if(i>=1200){logs+=Math.log(Math.max(len,1e-200));n++;}
    [x,y]=step(x,y,a);
  }
  const {points,bounds:b}=orbit,w=b.maxX-b.minX,h=b.maxY-b.minY,span=Math.max(w,h),cx=(b.maxX+b.minX)/2,cy=(b.maxY+b.minY)/2;
  const grid=new Uint32Array(32*32);let sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for(let i=0;i<count;i++){
    const px=(points[2*i]-cx)/span,py=(points[2*i+1]-cy)/span;
    const ix=Math.max(0,Math.min(31,Math.floor((px+.5)*32))),iy=Math.max(0,Math.min(31,Math.floor((py+.5)*32)));
    grid[iy*32+ix]++;sx+=px;sy+=py;sxx+=px*px;syy+=py*py;sxy+=px*py;
  }
  const vx=sxx/count-(sx/count)**2,vy=syy/count-(sy/count)**2,cov=sxy/count-sx*sy/count**2;
  const trace=vx+vy,delta=Math.sqrt((vx-vy)**2+4*cov*cov);
  const roundness=(trace-delta)/Math.max(1e-12,trace+delta);
  let occupancy=0,difference=0,total=0;
  for(let i=0;i<grid.length;i++){
    if(grid[i])occupancy++;
    const p=Math.sqrt(grid[i]),q=Math.sqrt(grid[1023-i]);difference+=Math.abs(p-q);total+=p+q;
  }
  const balance=1-difference/Math.max(1,total),lambda=logs/n;
  return {accepted:lambda>.008&&occupancy>=70&&Math.min(w,h)>.02,lambda,occupancy,roundness,balance};
}
export function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function candidate(random,base,mode){
  const a=Array.from({length:14},(_,i)=>mode==='nearby'&&random()<.93
    ? Math.max(-2,Math.min(2,base[i]+(random()+random()-1)*.16)):(random()*3-1.5));
  return decode(encode(a));
}
export function score(m,target){
  if(target==='round')return .65*m.roundness+.35*m.balance;
  if(target==='wild')return .6*(1-m.roundness)+.4*Math.min(1,m.occupancy/400);
  return Math.min(1,m.occupancy/400)*.6+Math.min(1,m.lambda)*.4;
}
