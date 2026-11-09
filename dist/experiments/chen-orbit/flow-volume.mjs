import {buildAttractor} from './core.mjs';
import {buildSurface} from './surface.mjs';
export const volumeBounds=[[-1.55,1.55],[-1.05,1.05],[-.6,.6]];
export const volumeGrid=[112,80,48];
// An isotropic Gaussian neighbourhood of the integrated trajectory. The skin
// is a numerical density level set, not a claimed smooth invariant manifold.
export function buildDensity({grid=volumeGrid,bandwidth=.025,amplitude=0}={}){
 const [nx,ny,nz]=grid,[sx,sy,sz]=grid.map(n=>n+1),count=sx*sy*sz,bounds=volumeBounds;
 const spacing=bounds.map(([a,b],i)=>(b-a)/grid[i]);let field=new Float32Array(count),moment=new Float32Array(count);
 const {data}=buildAttractor({amplitude});
 for(let n=0;n<data.length;n+=4){
  const previous=Math.max(0,n-4),speed=Math.hypot(data[n]-data[previous],data[n+1]-data[previous+1],data[n+2]-data[previous+2])/.002;
  const p=bounds.map(([a],i)=>(data[n+i]-a)/spacing[i]),lo=p.map(Math.floor),f=p.map((x,i)=>x-lo[i]);
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const ix=lo[0]+x,iy=lo[1]+y,iz=lo[2]+z;if(ix<0||ix>nx||iy<0||iy>ny||iz<0||iz>nz)continue;const id=ix+sx*(iy+sy*iz),w=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);field[id]+=w;moment[id]+=w*speed;}
 }
 for(let axis=0;axis<3;axis++){
  const sigma=bandwidth/spacing[axis],radius=Math.ceil(3*sigma),kernel=[];let sum=0;
  for(let i=-radius;i<=radius;i++){const w=Math.exp(-.5*(i/sigma)**2);kernel.push(w);sum+=w;}for(let i=0;i<kernel.length;i++)kernel[i]/=sum;
  const next=new Float32Array(count),nextMoment=new Float32Array(count),stride=[1,sx,sx*sy][axis],size=[sx,sy,sz][axis];
  for(let z=0;z<sz;z++)for(let y=0;y<sy;y++)for(let x=0;x<sx;x++){const id=x+sx*(y+sy*z),coord=[x,y,z][axis];let value=0,speed=0;for(let k=-radius;k<=radius;k++){const q=coord+k;if(q>=0&&q<size){value+=field[id+k*stride]*kernel[k+radius];speed+=moment[id+k*stride]*kernel[k+radius];}}next[id]=value;nextMoment[id]=speed;}field=next;moment=nextMoment;
 }
 let max=0;for(const value of field)max=Math.max(max,value);
 function sample(x,y,z,values=field){const p=[x,y,z].map((v,i)=>(v-bounds[i][0])/spacing[i]);if(p.some((v,i)=>v<0||v>grid[i]))return 0;const lo=p.map(Math.floor);
  for(let i=0;i<3;i++)lo[i]=Math.min(Math.floor(p[i]),grid[i]-1);
  const f=p.map((v,i)=>v-lo[i]);let result=0;
  for(let iz=0;iz<2;iz++)for(let iy=0;iy<2;iy++)for(let ix=0;ix<2;ix++)result+=values[lo[0]+ix+sx*(lo[1]+iy+sy*(lo[2]+iz))]*(ix?f[0]:1-f[0])*(iy?f[1]:1-f[1])*(iz?f[2]:1-f[2]);return result;
 }
 return {field,grid,dimensions:[sx,sy,sz],bounds,spacing,bandwidth,max,sample,speed:(x,y,z)=>sample(x,y,z,moment)/Math.max(.00001,sample(x,y,z))};
}
const densityCache=new Map();
export function buildFlowVolume({isovalue=1.5,bandwidth=.025,amplitude=0}={}){
 const key=`${bandwidth}:${amplitude}`;
 const density=densityCache.get(key)||buildDensity({bandwidth,amplitude});densityCache.set(key,density);
 const [nx,ny,nz]=density.grid,mesh=buildSurface({nx,ny,nz,bounds:density.bounds,distance:(x,y,z)=>isovalue-density.sample(x,y,z)});
 const texture=new Uint8Array(density.field.length),scale=Math.log1p(density.max);
 for(let i=0;i<texture.length;i++)texture[i]=Math.round(255*Math.log1p(density.field[i])/scale);
 const speeds=new Float32Array(mesh.positions.length/3);for(let i=0;i<speeds.length;i++)speeds[i]=Math.min(1,density.speed(...mesh.positions.subarray(i*3,i*3+3))/18);
 return {...mesh,speeds,density,texture,isovalue,threshold:Math.log1p(isovalue)/scale};
}
