import {returnMap,LAMBDA} from './math.mjs';
self.onmessage=({data:d})=>{const {w,h,cx,cy,span,n,mode,depth}=d;const data=new Uint8ClampedArray(w*h*4);const vals=new Float64Array(w*h);const mags=new Float64Array(w*h);const scale=mode==='puzzles'?LAMBDA**depth:1;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const z=[(cx+(x/w-.5)*span)/scale,(cy+(.5-y/h)*span*h/w)/scale];const q=returnMap(z,n);vals[i]=q?Math.atan2(q[1],q[0]):NaN;mags[i]=q?Math.log1p(Math.hypot(...q)):NaN}
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=i*4,a=vals[i],m=mags[i];let r=6,g=10,b=19;if(Number.isFinite(a)){
 const t=(Math.sin(a)+1)/2;const contour=.5+.5*Math.cos(m*5);r=18+20*t+8*contour;g=30+40*t+10*contour;b=51+33*(1-t)+15*contour;
 if(mode==='phase'){const hue=(a/(2*Math.PI)+1)%1;const c=hue*6,k=Math.floor(c),f=c-k;const rgb=[[1,f,0],[1-f,1,0],[0,1,f],[0,1-f,1],[f,0,1],[1,0,1-f]][k%6];[r,g,b]=rgb.map(v=>20+v*(125+45*contour))}
 else {const right=x+1<w?vals[i+1]:a,down=y+1<h?vals[i+w]:a;const edge=(Number.isFinite(right)&&Math.sin(a)*Math.sin(right)<0)||(Number.isFinite(down)&&Math.sin(a)*Math.sin(down)<0);if(edge){const positive=Math.cos(a)>0;[r,g,b]=positive?[106,239,220]:[255,177,109]}}
 }data[j]=r;data[j+1]=g;data[j+2]=b;data[j+3]=255}
if(mode==='puzzles')for(let level=0;level<depth;level++){
 const factor=LAMBDA**level,phase=new Float64Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=returnMap([(cx+(x/w-.5)*span)/factor,(cy+(.5-y/h)*span*h/w)/factor],n);phase[y*w+x]=q?Math.atan2(q[1],q[0]):NaN}
 for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){const i=y*w+x,a=phase[i];if(!Number.isFinite(a))continue;const edge=(Number.isFinite(phase[i+1])&&Math.sin(a)*Math.sin(phase[i+1])<0)||(Number.isFinite(phase[i+w])&&Math.sin(a)*Math.sin(phase[i+w])<0);if(edge){const colors=[[129,153,185],[178,151,226],[237,172,112]];data.set([...colors[level],255],i*4)}}
}
self.postMessage({id:d.id,w,h,data},[data.buffer]);};
