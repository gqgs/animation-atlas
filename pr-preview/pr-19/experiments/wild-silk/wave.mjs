// Two smooth traveling shears: horizontal first, vertical second. Each shear
// is invertible and area preserving; their composition cannot fold the image.
const TAU=2*Math.PI;
const wrap=p=>p-Math.floor(p);
export function waveX(y,phase,strength){
  const p=wrap(phase);
  return .045*strength*(Math.sin(TAU*(1.6*y-p))+.3*Math.sin(TAU*(.7*y+2*p)+.8));
}
export function waveY(x,phase,strength){return .045*.65*strength*Math.sin(TAU*(1.35*x-wrap(phase))+1.1);}
export function waveMargin(width,height){return Math.ceil(.065*Math.min(width,height))+2;}
export function createWavePainter(){
  let scratch=null;
  return (source,target,phase,strength,background,margin)=>{
    const w=target.width,h=target.height,size=Math.min(w,h),ctx=target.getContext('2d',{alpha:false});
    if(!scratch){scratch=document.createElement('canvas');}
    if(scratch.width!==source.width||scratch.height!==source.height){scratch.width=source.width;scratch.height=source.height;}
    const temp=scratch.getContext('2d',{alpha:false});
    temp.setTransform(1,0,0,1,0,0);temp.globalAlpha=1;temp.globalCompositeOperation='source-over';
    temp.fillStyle=background;temp.fillRect(0,0,scratch.width,scratch.height);
    // One-pixel strips avoid seams. Fractional translation is interpolated by
    // Canvas; work and allocations are independent of the orbit sample count.
    for(let y=0;y<source.height;y++){
      const dx=size*waveX((y-margin)/h,phase,strength);
      temp.drawImage(source,0,y,source.width,1,dx,y,source.width,1);
    }
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    for(let x=0;x<w;x++){
      const dy=size*waveY(x/w,phase,strength);
      ctx.drawImage(scratch,x+margin,margin-dy,1,h,x,0,1,h);
    }
  };
}
