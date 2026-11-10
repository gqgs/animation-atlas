// Optional QA dependencies: Playwright Chromium, ffprobe and ffmpeg on PATH.
// Run from repository root: node dist/shared/tests/chromatic-browser-test.cjs
// PLAYWRIGHT_MODULE selects a preinstalled Playwright; QA_OUTPUT holds artifacts.
// No screenshots/video bytes are printed to CI logs. Hard deadline: 15 minutes.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..');
const output=path.resolve(process.env.QA_OUTPUT||'/tmp/chromatic-browser-qa');
const types={'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}
});
let browser,page;const errors=[],results=[],warnings=[];
const log=message=>{results.push(message);console.log('PASS · '+message);};
const deadline=setTimeout(()=>{console.error('Chromatic browser QA exceeded 15 minutes');process.exit(1);},15*60*1000);
async function settle(p){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function range(p,id,value){await p.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);await settle(p);}
async function hash(p){await settle(p);return createHash('sha256').update(await p.locator('#scene').evaluate(c=>c.toDataURL())).digest('hex');}
async function snapshot(p,name){await p.screenshot({path:path.join(output,name+'.png')});}
function probe(file){return JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_frames,nb_read_frames,duration','-of','json',file],{encoding:'utf8',timeout:60000})).streams[0];}
async function png(p,id){const wait=p.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.png')});await p.locator('#png').click();const download=await wait,file=path.join(output,id+'.png');await download.saveAs(file);const bytes=await fs.readFile(file),size=await p.locator('#scene').evaluate(c=>[c.width,c.height]);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],size);}
async function sharedControls(p,id){
 assert.equal(await p.locator('#play').textContent(),'Play');
 const still=await hash(p);await p.waitForTimeout(180);assert.equal(await hash(p),still,'Initial shared URL must remain paused');
 await range(p,'phase',.173);const a=await hash(p);await range(p,'phase',.429);assert.notEqual(await hash(p),a);await range(p,'phase',.173);assert.equal(await hash(p),a,'Returning to a phase must reproduce exact pixels');
 await p.locator('#play').click();assert.equal(await p.locator('#play').textContent(),'Pause');await p.waitForFunction(()=>Number(document.querySelector('#phase').value)>.174);await p.locator('#play').click();const paused=await hash(p);await p.waitForTimeout(180);assert.equal(await hash(p),paused);
 await p.locator('#hide').click();assert.equal(await p.locator('aside').isVisible(),false);await p.locator('#show').click();assert.equal(await p.locator('aside').isVisible(),true);
 await p.locator('#reset').click();await settle(p);assert.equal(Number(await p.locator('#phase').inputValue()),0);
 await png(p,id+'-download');await snapshot(p,id+'-desktop');
 log(id+': paused URL, deterministic phase replay, playback, hide/show, reset and PNG');
}
(async()=>{
 await fs.mkdir(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce',acceptDownloads:true});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 page=await context.newPage();page.setDefaultTimeout(30000);
 const unwinding=base+'/experiments/chromatic-unwinding/',chamber=base+'/experiments/chromatic-chamber/';
 await page.goto(unwinding+'?phase=0&steps=101&filaments=4');await page.locator('#steps').waitFor();await sharedControls(page,'unwinding');
 for(const [id,angle,shape] of [['square',90,'SQUARE'],['spiral',20,'UNWINDING'],['line',0,'LINE']]){await page.locator('#'+id).click();await settle(page);assert.equal(Number(await page.locator('#turn').inputValue()),angle);assert.equal(await page.locator('#shape').textContent(),shape);}
 await range(page,'turn',37.25);assert.equal(await page.locator('#angleValue').textContent(),'37.25°');
 for(const [id,value] of [['steps',137],['filaments',8],['spread',.75],['width',3],['duration',12],['zoom',1.15]]){await range(page,id,value);assert.equal(Number(await page.locator('#'+id+'Value').evaluate(el=>el.value)),value);}
 const silk=await hash(page);await page.locator('#mode').selectOption('original');assert.notEqual(await hash(page),silk);await page.locator('#mode').selectOption('silk');
 for(const palette of ['lagoon','neon','iridescent']){const before=await hash(page);await page.locator('#palette').selectOption(palette);assert.notEqual(await hash(page),before);}
 await snapshot(page,'unwinding-settings');log('Unwinding angle presets, manual turn, all settings, modes and palettes');
 await page.goto(chamber+'?phase=0&seed=13013');await page.locator('#symmetry').waitFor();await sharedControls(page,'chamber');
 for(const [preset,symmetry] of [['ember',9],['lagoon',16],['porcelain',8],['jewel',12]]){await page.locator('#preset').selectOption(preset);await settle(page);if(preset!=='jewel')assert.equal(Number(await page.locator('#symmetry').inputValue()),symmetry);await snapshot(page,'chamber-'+preset);}
 await range(page,'phase',.217);const plain=await hash(page);await page.locator('#mirrors').check();assert.notEqual(await hash(page),plain);await page.locator('#mirrors').uncheck();assert.equal(await hash(page),plain);await page.locator('#rotation').check();assert.notEqual(await hash(page),plain);await page.locator('#rotation').uncheck();assert.equal(await hash(page),plain);
 for(const [id,value] of [['symmetry',7],['sides',5],['density',.7],['size',.08],['drift',.05],['duration',8],['zoom',.9]]){await range(page,id,value);assert.equal(Number(await page.locator('#'+id+'Value').evaluate(el=>el.value)),value);}
 await page.locator('#seed').fill('42');await page.locator('#seed').press('Tab');await settle(page);const seeded=await hash(page);await page.locator('#seed').fill('314159');await page.locator('#seed').press('Tab');assert.notEqual(await hash(page),seeded);await page.locator('#seed').fill('42');await page.locator('#seed').press('Tab');assert.equal(await hash(page),seeded);
 await page.locator('#palette').selectOption('ember');assert.notEqual(await hash(page),seeded);log('Chamber presets, settings, seed replay, palette, rotation and mirror toggles');
 // Isolate the exact sampling contract with the real extracted painter. The
 // separate full UI export below verifies the actual encoder and downloaded file.
 await page.goto(unwinding+'?phase=0&steps=101&filaments=4');
 const timing=await page.evaluate(async()=>{
  const {exportFrames}=await import('../../shared/frame-export.mjs');
  const {paintField}=await import('./painter.mjs');
  const {defaults,angleAt,makeField}=await import('./core.mjs');
  const scene=Object.freeze({...defaults,steps:101,filaments:4}),samples=[],lifecycle=[];
  let first,last;
  await exportFrames({width:320,height:320,fps:30,duration:1,
   draw:({canvas,frame,time,phase,frames,fps})=>{
    samples.push([frame,time,phase,frames,fps,canvas.width,canvas.height]);
    paintField(canvas,makeField(angleAt(phase),scene),scene,{fit:.96});
    if(frame===0)first=canvas.toDataURL();last=canvas;
   },
   createRecorder:()=>({start(){lifecycle.push('start');},capture(){lifecycle.push('capture');},stop(){lifecycle.push('stop');},save(cb){lifecycle.push('save');cb(new Blob(['sampling-test']));},dispose(){lifecycle.push('dispose');}}),
  });
  paintField(last,makeField(angleAt(0),scene),scene,{fit:.96});
  return {samples,lifecycle,replay:first===last.toDataURL()};
 });
 assert.equal(timing.replay,true);assert.deepEqual(timing.samples,Array.from({length:30},(_,i)=>[i,i/30,i/30,30,30,320,320]));assert.deepEqual(timing.lifecycle,['start',...Array(30).fill('capture'),'stop','save','dispose']);log('Extracted Unwinding painter exports exact i/fps and i/frames samples at independent output dimensions, with deterministic replay');
 // Full minimum-duration app export, not a mock recorder or wall-clock capture.
 await page.goto(unwinding+'?phase=0&steps=101&filaments=4&duration=12');await page.locator('#steps').waitFor();await page.locator('#exportSize').selectOption('720');await page.locator('#exportFps').selectOption('30');
 const mp4Wait=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.mp4'),timeout:480000});await page.locator('#record').click();assert.equal(await page.locator('#steps').isEnabled(),false);const mp4=await mp4Wait,mp4Path=path.join(output,'unwinding-720-30.mp4');await mp4.saveAs(mp4Path);await page.waitForFunction(()=>document.querySelector('#record').textContent==='Export MP4');assert.equal(await page.locator('#steps').isEnabled(),true);assert.equal(await page.locator('#play').textContent(),'Play');const ms=probe(mp4Path);assert.equal(ms.codec_name,'h264');assert.equal(ms.width,720);assert.equal(ms.height,720);assert.equal(ms.r_frame_rate,'30/1');assert.equal(Number(ms.nb_read_frames),360);assert.ok(Math.abs(Number(ms.duration)-12)<.05);console.log('MP4_PROBE '+JSON.stringify(ms));
 const decoded=execFileSync('ffmpeg',['-v','error','-i',mp4Path,'-vf','select=eq(n\\,0)+eq(n\\,180)+eq(n\\,359)','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:8*1024*1024,timeout:60000});
 const frameBytes=720*720*3;assert.equal(decoded.length,frameBytes*3);let lo=255,hi=0,change=0;for(let i=0;i<frameBytes;i++){lo=Math.min(lo,decoded[i]);hi=Math.max(hi,decoded[i]);change+=Math.abs(decoded[i]-decoded[i+frameBytes]);}assert.ok(hi-lo>32);assert.ok(change/frameBytes>.1);log('Unwinding actual MP4: 720 square, 30 FPS, 360 decoded frames, 12 seconds, nonblank changing images');
 let canceledDownload=false;const onDownload=d=>{if(d.suggestedFilename().endsWith('.mp4'))canceledDownload=true;};page.on('download',onDownload);
 for(let attempt=0;attempt<2;attempt++){
  await page.locator('#record').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Encoding'),null,{timeout:60000});assert.equal(await page.locator('#steps').isEnabled(),false);await page.locator('#record').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Export canceled'&&document.querySelector('#record').textContent==='Export MP4');assert.equal(await page.locator('#steps').isEnabled(),true);assert.equal(await page.locator('#play').textContent(),'Play');
 }
 await page.waitForTimeout(300);assert.equal(canceledDownload,false);page.off('download',onDownload);log('Two real encoder cancellations restore controls without saving partial MP4');
 for(const id of ['chromatic-unwinding','chromatic-chamber']){
  await page.goto(base+'/#scene='+id);await page.locator('#frame-host iframe').waitFor();assert.equal(await page.locator('iframe').count(),1);await page.locator('#back').click();assert.equal(await page.locator('#frame-host iframe').count(),0);await page.locator(`a.cover[href="#scene=${id}"]`).click();await page.locator('#frame-host iframe').waitFor();assert.equal(await page.locator('iframe').count(),1);await page.locator('#back').click();assert.equal(await page.locator('iframe').count(),0);
 }
 log('Gallery launches, destroys and reopens both studies with one iframe only');
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
 for(const id of ['chromatic-unwinding','chromatic-chamber']){await phone.goto(base+'/experiments/'+id+'/?phase=0');await phone.locator('#phase').waitFor();await settle(phone);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await phone.locator('aside').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844);await snapshot(phone,id+'-mobile');await phone.locator('#hide').click();assert.equal(await phone.locator('aside').isVisible(),false);
  // Existing CSS hides this button with opacity until hover/focus. Playwright
  // permits tapping opacity-zero targets; this checks hit testing, not visual
  // discoverability. Preserve evidence and flag that pre-existing UX limitation.
  const opacity=await phone.locator('#show').evaluate(el=>getComputedStyle(el).opacity);
  if(Number(opacity)===0){const warning=id+': mobile Show controls is transparent until hover/focus (existing CSS); touch test verifies its hit target only';warnings.push(warning);console.warn('WARN · '+warning);}
  await snapshot(phone,id+'-mobile-hidden');await phone.locator('#show').tap();assert.equal(await phone.locator('aside').isVisible(),true);
 }
 await mobile.close();log('Both mobile panels fit the viewport; hide/show hit targets work via touch (see visibility warnings)');
 // Run the real-time recording last so a codec failure cannot mask the
 // independent interaction, MP4, gallery or mobile results above. Use an
 // explicitly light scene: slow software rendering must not consume the whole
 // recording interval before the browser has presented multiple frames.
 await page.setViewportSize({width:640,height:640});
 try {
  await page.goto(chamber+'?phase=0&seed=42&symmetry=3&sides=3&density=0.3&size=0.14&drift=0.12&duration=120&zoom=0.9');
  await page.locator('#symmetry').waitFor();await settle(page);
  const webmWait=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.webm'),timeout:90000});
  await page.locator('#record').click();assert.equal(await page.locator('#record').textContent(),'Stop recording');assert.equal(await page.locator('#symmetry').isEnabled(),false);
  await page.evaluate(()=>{window.__chamberRecordingQA={last:null,changes:0,start:performance.now()};});
  await page.waitForFunction(()=>{
   const q=window.__chamberRecordingQA,value=Number(document.querySelector('#phase').value);
   if(q.last!==null&&value>q.last)q.changes++;
   q.last=value;
   return q.changes>=8&&performance.now()-q.start>=2500;
  },null,{polling:'raf',timeout:60000});
  console.log('WEBM_CAPTURE '+JSON.stringify(await page.evaluate(()=>({phase:document.querySelector('#phase').value,transitions:window.__chamberRecordingQA.changes,elapsedMs:Math.round(performance.now()-window.__chamberRecordingQA.start)}))));
  await page.locator('#record').click();const webm=await webmWait,webmPath=path.join(output,'chamber-short.webm');await webm.saveAs(webmPath);
  await page.waitForFunction(()=>document.querySelector('#record').textContent==='Record loop');assert.equal(await page.locator('#symmetry').isEnabled(),true);assert.equal(await page.locator('#play').textContent(),'Play');
  const ws=probe(webmPath);console.log('WEBM_PROBE '+JSON.stringify(ws));
  assert.ok(['vp8','vp9'].includes(ws.codec_name));assert.equal(ws.width,640);assert.equal(ws.height,640);assert.ok(Number(ws.nb_read_frames)>1,'Short WebM must contain at least two decoded frames');
  log('Chamber actual short record/stop creates multi-frame decodable WebM and restores controls');
 } finally {await page.setViewportSize({width:1280,height:900});}
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'summary.json'),JSON.stringify({results,errors,warnings},null,2));console.log('CHROMATIC_BROWSER_QA_SUCCESS');
})().catch(async error=>{console.error(error);console.error('PAGE_ERRORS '+JSON.stringify(errors));if(page){console.error('PAGE '+page.url());await snapshot(page,'failure').catch(()=>{});console.error('STATUS '+await page.locator('#status').textContent({timeout:1000}).catch(()=>'(not present)'));}process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));clearTimeout(deadline);});
