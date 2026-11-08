// Optional development dependency: npm install playwright@1.62.1
// Run from repo root. No dependency/build step is needed to run the study itself.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),output=process.env.QA_OUTPUT||'/tmp/spiral-julia-qa';
const types={'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}
});
let browser;const errors=[];
const log=message=>console.log('PASS · '+message);
async function reviewImage(page,name){
 const bytes=await page.screenshot({type:'jpeg',quality:70});await fs.writeFile(path.join(output,name+'.jpg'),bytes);
 // Chunked source-only render evidence can be retrieved from CI logs without credentials or artifacts.
 const data=bytes.toString('base64'),chunks=Math.ceil(data.length/6000);
 for(let n=0;n<chunks;n++)console.log(`RENDER_IMAGE ${name} ${n}/${chunks} ${data.slice(n*6000,(n+1)*6000)}`);
}
(async()=>{
 await fs.mkdir(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,study=base+'/experiments/spiral-julia/';
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(study+'tests/browser.html');await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('PASS')||document.querySelector('#result').textContent.startsWith('FAIL'),null,{timeout:120000});
 assert.match(await page.locator('#result').textContent(),/^PASS/);console.log(await page.locator('#checks').innerText());log('Browser shader and deterministic capture harness');
 await page.goto(study+'?phase=0');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('ITERATIONS'),null,{timeout:120000});
 assert.equal(await page.locator('#play').isEnabled(),true);await reviewImage(page,'pearl');
 for(const preset of ['lace','detail','original']){await page.locator('#preset').selectOption(preset);await page.waitForFunction(id=>document.querySelector('#preset').value===id,preset);await page.screenshot({path:path.join(output,preset+'.png')});await reviewImage(page,preset);}
 await page.locator('#preset').selectOption('spiral');await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#phase').value)>0);await page.locator('#play').click();const paused=await page.locator('#phase').inputValue();await page.waitForTimeout(300);assert.equal(await page.locator('#phase').inputValue(),paused);log('Preset changes and playback pause/resume');
 await page.locator('#hide').click();assert.equal(await page.locator('aside').isVisible(),false);await page.locator('#show').click();assert.equal(await page.locator('aside').isVisible(),true);log('Hide/show controls');
 await page.goto(study+'?phase=0.5');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('ITERATIONS'));
 const rect=await page.locator('#scene').boundingBox();await page.mouse.dblclick(rect.x+rect.width/2+100,rect.y+rect.height/2);
 const actual=Number(await page.locator('#centerX').inputValue()),expected=100*2*.85*Math.exp(.16)/Math.min(rect.width,rect.height)*Math.SQRT1_2;
 assert.ok(Math.abs(actual-expected)<.001,`${actual} vs ${expected}`);log('Double-click camera mapping uses the breathing extent');
 await page.locator('#palette').selectOption('lagoon');await page.locator('#link').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Scene link')||document.querySelector('#status input'));log('Palette and replay link controls');
 // PNG renders directly at the selected resolution, independently of the viewport.
 await page.goto(study+'?phase=0&iterations=64');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('ITERATIONS'));
 const pngPromise=page.waitForEvent('download',{timeout:120000});await page.locator('#png').click();const png=await pngPromise,pngPath=path.join(output,'spiral-1080.png');await png.saveAs(pngPath);const pngBytes=await fs.readFile(pngPath);assert.equal(pngBytes.readUInt32BE(16),1080);assert.equal(pngBytes.readUInt32BE(20),1080);log('Actual 1080×1080 PNG download');
 // Real app export, with a short low-iteration scene to keep software-rendered CI practical.
 await page.goto(study+'?phase=0&iterations=32&duration=8');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('ITERATIONS'));
 await page.locator('#exportSize').selectOption('720');await page.locator('#exportFps').selectOption('30');
 const videoPromise=page.waitForEvent('download',{timeout:480000,predicate:download=>download.suggestedFilename().endsWith('.mp4')});await page.locator('#record').click();const video=await videoPromise;const videoPath=path.join(output,'spiral-720.mp4');await video.saveAs(videoPath);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_frames,duration','-of','json',videoPath],{encoding:'utf8'}));
 console.log('MP4_PROBE '+JSON.stringify(probe));const stream=probe.streams[0];assert.equal(stream.codec_name,'h264');assert.equal(stream.width,720);assert.equal(stream.height,720);assert.equal(stream.r_frame_rate,'30/1');assert.equal(Number(stream.nb_frames),240);assert.ok(Math.abs(Number(stream.duration)-8)<.05);log('Actual H.264 MP4: 720×720, 30 FPS, 240 frames, 8 seconds');
 const decoded=execFileSync('ffmpeg',['-v','error','-i',videoPath,'-vf','select=eq(n\\,0)+eq(n\\,120)+eq(n\\,239)','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:16*1024*1024});
 const frameBytes=720*720*3;assert.equal(decoded.length,frameBytes*3);let lo=255,hi=0,change=0;
 for(let i=0;i<frameBytes;i++){lo=Math.min(lo,decoded[i]);hi=Math.max(hi,decoded[i]);change+=Math.abs(decoded[i]-decoded[i+frameBytes]);}
 assert.ok(hi-lo>32,'Encoded image must not be blank');assert.ok(change/frameBytes>.1,'Encoded midpoint must visibly differ from its initial frame');log('Decoded MP4 contains a detailed image and changing frames');

 await page.waitForFunction(()=>document.querySelector('#record').textContent==='Export MP4');let canceledDownload=false;page.on('download',download=>{if(download.suggestedFilename().endsWith('.mp4'))canceledDownload=true;});
 const captureState=()=>page.evaluate(()=>({status:document.querySelector('#status').textContent,button:document.querySelector('#record').textContent,controlsDisabled:document.querySelector('#preset').disabled}));
 for(let attempt=1;attempt<=2;attempt++){
 await page.locator('#record').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Encoding'));console.log('CANCEL_BEFORE '+JSON.stringify(await captureState()));
 await page.locator('#record').click();console.log('CANCEL_AFTER '+JSON.stringify(await captureState()));
 try{await page.waitForFunction(()=>document.querySelector('#status').textContent==='Export canceled.');}catch(error){console.log('CANCEL_TIMEOUT '+JSON.stringify({...await captureState(),canceledDownload,errors}));throw error;}
 assert.equal(canceledDownload,false);assert.equal(await page.locator('#preset').isEnabled(),true);
 }log('Repeated actual export cancellation restores controls and saves no partial video');
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});const phone=await mobile.newPage();await phone.goto(study+'?phase=0');await phone.waitForFunction(()=>document.querySelector('#meter').textContent.includes('ITERATIONS'));
 assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await reviewImage(phone,'mobile');await phone.locator('#hide').click();assert.equal(await phone.locator('#show').evaluate(el=>getComputedStyle(el).opacity),'1');await phone.locator('#show').click();assert.equal(await phone.locator('aside').isVisible(),true);log('Mobile layout and visible touch-mode return control');
 await page.goto(base+'/#scene=spiral-julia');await page.locator('#frame-host iframe').waitFor();assert.equal(await page.locator('#frame-host iframe').count(),1);await page.locator('#back').click();assert.equal(await page.locator('#frame-host iframe').count(),0);await page.locator('a.cover[href="#scene=spiral-julia"]').click();await page.locator('#frame-host iframe').waitFor();assert.equal(await page.locator('#frame-host iframe').count(),1);log('Gallery launch, close/destroy and reopen');
 assert.deepEqual(errors,[]);console.log('SPIRAL_QA_SUCCESS');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));});
