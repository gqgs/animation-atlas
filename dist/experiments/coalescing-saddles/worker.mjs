import {halfTable,blendField,resample,phaseZeros,TAU} from './math.mjs';
let meta,data,table,field;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
async function load(){
  const m=await fetch(new URL('field.json',import.meta.url));if(!m.ok)throw Error(`Metadata: ${m.status}`);meta=await m.json();
  const expected=meta.width*meta.height*meta.frames*4,bytes=new Uint8Array(expected);let offset=0;
  for(const name of meta.chunks){
    const r=await fetch(new URL(name,import.meta.url));if(!r.ok)throw Error(`Field: ${r.status}`);
    if(r.body){const reader=r.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;if(offset+value.length>expected)throw Error('Field length mismatch');bytes.set(value,offset);offset+=value.length;postMessage({type:'progress',loaded:offset,total:expected});}}
    else{const raw=new Uint8Array(await r.arrayBuffer());if(offset+raw.length>expected)throw Error('Field length mismatch');bytes.set(raw,offset);offset+=raw.length;}
  }
  if(offset!==expected)throw Error('Incomplete numerical field; retry loading.');
  data=new Uint16Array(bytes.buffer);table=halfTable();field=new Float32Array(meta.width*meta.height*2);
  for(const h of data)if(!Number.isFinite(table[h]))throw Error('Non-finite field sample');
  postMessage({type:'ready',meta});
}
function render(s){
  blendField(data,table,meta,s.z,field);
  const n=s.size, f=resample(field,meta.width,n),rgba=new Uint8ClampedArray(n*n*4);
  for(let j=0;j<n*n;j++){
    const re=f[2*j],im=f[2*j+1],a2=re*re+im*im,phi=Math.atan2(im,re);
    let r,g,b;
    if(s.view==='intensity'){
      const v=1-Math.exp(-.6*s.exposure*a2);
      // Black -> indigo -> copper -> cream, fixed exposure across all frames.
      r=clamp(1.6*v);g=clamp(1.7*v-.5);b=clamp(.12+1.4*v-1.2*v*v);
      const w=smooth(.6,1,v);r=r*(1-w)+w;g=g*(1-w)+.97*w;b=b*(1-w)+.85*w;
    }else{
      const h=(phi/TAU+.5)*6,c=.86,x=c*(1-Math.abs(h%2-1));
      const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
      const brightness=s.view==='luminous'?.08+.92*(1-Math.exp(-s.exposure*a2)):.95;
      r=(rgb[0]+.1)*brightness;g=(rgb[1]+.1)*brightness;b=(rgb[2]+.1)*brightness;
    }
    if(s.contours&&j%n<n-1&&j<n*(n-1)){
      const px=Math.atan2(f[2*j+3],f[2*j+2]),py=Math.atan2(f[2*(j+n)+1],f[2*(j+n)]);
      const wrap=d=>Math.atan2(Math.sin(d),Math.cos(d));
      const grad=Math.hypot(wrap(px-phi),wrap(py-phi));
      const d=Math.abs(Math.sin(4*phi))/4;
      const line=(1-smooth(.25,.9,d/Math.max(.002,grad)))*.6;
      r=r*(1-line)+line;g=g*(1-line)+line;b=b*(1-line)+line;
    }
    const k=j*4;rgba[k]=255*r;rgba[k+1]=255*g;rgba[k+2]=255*b;rgba[k+3]=255;
  }
  const zeros=s.zeros&&Math.abs(s.z)>.015?phaseZeros(field,meta.width):[];
  postMessage({type:'frame',buffer:rgba.buffer,z:s.z,size:n,zeros,view:s.view},[rgba.buffer]);
}
onmessage=e=>{
  if(e.data.type==='load')load().catch(error=>postMessage({type:'error',message:error.message}));
  if(e.data.type==='render'&&data)render(e.data.state);
};
