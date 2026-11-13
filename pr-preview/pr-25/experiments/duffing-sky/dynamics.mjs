// Cosmetic controller. Fixed-step RK4, independent of rendering and wall-clock time.
export const DT=1/120, DURATION=600;
export const PRESETS={gentle:{delta:.3,alpha:-1,beta:1,gamma:.12,omega:1.2},folding:{delta:.2,alpha:-1,beta:1,gamma:.3,omega:1.2}};
export function step(x,v,t,p,h=DT){
 const f=(a,b,c)=>[b,-p.delta*b-p.alpha*a-p.beta*a*a*a+p.gamma*Math.cos(p.omega*c)];
 const a=f(x,v,t),b=f(x+a[0]*h/2,v+a[1]*h/2,t+h/2),c=f(x+b[0]*h/2,v+b[1]*h/2,t+h/2),d=f(x+c[0]*h,v+c[1]*h,t+h);
 const out=[x+h*(a[0]+2*b[0]+2*c[0]+d[0])/6,v+h*(a[1]+2*b[1]+2*c[1]+d[1])/6];
 if(!out.every(Number.isFinite)||Math.abs(out[0])>10||Math.abs(out[1])>20)throw Error('Controller exceeded safe bounds');return out;
}
export function timeline(p,seed=98){const n=Math.round(DURATION/DT),data=new Float32Array((n+1)*3);let x=.15+(seed%997)/997*.01,v=0,sx=x,sv=v,energy=0;
 // Warm up 100 oscillator seconds before recording, avoiding startup collapse.
 for(let i=-12000;i<=n;i++){if(i>=0){data[i*3]=sx;data[i*3+1]=sv;data[i*3+2]=energy;}[x,v]=step(x,v,i*DT,p);const k=1-Math.exp(-DT/2.5);sx+=k*(x-sx);sv+=k*(v-sv);energy+=k*(x*x*.4+v*v*.3-energy);}
 return data;
}
export function sample(data,t){const u=Math.max(0,Math.min(DURATION,t))/DT,i=Math.min(Math.floor(u),data.length/3-2),a=u-i;return [0,1,2].map(j=>data[i*3+j]*(1-a)+data[(i+1)*3+j]*a);}
