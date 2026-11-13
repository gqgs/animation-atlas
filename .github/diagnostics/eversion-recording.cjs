// Investigation only: do not change the production renderer or recorder.
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/eversion-recording',size=Number(process.env.QA_SIZE||1080),exact=process.env.QA_SCENE!=='default';
fs.mkdirSync(out,{recursive:true});
const query=new URLSearchParams({depth:'2.95',pleats:'.11',zoom:'1.05',rotation:'-41',elevation:'50',duration:'5',tracks:JSON.stringify({v:1,t:{elevation:[40,50,'smoothstep'],rotation:[-10,10,'sine']}}),phase:'.14098841'}).toString();
(async()=>{
const server=spawn('python3',['-m','http.server','8765'],{stdio:'ignore'});let browser;
try{
 await new Promise(r=>setTimeout(r,800));browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('saveEvidence',async(name,data)=>fs.writeFileSync(path.join(out,name),Buffer.from(data,'base64')));
 await page.goto('http://127.0.0.1:8765/dist/experiments/eversion-bloom/?'+(exact?query:'phase=.14098841'));await page.waitForTimeout(500);
 const result=await page.evaluate(async({size,exact})=>{
  const {readState,poseAt,geometryAt,indices}=await import('./core.mjs'),{draw}=await import('./painter.mjs'),{loadFrameWrap,exportFrames}=await import('../../shared/frame-export.mjs');
  const {settings,tracks}=readState(new URLSearchParams(location.search)),fps=60,duration=settings.duration,total=Math.round(duration*fps);
  const selected=[...new Set([0,Math.round(.14098841*total),84,85,86,Math.round(total*.5),Math.round(total*.75),total-1])].filter(i=>i<total);
  const encoders=[],NativeEncoder=VideoEncoder;
  // Observe the config without changing the encoder selection or capture path.
  VideoEncoder=class extends NativeEncoder{configure(c){encoders.push(c);return super.configure(c);}};
  const save=(name,c)=>window.saveEvidence(name,c.toDataURL('image/png').split(',')[1]);
  const background=document.createElement('canvas');background.width=background.height=size;const bc=background.getContext('2d');const g=bc.createRadialGradient(size*.5,size*.52,0,size*.5,size*.52,size*.68);g.addColorStop(0,'#26313a');g.addColorStop(.55,'#101922');g.addColorStop(1,'#080d16');bc.fillStyle=g;bc.fillRect(0,0,size,size);await save('background.png',background);
  const mask=document.createElement('canvas');mask.width=mask.height=size;const mc=mask.getContext('2d');
  async function reference(frame,phase){
   const p=poseAt(settings,tracks,phase),xyz=geometryAt(p,phase),yaw=p.rotation*Math.PI/180+.12,e=p.elevation*Math.PI/180;
   const xy=[];for(let i=0;i<xyz.length;i+=3){const x=xyz[i]*Math.cos(yaw)-xyz[i+2]*Math.sin(yaw),z=xyz[i]*Math.sin(yaw)+xyz[i+2]*Math.cos(yaw),y=xyz[i+1]*Math.cos(e)-z*Math.sin(e);xy.push([size/2+x*.135*p.zoom*size,size*.54-y*.135*p.zoom*size]);}
   mc.fillStyle='#000';mc.fillRect(0,0,size,size);mc.fillStyle='#fff';mc.strokeStyle='#fff';mc.lineWidth=2;
   for(let i=0;i<indices.length;i+=3){mc.beginPath();mc.moveTo(...xy[indices[i]]);mc.lineTo(...xy[indices[i+1]]);mc.lineTo(...xy[indices[i+2]]);mc.closePath();mc.fill();mc.stroke();}await save('mask-'+frame+'.png',mask);
  }
  const FrameWrap=await loadFrameWrap();const start=performance.now();
  const blob=await exportFrames({width:size,height:size,fps,duration,bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),yieldEvery:1,createRecorder:o=>new FrameWrap(o),draw:async({canvas,frame,phase})=>{
   draw(canvas,settings,tracks,phase);
   if(selected.includes(frame)){await save('raw-'+frame+'.png',canvas);await reference(frame,phase);}
  }});
  const data=await new Promise(resolve=>{const f=new FileReader();f.onload=()=>resolve(f.result.split(',')[1]);f.readAsDataURL(blob);});await window.saveEvidence('export.mp4',data);
  // Fresh renders check seeking vs sequential export; use one reusable target.
  const fresh=document.createElement('canvas');fresh.width=fresh.height=size;
  for(const frame of selected){draw(fresh,settings,tracks,frame/total);await save('fresh-'+frame+'.png',fresh);}
  return {size,fps,duration,total,selected,settings,tracks,pausedPhase:Number(new URLSearchParams(location.search).get('phase')),exportFirstPhase:0,encoders,seconds:(performance.now()-start)/1000,videoBytes:blob.size,userAgent:navigator.userAgent};
 },{size,exact});
 result.errors=errors;fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(result,null,2));assert.deepEqual(errors,[]);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate,codec_name,pix_fmt,duration','-of','json',path.join(out,'export.mp4')],{encoding:'utf8'}));fs.writeFileSync(path.join(out,'probe.json'),JSON.stringify(probe,null,2));
 assert.equal(Number(probe.streams[0].nb_frames),result.total);assert.equal(probe.streams[0].width,size);assert.equal(probe.streams[0].height,size);
 const filter='select='+result.selected.map(i=>'eq(n\\,'+i+')').join('+');
 execFileSync('ffmpeg',['-v','error','-i',path.join(out,'export.mp4'),'-vf',filter,'-vsync','0',path.join(out,'decoded-%03d.png')]);
 result.selected.forEach((frame,i)=>fs.renameSync(path.join(out,'decoded-'+String(i+1).padStart(3,'0')+'.png'),path.join(out,'decoded-'+frame+'.png')));
 console.log(JSON.stringify(result));
}finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
