const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),output=process.env.QA_OUTPUT||'/tmp/chen-camera-qa';
const types={'.html':'text/html','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.gz':'application/gzip'};
const server=http.createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
let browser,page;const errors=[];
(async()=>{
 await fs.mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const study=`http://127.0.0.1:${server.address().port}/experiments/chen-orbit/`;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce',acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(study+'?study=sweep&motion=vertical&elevation=0&azimuth=24&phase=.25');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('512-ANGLE'),null,{timeout:90000});
 await page.screenshot({path:path.join(output,'vertical-overhead-ui.png')});
 const metrics=await page.evaluate(async()=>{
  const {createRenderer}=await import('./renderer.mjs?v=camera-1'),{defaults,switchCameraMotion,settingsQuery,readSettings}=await import('./core.mjs?v=camera-1');const{loadSweepDensity}=await import('./sweep-renderer.mjs?v=camera-1');await loadSweepDensity();
  const canvas=document.createElement('canvas'),r=createRenderer(canvas),gl=canvas.getContext('webgl2');
  const frame=(p,t,size=320)=>{r.draw(p,t,size,size);const data=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
  const diff=(a,b)=>a.reduce((s,v,i)=>s+(i%4===3?0:Math.abs(v-b[i])),0),images=[],rows=[];
  for(const study of ['trajectory','planes','sweep']){
   const p={...defaults,study,motion:'vertical',elevation:0,azimuth:24},start=frame(p,0),top=frame(p,.25),bottom=frame(p,.75),again=frame(p,0),end=frame(p,1),held=switchCameraMotion(p,'still',.62),replay=readSettings(settingsQuery(held,.62));
   rows.push({study,motion:diff(start,top),aboveBelow:diff(top,bottom),repeat:diff(start,again),seam:diff(start,end),holdMeanError:diff(frame(p,.62),frame(held,.62))/(320*320*3),replayMeanError:diff(frame(held,.62),frame(replay.parameters,replay.phase))/(320*320*3)});
   for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]){frame(p,phase,720);images.push({name:`vertical-${study}-${phase}.png`,data:canvas.toDataURL('image/png').split(',')[1]});}
  }
  const legacy=frame(defaults,0),reset=frame({...defaults,motion:'vertical'},0);rows.push({study:'legacy',initial:diff(legacy,reset)});r.dispose();return {rows,images};
 });for(const image of metrics.images)await fs.writeFile(path.join(output,image.name),Buffer.from(image.data,'base64'));delete metrics.images;console.log('VERTICAL_PIXELS '+JSON.stringify(metrics));
 for(const row of metrics.rows){if(row.study==='legacy'){assert.equal(row.initial,0);continue;}assert.ok(row.motion>100000);assert.ok(row.aboveBelow>100000);assert.equal(row.repeat,0);assert.equal(row.seam,0);assert.ok(row.holdMeanError<.05);assert.ok(row.replayMeanError<.05);}
 // Holding an inverted view must survive controls, a tiny drag, and a scene URL.
 await page.locator('#phase').fill('0.62');await page.locator('#phase').dispatchEvent('input');await page.locator('#motion').selectOption('still');const before=Number(await page.locator('#elevation').inputValue());assert.ok(before < -100);
 const rect=await page.locator('#scene').boundingBox();await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5+4);await page.mouse.up();assert.ok(Math.abs(Number(await page.locator('#elevation').inputValue())-before-1)<.01);
 for(const motion of ['orbit','vertical','still','vertical']){await page.locator('#motion').selectOption(motion);assert.equal(await page.locator('#phase').inputValue(),'0.62');}
 await page.locator('#reset').click();assert.equal(await page.locator('#motion').inputValue(),'orbit');assert.equal(await page.locator('#elevation').inputValue(),'12');
 await page.goto(study+'?study=sweep&motion=vertical&elevation=0&azimuth=24&phase=.75');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('512-ANGLE'));
 await page.locator('summary',{hasText:'Capture the light'}).click();await page.locator('#exportSize').selectOption('720');const [download]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('#png').click()]);const png=path.join(output,'vertical-underside-export.png');await download.saveAs(png);const bytes=await fs.readFile(png);assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),720);
 const movie=await page.evaluate(async()=>{const{createRenderer}=await import('./renderer.mjs?v=camera-1'),{defaults}=await import('./core.mjs?v=camera-1'),{exportFrames,loadFrameWrap}=await import('../../shared/frame-export.mjs');const FrameWrap=await loadFrameWrap(),gpu=document.createElement('canvas'),r=createRenderer(gpu),p={...defaults,study:'sweep',motion:'vertical',elevation:0,azimuth:24};try{const blob=await exportFrames({width:720,height:720,fps:30,duration:2,format:'mp4',createRecorder:o=>new FrameWrap(o),draw:({ctx,phase})=>{r.draw(p,phase,720,720);ctx.drawImage(gpu,0,0);},yieldEvery:1});return Array.from(new Uint8Array(await blob.arrayBuffer()));}finally{r.dispose();}});
 const moviePath=path.join(output,'vertical-sweep-720.mp4');await fs.writeFile(moviePath,Buffer.from(movie));const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,nb_frames,duration','-of','json',moviePath],{encoding:'utf8'})).streams[0];assert.equal(probe.codec_name,'h264');assert.equal(probe.width,720);assert.equal(probe.height,720);assert.equal(Number(probe.nb_frames),60);assert.equal(Number(probe.duration),2);console.log('VERTICAL_MP4 '+JSON.stringify(probe));
 const decoded=execFileSync('ffmpeg',['-v','error','-i',moviePath,'-vf','select=eq(n\\,15)+eq(n\\,45)','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:8*1024*1024}),n=720*720*3;assert.equal(decoded.length,2*n);let change=0;for(let i=0;i<n;i++)change+=Math.abs(decoded[i]-decoded[n+i]);assert.ok(change/n>1);
 assert.deepEqual(errors,[]);console.log('VERTICAL_QA_SUCCESS');
})().catch(async error=>{console.error(error);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
