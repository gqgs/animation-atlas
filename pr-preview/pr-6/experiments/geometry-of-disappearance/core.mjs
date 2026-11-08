// Discrete entropy-transport, KL marginal penalties, and cone interpolation.
export const EPSILON = 0.035;
export function distributions(kind='corona', n=144, targetMass=1) {
  if(kind==='atoms') return [[{x:-.58,y:0,m:1}],[{x:.58,y:0,m:targetMass}]];
  const a=[],b=[];
  for(let i=0;i<n;i++) {
    const u=(i+.5)/n, q=2*Math.PI*u;
    let x,y,X,Y;
    if(kind==='corona') {
      const r=.53+.075*Math.cos(9*q); x=r*Math.cos(q)-.22; y=r*Math.sin(q);
      const side=i<n/2?-1:1, v=(i%(n/2)+.5)/(n/2), t=(v-.5)*1.65*Math.PI;
      X=side*(.34+.24*Math.cos(t)); Y=.57*Math.sin(t);
    } else if(kind==='spiral') {
      const r=.08+.63*u; x=r*Math.cos(5*q);y=r*Math.sin(5*q);
      const arm=i%3,t=Math.floor(i/3)/(n/3-1),angle=arm*2*Math.PI/3+.4;
      X=(.13+.64*t)*Math.cos(angle+.3*Math.sin(3*Math.PI*t));
      Y=(.13+.64*t)*Math.sin(angle+.3*Math.sin(3*Math.PI*t));
    } else {
      x=-.58+.13*Math.cos(q); y=.38*Math.sin(q);
      X=.58+.13*Math.cos(q);Y=.38*Math.sin(q);
    }
    a.push({x,y,m:1/n}); b.push({x:X,y:Y,m:targetMass/n});
  }
  return [a,b];
}
function lse(values) {
  let max=-Infinity;for(const v of values)max=Math.max(max,v);
  if(!Number.isFinite(max))return -Infinity;
  let s=0;for(const v of values)s+=Math.exp(v-max);return max+Math.log(s);
}
export function solve(a,b,kappa,{epsilon=EPSILON,iterations=320}={}) {
  if(!(kappa>0&&epsilon>0))throw Error('Positive scale and regularization required');
  const n=a.length,m=b.length,edges=[],rows=Array.from({length:n},()=>[]),cols=Array.from({length:m},()=>[]);
  for(let i=0;i<n;i++)for(let j=0;j<m;j++) {
    const theta=Math.hypot(b[j].x-a[i].x,b[j].y-a[i].y)/kappa;
    if(theta>=Math.PI/2)continue;
    const c=-2*Math.log(Math.cos(theta));
    const e={i,j,theta,logK:Math.log(a[i].m*b[j].m)-c/epsilon};
    edges.push(e);rows[i].push(e);cols[j].push(e);
  }
  const u=new Float64Array(n),v=new Float64Array(m),rho=1/(1+epsilon);
  let residual=0,steps=0;
  for(let step=0;step<iterations;step++) {
    residual=0;
    for(let i=0;i<n;i++)if(rows[i].length){const next=rho*(Math.log(a[i].m)-lse(rows[i].map(e=>e.logK+v[e.j])));residual=Math.max(residual,Math.abs(next-u[i]));u[i]=next;}
    for(let j=0;j<m;j++)if(cols[j].length){const next=rho*(Math.log(b[j].m)-lse(cols[j].map(e=>e.logK+u[e.i])));residual=Math.max(residual,Math.abs(next-v[j]));v[j]=next;}
    steps=step+1;if(residual<1e-9)break;
  }
  // Reconstruct two semi-couplings. Their marginals are exactly the endpoints.
  // Normalize in log space to retain very small but finite admissible rows.
  const lr=rows.map(r=>lse(r.map(e=>e.logK+u[e.i]+v[e.j])));
  const lc=cols.map(c=>lse(c.map(e=>e.logK+u[e.i]+v[e.j])));
  const usedA=new Float64Array(n),usedB=new Float64Array(m),paths=[];
  for(const e of edges) {
    const lg=e.logK+u[e.i]+v[e.j];
    const A=a[e.i].m*Math.exp(lg-lr[e.i]),B=b[e.j].m*Math.exp(lg-lc[e.j]);
    // Discard tiny branches into explicit local reaction, never lose endpoint mass.
    if(Math.min(A,B)<1e-9)continue;
    paths.push({a:a[e.i],b:b[e.j],A,B,theta:e.theta});usedA[e.i]+=A;usedB[e.j]+=B;
  }
  for(let i=0;i<n;i++)if(a[i].m-usedA[i]>1e-14)paths.push({a:a[i],b:a[i],A:a[i].m-usedA[i],B:0,theta:0});
  for(let j=0;j<m;j++)if(b[j].m-usedB[j]>1e-14)paths.push({a:b[j],b:b[j],A:0,B:b[j].m-usedB[j],theta:0});
  const coefficients=paths.reduce((s,p)=>[s[0]+p.A,s[1]+p.B,s[2]+Math.sqrt(p.A*p.B)*Math.cos(p.theta)],[0,0,0]);
  return {paths,kappa,residual,steps,epsilon,n,m,coefficients};
}
export function interpolate(p,t,mode='hk') {
  if(mode==='reaction')throw Error('Reaction comparison uses endpoint atoms');
  if(mode==='transport')return {x:p.a.x+(p.b.x-p.a.x)*t,y:p.a.y+(p.b.y-p.a.y)*t,m:(1-t)*p.A+t*p.B};
  const r0=(1-t)*Math.sqrt(p.A),r1=t*Math.sqrt(p.B),c=Math.cos(p.theta);
  const mass=r0*r0+r1*r1+2*r0*r1*c;
  const angle=Math.atan2(r1*Math.sin(p.theta),r0+r1*c);
  const s=p.theta>1e-10?angle/p.theta:t;
  return {x:p.a.x+s*(p.b.x-p.a.x),y:p.a.y+s*(p.b.y-p.a.y),m:mass};
}
export function totalMass(plan,t){const [A,B,C]=plan.coefficients;return (1-t)**2*A+t*t*B+2*t*(1-t)*C;}
