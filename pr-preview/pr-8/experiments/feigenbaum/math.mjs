// Quadratic family conjugate to z²+c: P(x)=1-a*x², a=-c_Feig.
export const A=1.4011551890920506;
export const LAMBDA=0.3995352805231345;
export function quadratic([x,y]){return [1-A*(x*x-y*y),-2*A*x*y]}
const scales=new Map();
export function criticalReturn(n){if(scales.has(n))return scales.get(n);let x=0;for(let k=0;k<2**n;k++)x=1-A*(x*x);scales.set(n,x);return x}
export function returnMap(z,n=5){const s=criticalReturn(n);let x=z[0]*s,y=z[1]*s;for(let k=0;k<2**n;k++){const xx=1-A*(x*x-y*y);y=-2*A*x*y;x=xx;if(!Number.isFinite(x+y)||Math.hypot(x,y)>1e12)return null}return [x/s,y/s]}
export function orbit(z,n,basin=false,count=28){const points=[z];for(let k=0;k<count;k++){const p=points.at(-1);const q=returnMap(basin?p.map(v=>v*LAMBDA):p,n);if(!q||Math.hypot(...q)>50)break;points.push(q)}return points}
export function fixedZero(n=5){let lo=.7,hi=.9;for(let i=0;i<50;i++){const mid=(lo+hi)/2;returnMap([mid,0],n)[0]>0?lo=mid:hi=mid}return (lo+hi)/2}
