// CPU reference for the GLSL geometry; usable without a browser.
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const scale=(a,s)=>a.map(x=>x*s);
export const norm=a=>scale(a,1/Math.sqrt(dot(a,a)));
export const centers=(s=1)=>[[0,2/Math.sqrt(3),1/Math.sqrt(6)],[-1,-1/Math.sqrt(3),1/Math.sqrt(6)],[1,-1/Math.sqrt(3),1/Math.sqrt(6)],[0,0,-3/Math.sqrt(6)]].map(c=>scale(c,s));
export function hit(o,d,c){const q=add(o,scale(c,-1)),b=dot(q,d),h=b*b-dot(q,q)+1;if(h<0)return Infinity;const t=-b-Math.sqrt(h);return t>1e-5?t:Infinity;}
export const reflect=(d,n)=>add(d,scale(n,-2*dot(d,n)));
export function trace(o,d,limit=48,s=1){const cs=centers(s);let count=0;for(;count<limit;count++){let t=Infinity,id=-1;for(let i=0;i<4;i++){const v=hit(o,d,cs[i]);if(v<t){t=v;id=i;}}if(id<0)return {count,escaped:true,d};const p=add(o,scale(d,t)),n=norm(add(p,scale(cs[id],-1)));d=reflect(d,n);o=add(p,scale(n,.00002));}return {count,escaped:false,d};}
