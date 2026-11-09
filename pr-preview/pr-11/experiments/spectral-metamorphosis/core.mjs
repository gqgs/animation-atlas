// Scalar stationary Gaussian textures on a periodic discrete torus.
export function random(seed) { let s=seed>>>0; return ()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }
export function fft(re,im,inverse=false){
 const n=re.length; for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const a=(inverse?2:-2)*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const p=i+j,q=p+len/2,vr=re[q]*ur-im[q]*ui,vi=re[q]*ui+im[q]*ur;re[q]=re[p]-vr;im[q]=im[p]-vi;re[p]+=vr;im[p]+=vi;const t=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=t;}}}
 if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
export function inverse2D(re,im,n){const r=new Float64Array(n),v=new Float64Array(n);for(let y=0;y<n;y++){r.set(re.subarray(y*n,(y+1)*n));v.set(im.subarray(y*n,(y+1)*n));fft(r,v,true);re.set(r,y*n);im.set(v,y*n);}for(let x=0;x<n;x++){for(let y=0;y<n;y++){r[y]=re[y*n+x];v[y]=im[y*n+x];}fft(r,v,true);for(let y=0;y<n;y++){re[y*n+x]=r[y];im[y*n+x]=v[y];}}}
export class SpectralField {
 constructor(n=256,seed=16031){this.n=n;this.seed=seed;const size=n*n;this.a=new Float64Array(size);this.b=new Float64Array(size);this.re=new Float64Array(size);this.im=new Float64Array(size);this.modes=[];const rng=random(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng());for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,j=((n-y)%n)*n+(n-x)%n;if(i>=j||x===n/2||y===n/2)continue;const kx=x>n/2?x-n:x,ky=y>n/2?y-n:y;this.modes.push({i,j,kx,ky,r:normal(),s:normal(),r2:normal(),s2:normal(),w:normal(),p:rng()*Math.PI*2});}this.spectra(.9,25,1);}
 spectra(anisotropy,angle,scale){const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180),n=this.n;this.a.fill(0);this.b.fill(0);let ea=0,eb=0;for(const m of this.modes){const {kx,ky,i,j}=m;const across=(kx*c+ky*s)/scale,along=(-kx*s+ky*c)/scale,r=Math.hypot(kx,ky)/scale;const width=2+(1-anisotropy)*14;
 // Long filaments perpendicular to the concentrated wave-vector lobes.
 const pa=Math.exp(-.5*((Math.abs(across)-19)/4.8)**2-.5*(along/width)**2)+.08*Math.exp(-.5*(across/7)**2-.5*(along/(width*.65))**2);
 const pb=(1-Math.exp(-r*r/6))/(1+(r/8)**4)*Math.exp(-((r/65)**8));
 const va=Math.sqrt(pa),vb=Math.sqrt(pb);this.a[i]=this.a[j]=va;this.b[i]=this.b[j]=vb;ea+=2*pa;eb+=2*pb;}
 // E|inverseFFT(H Z)|² = 1 at each endpoint (E|Z|² = 2).
 const na=n*n/Math.sqrt(2*ea),nb=n*n/Math.sqrt(2*eb);for(let i=0;i<n*n;i++){this.a[i]*=na;this.b[i]*=nb;}
 }
 synth(mix,time,coherence=0.85,phase=0.65,independent=false){const {re,im,a,b,n}=this;re.fill(0);im.fill(0);for(const m of this.modes){const {i,j,kx,ky}=m;const theta=.024*time*(kx*.7+ky*.23)+phase*(.12+2*(1-coherence))*(Math.sin(time*(.06+(1-coherence)*.5)*m.w+m.p)-Math.sin(m.p));const c=Math.cos(theta),s=Math.sin(theta),ar=m.r*c-m.s*s,ai=m.r*s+m.s*c;
 if(independent){const br=m.r2*c-m.s2*s,bi=m.r2*s+m.s2*c;re[i]=(1-mix)*a[i]*ar+mix*b[i]*br;im[i]=(1-mix)*a[i]*ai+mix*b[i]*bi;}else{const h=(1-mix)*a[i]+mix*b[i];re[i]=h*ar;im[i]=h*ai;}re[j]=re[i];im[j]=-im[i];}
 inverse2D(re,im,n);return re;
 }
 power(mix,independent=false){return Float64Array.from(this.a,(a,i)=>independent?(1-mix)**2*a*a+mix*mix*this.b[i]**2:((1-mix)*a+mix*this.b[i])**2);}
}
