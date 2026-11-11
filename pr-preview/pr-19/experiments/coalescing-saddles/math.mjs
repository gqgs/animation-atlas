export const TAU = 2 * Math.PI;
export function halfTable() {
  const out = new Float32Array(65536);
  for (let h=0;h<65536;h++) {
    const sign=h&32768?-1:1, e=(h>>10)&31, f=h&1023;
    out[h]=sign*(e===0?f*2**-24:e===31?(f?NaN:Infinity):(1+f/1024)*2**(e-15));
  }
  return out;
}
export function caustic(z,theta) {
  const a=z*z/3;
  return [a*(-Math.cos(2*theta)-2*Math.cos(theta)),a*(Math.sin(2*theta)-2*Math.sin(theta))];
}
export function blendField(data,table,meta,z,out) {
  const pos=Math.min(meta.frames-1,Math.max(0,Math.abs(z)/meta.zStep));
  const j=Math.min(meta.frames-2,Math.floor(pos)),a=pos-j,stride=meta.width*meta.height*2;
  for(let k=0;k<stride;k++)out[k]=(table[data[j*stride+k]]*(1-a)+table[data[(j+1)*stride+k]]*a)*(k%2&&z<0?-1:1);
  return out;
}
const wrap=a=>a>Math.PI?a-TAU:a<=-Math.PI?a+TAU:a;
// Vortex candidates from winding, refined inside a bilinear cell using Newton.
export function phaseZeros(field,n) {
  const result=[];
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){
    const ids=[(y*n+x)*2,(y*n+x+1)*2,((y+1)*n+x+1)*2,((y+1)*n+x)*2];
    const p=ids.map(i=>Math.atan2(field[i+1],field[i]));
    const winding=p.reduce((s,a,k)=>s+wrap(p[(k+1)%4]-a),0);
    if(Math.abs(winding)<Math.PI)continue;
    let u=.5,v=.5,good=true;
    for(let j=0;j<9;j++){
      let re=0,im=0,ru=0,iu=0,rv=0,iv=0;
      for(let k=0;k<4;k++){
        const sx=k===1||k===2,sy=k>=2,wx=sx?u:1-u,wy=sy?v:1-v;
        const r=field[ids[k]],i=field[ids[k]+1];
        re+=r*wx*wy;im+=i*wx*wy;ru+=r*(sx?1:-1)*wy;iu+=i*(sx?1:-1)*wy;rv+=r*wx*(sy?1:-1);iv+=i*wx*(sy?1:-1);
      }
      const det=ru*iv-rv*iu;
      if(Math.abs(det)<1e-12){good=false;break;}
      u-=(re*iv-im*rv)/det;v-=(im*ru-re*iu)/det;
      if(!Number.isFinite(u+v)||u<-.1||u>1.1||v<-.1||v>1.1){good=false;break;}
    }
    if(good&&u>=0&&u<=1&&v>=0&&v<=1)result.push({x:x+u,y:y+v,charge:Math.sign(winding)});
  }
  return result;
}
// Catmull–Rom interpolation in Cartesian complex components preserves phase wraps.
export function cubicWeights(t) {
  return [-.5*t+t*t-.5*t*t*t,1-2.5*t*t+1.5*t*t*t,.5*t+2*t*t-1.5*t*t*t,-.5*t*t+.5*t*t*t];
}
export function resample(field,n,size) {
  const tmp=new Float32Array(n*size*2),out=new Float32Array(size*size*2);
  const map=Array.from({length:size},(_,i)=>{const u=i/(size-1)*(n-1),j=Math.floor(u);return {ids:[j-1,j,j+1,j+2].map(k=>Math.max(0,Math.min(n-1,k))),w:cubicWeights(u-j)}});
  for(let y=0;y<n;y++)for(let x=0;x<size;x++){
    const {ids,w}=map[x],o=(y*size+x)*2;
    for(let k=0;k<4;k++){const i=(y*n+ids[k])*2;tmp[o]+=w[k]*field[i];tmp[o+1]+=w[k]*field[i+1];}
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const {ids,w}=map[size-1-y],o=(y*size+x)*2;
    for(let k=0;k<4;k++){const i=(ids[k]*size+x)*2;out[o]+=w[k]*tmp[i];out[o+1]+=w[k]*tmp[i+1];}
  }
  return out;
}
