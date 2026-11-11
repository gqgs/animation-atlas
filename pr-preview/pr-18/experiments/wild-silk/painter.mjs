// Rasterize the invariant measure once, then illuminate four overlapping sectors.
export const palettes={
  pearl:{background:'#090e17',colors:[[90,188,184],[216,168,104],[148,178,199],[111,145,171]]},
  copper:{background:'#130c13',colors:[[228,115,91],[243,183,118],[155,97,139],[193,128,116]]},
  iris:{background:'#0c0c1a',colors:[[137,120,219],[194,144,194],[103,165,196],[171,175,225]]},
};
export function illumination(phase,i,motion){return 1-motion*.5+motion*.5*Math.cos(2*Math.PI*(phase-i/4));}
export function makePainter(orbit,settings){
  const s={...settings},theme=palettes[s.palette]||palettes.pearl;
  let cache=null,cw=0,ch=0;
  function build(w,h){
    const hist=Array.from({length:4},()=>new Float32Array(w*h));
    const b=s.framing==='full'?orbit.bounds:orbit.coreBounds,span=Math.max(b.maxX-b.minX,b.maxY-b.minY),scale=.84*Math.min(w,h)/span*s.zoom;
    const cx=(b.maxX+b.minX)/2,cy=(b.maxY+b.minY)/2;
    const angle=s.rotation*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
    for(let i=0;i<orbit.count;i++){
      const x=orbit.points[2*i]-cx,y=orbit.points[2*i+1]-cy;
      const rx=x*co-y*si,ry=x*si+y*co;
      const px=w/2+rx*scale,py=h/2-ry*scale,ix=Math.floor(px),iy=Math.floor(py);
      if(ix<0||iy<0||ix>=w-1||iy>=h-1)continue;
      const sector=(Math.atan2(y,x)/Math.PI*2+4)%4,group=Math.floor(sector),f=sector-group;
      const dx=px-ix,dy=py-iy;
      for(let j=0;j<2;j++){
        const a=hist[(group+j)%4],v=j?f:1-f,k=iy*w+ix;
        a[k]+=v*(1-dx)*(1-dy);a[k+1]+=v*dx*(1-dy);
        a[k+w]+=v*(1-dx)*dy;a[k+w+1]+=v*dx*dy;
      }
    }
    return hist.map((density,i)=>{
      const layer=document.createElement('canvas');layer.width=w;layer.height=h;
      const ctx=layer.getContext('2d'),image=ctx.createImageData(w,h),data=image.data,color=theme.colors[i];
      // Exposure scales with output area, preserving the density response.
      const gain=s.exposure*w*h/Math.max(1,orbit.count)*.23;
      for(let k=0;k<density.length;k++){
        const v=1-Math.exp(-Math.pow(density[k]*gain,.72));
        data[k*4]=color[0];data[k*4+1]=color[1];data[k*4+2]=color[2];data[k*4+3]=Math.round(255*v);
      }
      ctx.putImageData(image,0,0);return layer;
    });
  }
  return (canvas,phase)=>{
    const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{alpha:false});
    if(!cache||cw!==w||ch!==h){cache=build(w,h);cw=w;ch=h;}
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='screen';
    for(let i=0;i<4;i++){ctx.globalAlpha=illumination(phase,i,s.motion);ctx.drawImage(cache[i],0,0);}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  };
}
