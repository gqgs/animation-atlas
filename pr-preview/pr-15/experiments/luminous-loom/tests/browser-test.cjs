// Run from the repository root. Requires Playwright Chromium and ffmpeg/ffprobe.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..'),output=path.resolve(process.env.QA_OUTPUT||'/tmp/luminous-loom-qa');
const types={'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
let browser,page;const errors=[],results=[],evidence={};
const log=m=>{results.push(m);console.log('PASS · '+m);};
const deadline=setTimeout(()=>{console.error('Loom QA exceeded 15 minutes');process.exit(1);},900000);
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function range(p,id,value){await p.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle(p);}
async function hash(p){await settle(p);return p.locator('#scene').evaluate(c=>c.toDataURL());}
const snapshot=(p,name)=>p.screenshot({path:path.join(output,name+'.png')});
function probe(file){return JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration','-of','json',file],{encoding:'utf8',timeout:60000})).streams[0];}
(async()=>{
 await fs.mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,url=base+'/experiments/luminous-loom/';
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce',acceptDownloads:true});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto(url+'?phase=0&fibers=16&samples=128');await page.locator('#fibers').waitFor();
 assert.equal(await page.locator('#play').textContent(),'Play');
 const still=await hash(page);await page.waitForTimeout(150);assert.equal(await hash(page),still);
 await range(page,'phase',.173);const replay=await hash(page);await range(page,'phase',.429);assert.notEqual(await hash(page),replay);await range(page,'phase',.173);assert.equal(await hash(page),replay);
 await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#phase').value)>.174);await page.locator('#play').click();const paused=await hash(page);await page.waitForTimeout(150);assert.equal(await hash(page),paused);
 await page.locator('#reset').click();await settle(page);assert.equal(Number(await page.locator('#phase').inputValue()),0);
 await page.locator('#hide').click();assert.equal(await page.locator('aside').isVisible(),false);await page.locator('#show').click();assert.equal(await page.locator('aside').isVisible(),true);
 log('Paused URL, exact phase replay, play/pause, reset and desktop hide/show');
 for(const [preset,knot,fibers,samples] of [['cinquefoil','T(2,5)',112,640],['orbital','T(3,4)',144,640],['stress','T(2,3)',384,1536],['ribbon','T(2,3)',96,640]]){await page.locator('#preset').selectOption(preset);await settle(page);assert.equal(await page.locator('#knot').textContent(),knot);assert.equal(Number(await page.locator('#fibers').inputValue()),fibers);assert.equal(Number(await page.locator('#samples').inputValue()),samples);await snapshot(page,'preset-'+preset);}
 for(const [id,value] of [['fibers',24],['samples',192],['spread',.8],['width',1.5],['opacity',.8],['zoom',.9],['duration',4]]){await range(page,id,value);assert.equal(Number(await page.locator('#'+id).inputValue()),value);assert.equal(Number(await page.locator('#'+id+'Value').evaluate(el=>el.value)),value);}
 for(const palette of ['ember','glacier','aurora']){const before=await hash(page);await page.locator('#palette').selectOption(palette);assert.notEqual(await hash(page),before);}
 const glow=await hash(page);await page.locator('#glow').uncheck();assert.notEqual(await hash(page),glow);await page.locator('#glow').check();
 for(const renderer of ['path2d','merged','direct']){await page.locator('#renderer').selectOption(renderer);await settle(page);assert.equal(await page.locator('#renderer').inputValue(),renderer);}
 await snapshot(page,'desktop');log('Every preset, slider, palette, glow toggle and renderer control');
 // Real Canvas pixels from the same shared geometry/painter, independently of UI.
 evidence.pixels=await page.evaluate(async()=>{
  const {normalize,createGeometry,geometryAt}=await import('./core.mjs');const {preparePaths,paint}=await import('./renderer.mjs');
  const results=[];
  for(const scene of [{fibers:24,samples:192},{fibers:96,samples:640,p:3,q:5}])for(const phase of [0,.173,.5]){
   const p=normalize(scene),w=createGeometry(p),data=geometryAt(w,phase),images={};
   for(const mode of ['direct','path2d','merged']){const c=document.createElement('canvas');c.width=c.height=360;paint(c,data,p,preparePaths(data,p,mode),mode);images[mode]=c.getContext('2d').getImageData(0,0,360,360).data;}
   const delta=(a,b)=>{let max=0,sum=0,over2=0;for(let i=0;i<a.length;i+=4){let pixelMax=0;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);max=Math.max(max,d);sum+=d;pixelMax=Math.max(pixelMax,d);}if(pixelMax>2)over2++;}return {max,mean:sum/(a.length/4*3),fractionOver2:over2/(a.length/4)};};
   results.push({scene,phase,path2d:delta(images.direct,images.path2d),merged:delta(images.direct,images.merged)});
  }
  return results;
 });
 for(const row of evidence.pixels){assert.ok(row.path2d.max<=32,JSON.stringify(row));assert.ok(row.path2d.mean<=.05,JSON.stringify(row));assert.ok(row.path2d.fractionOver2<=.001,JSON.stringify(row));assert.ok(Number.isFinite(row.merged.mean));}
 assert.ok(evidence.pixels.some(row=>row.merged.mean>0),'Merged compositing difference must be measured');
 console.log('PIXEL_DELTAS '+JSON.stringify(evidence.pixels));log('Fresh Path2D matches direct within strict raster tolerance; merged overlap error quantified');
 await page.goto(url);await page.locator('#fibers').waitFor();assert.equal(await page.locator('#play').textContent(),'Play');const reduced=await hash(page);await page.waitForTimeout(150);assert.equal(await hash(page),reduced);log('Reduced-motion default is paused without phase query');
 await page.goto(url+'?phase=0&fibers=8&samples=128&duration=4');await page.locator('#fibers').waitFor();
 await page.locator('details').filter({has:page.locator('#exportSize')}).evaluate(el=>el.open=true);
 await page.locator('#exportSize').selectOption('720');await page.locator('#exportFps').selectOption('30');
 // Exercise the real UI benchmark and downloaded report, not synthetic timers.
 await page.locator('#benchmark').click();assert.equal(await page.locator('#fibers').isEnabled(),false);
 await page.waitForFunction(()=>window.loomBenchmarkResult&&document.querySelector('#benchmark').textContent==='Compare matched frames',null,{timeout:180000});
 evidence.benchmark=await page.evaluate(()=>window.loomBenchmarkResult);
 assert.equal(evidence.benchmark.size,1080);assert.equal(evidence.benchmark.pass,true);assert.equal(evidence.benchmark.method.samples,9);
 for(const mode of ['direct','path2d','merged'])for(const stage of ['geometry','prepare','submit','rasterFence','total']){const timing=evidence.benchmark.timings[mode][stage];assert.equal(timing.samples.length,9);assert.ok(timing.samples.every(n=>Number.isFinite(n)&&n>=0));assert.ok(timing.max>=timing.median&&timing.p95>=timing.min);}
 assert.equal(evidence.benchmark.pixels.length,8);assert.equal(await page.locator('#fibers').isEnabled(),true);
 const reportWait=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.json')});await page.locator('#report').click();const reportDownload=await reportWait;await reportDownload.saveAs(path.join(output,'benchmark.json'));
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(output,'benchmark.json'),'utf8')),evidence.benchmark);
 log('Real 1080-square benchmark measures all stages and three modes, checks pixels, and downloads matching report');
 const aborted=await page.evaluate(async()=>{const {runBenchmark}=await import('./benchmark.mjs');const c=new AbortController();c.abort();try{await runBenchmark({fibers:8,samples:128},{size:64,samples:3,warmup:0,signal:c.signal});return false;}catch(e){return e.name==='AbortError';}});assert.equal(aborted,true);
 const pngWait=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.png')});await page.locator('#png').click();const png=await pngWait,pngPath=path.join(output,'own-size.png');await png.saveAs(pngPath);const bytes=await fs.readFile(pngPath);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[720,720]);log('PNG renders at selected 720 square output independent of preview');
 const mp4Wait=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.mp4'),timeout:480000});await page.locator('#record').click();assert.equal(await page.locator('#fibers').isEnabled(),false);const mp4=await mp4Wait,mp4Path=path.join(output,'loom-720-30.mp4');await mp4.saveAs(mp4Path);await page.waitForFunction(()=>document.querySelector('#record').textContent==='Export MP4');assert.equal(await page.locator('#fibers').isEnabled(),true);assert.equal(await page.locator('#play').textContent(),'Play');
 evidence.mp4=probe(mp4Path);assert.equal(evidence.mp4.codec_name,'h264');assert.equal(evidence.mp4.width,720);assert.equal(evidence.mp4.height,720);assert.equal(evidence.mp4.r_frame_rate,'30/1');assert.equal(Number(evidence.mp4.nb_read_frames),120);assert.ok(Math.abs(Number(evidence.mp4.duration)-4)<.05);
 const decoded=execFileSync('ffmpeg',['-v','error','-i',mp4Path,'-vf','select=eq(n\\,0)+eq(n\\,60)+eq(n\\,119)','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:8*1024*1024,timeout:60000}),frameBytes=720*720*3;assert.equal(decoded.length,3*frameBytes);let lo=255,hi=0,change=0;for(let i=0;i<frameBytes;i++){lo=Math.min(lo,decoded[i]);hi=Math.max(hi,decoded[i]);change+=Math.abs(decoded[i]-decoded[i+frameBytes]);}assert.ok(hi-lo>32);assert.ok(change/frameBytes>.01);log('Actual shared-exporter MP4: H.264, 720 square, 30 FPS, 120 nonblank changing frames, four seconds');
 let canceledDownload=false;const onDownload=d=>{if(d.suggestedFilename().endsWith('.mp4'))canceledDownload=true;};page.on('download',onDownload);
 for(let attempt=0;attempt<2;attempt++){await page.locator('#record').click();await page.waitForFunction(()=>/Encoding/i.test(document.querySelector('#status').textContent),null,{timeout:60000});await page.locator('#record').click();await page.waitForFunction(()=>/cancel/i.test(document.querySelector('#status').textContent)&&document.querySelector('#record').textContent==='Export MP4');assert.equal(await page.locator('#fibers').isEnabled(),true);assert.equal(await page.locator('#play').textContent(),'Play');}
 await page.waitForTimeout(300);assert.equal(canceledDownload,false);page.off('download',onDownload);log('Repeated real-encoder cancellation restores controls without partial downloads');
 await page.goto(base+'/#scene=luminous-loom');await page.locator('#frame-host iframe').waitFor();assert.equal(await page.locator('iframe').count(),1);await page.locator('#back').click();assert.equal(await page.locator('iframe').count(),0);await page.locator('a.cover[href="#scene=luminous-loom"]').click();await page.locator('#frame-host iframe').waitFor();assert.equal(await page.locator('iframe').count(),1);await page.locator('#back').click();assert.equal(await page.locator('iframe').count(),0);log('Gallery destroys and reopens study with no hidden running iframe');
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'}),phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(url+'?phase=0&fibers=16&samples=128');await phone.locator('#fibers').waitFor();await settle(phone);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await phone.locator('aside').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);assert.ok(box.height>0);await phone.locator('#hide').scrollIntoViewIfNeeded();await snapshot(phone,'mobile');await phone.locator('#hide').tap();assert.equal(await phone.locator('aside').isVisible(),false);assert.equal(await phone.locator('#show').isVisible(),true);assert.ok(Number(await phone.locator('#show').evaluate(el=>getComputedStyle(el).opacity))>0);await snapshot(phone,'mobile-hidden');await phone.locator('#show').tap();assert.equal(await phone.locator('aside').isVisible(),true);await mobile.close();log('Mobile panel fits width, scrolls normally and visible hide/show works with touch');
 assert.deepEqual(errors,[]);console.log('LUMINOUS_LOOM_QA_SUCCESS');
})().catch(async error=>{console.error(error);if(page){await snapshot(page,'failure').catch(()=>{});console.error('STATUS '+await page.locator('#status').textContent({timeout:1000}).catch(()=>'(absent)'));}process.exitCode=1;}).finally(async()=>{await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'summary.json'),JSON.stringify({results,errors,...evidence},null,2));await browser?.close();await new Promise(r=>server.close(r));clearTimeout(deadline);});
