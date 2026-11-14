export const defaults = {motion:'orbit',duration:120,radius:0.42,cx:0,cy:0,fx:2,fy:3,offset:0.25,zoom:1.5,density:0.65,bands:5,pattern:0,palette:0,rotation:0};
export function poleAt(p,phase){
 const t=2*Math.PI*phase;
 const x=p.motion==='still'?0:p.radius*Math.cos(t*(p.motion==='lissajous'?p.fx:1));
 const y=p.motion==='still'?0:p.radius*Math.sin(p.motion==='lissajous'?t*p.fy+2*Math.PI*p.offset:t);
 // Uniform scaling keeps the entire orbit inside the disk without clipping its path.
 const extent=Math.hypot(p.cx,p.cy)+p.radius*(p.motion==='lissajous'?Math.SQRT2:p.motion==='still'?0:1);
 const scale=Math.min(1,.96/Math.max(extent,1e-9));
 return [(p.cx+x)*scale,(p.cy+y)*scale];
}
export function pullback(z,p){
 const d=[z[0]-p[0],z[1]-p[1]],n=[1-p[0]*z[0]-p[1]*z[1],-p[0]*z[1]+p[1]*z[0]],r=d[0]**2+d[1]**2;
 if(r===0)return null;
 return [1+2*(n[0]*d[0]+n[1]*d[1])/r,2*(n[1]*d[0]-n[0]*d[1])/r];
}
export function validateState(s){
 if(!s||s.study!=='mobius-drift'||s.version!==1||!s.parameters)throw Error('Not a Möbius Drift state');
 const p=s.parameters;
 const limits={duration:[20,300],radius:[0,.8],cx:[-.65,.65],cy:[-.65,.65],fx:[1,5],fy:[1,5],offset:[0,1],zoom:[.5,3],density:[.15,2],bands:[1,12],pattern:[0,2],palette:[0,2],rotation:[0,360]};
 if(!['orbit','lissajous','still'].includes(p.motion))throw Error('Invalid motion');
 for(const [k,[lo,hi]] of Object.entries(limits))if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Invalid '+k);
 for(const k of ['fx','fy','bands','pattern','palette'])if(!Number.isInteger(p[k]))throw Error('Invalid '+k);
 if(!Number.isFinite(s.phase)||s.phase<0||s.phase>1)throw Error('Invalid phase');
 return {parameters:Object.fromEntries(Object.keys(defaults).map(k=>[k,p[k]])),phase:s.phase};
}
