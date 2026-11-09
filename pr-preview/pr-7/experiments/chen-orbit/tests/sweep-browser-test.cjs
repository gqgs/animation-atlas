const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),output=process.env.QA_OUTPUT||'/tmp/chen-sweep-qa';
const types={'.html':'text/html','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.gz':'application/gzip'};
const server=http.createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
let browser,page;const errors=[];
(async()=>{
 await fs.mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const study=`http://127.0.0.1:${server.address().port}/experiments/chen-orbit/`;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce',acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(study+'?study=sweep&phase=0&elevation=16');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('512-ANGLE'),{timeout:90000});
 await page.screenshot({path:path.join(output,'sweep-ui.png')});
 const metrics=await page.evaluate(async()=>{
  const {createRenderer}=await import('./renderer.mjs?v=sweep-1'),{defaults,readSettings,settingsQuery}=await import('./core.mjs?v=sweep-1');
  const {loadSweepDensity}=await import('./sweep-renderer.mjs?v=sweep-1');await loadSweepDensity();
  const canvas=document.createElement('canvas'),r=createRenderer(canvas),gl=canvas.getContext('webgl2');
  const frame=(p,t,size=360)=>{r.draw(p,t,size,size);const bytes=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
  const diff=(a,b)=>a.reduce((s,v,i)=>s+(i%4===3?0:Math.abs(v-b[i])),0),original=frame(defaults,0),p={...defaults,study:'sweep',elevation:16};
  const a=frame(p,0),b=frame(p,.25),again=frame(p,0),end=frame(p,1),cut=frame({...p,sweepCutoff:.15},0),bright=frame({...p,sweepGain:2},0),restored=frame(defaults,0);
  const images=[];for(const phase of [0,.125,.25,.5,.75]){frame(p,phase,720);images.push({name:'sweep-'+phase+'.png',data:canvas.toDataURL('image/png').split(',')[1]});}
  let lit=0,white=0;for(let i=0;i<a.length;i+=4){if(Math.max(a[i],a[i+1],a[i+2])>30)lit++;if(Math.min(a[i],a[i+1],a[i+2])>245)white++;}
  const hold={...p,motion:'still'};const result={lit,white,orbit:diff(a,b),repeat:diff(a,again),seam:diff(a,end),cutoff:diff(a,cut),exposure:diff(a,bright),restored:diff(original,restored),staticField:diff(frame(hold,0),frame(hold,.25)),roundtrip:JSON.stringify(readSettings(settingsQuery(p,.5)).parameters)===JSON.stringify(p),images};r.dispose();return result;
 });for(const image of metrics.images)await fs.writeFile(path.join(output,image.name),Buffer.from(image.data,'base64'));delete metrics.images;
 console.log('SWEEP_PIXELS '+JSON.stringify(metrics));assert.ok(metrics.lit>1500);assert.ok(metrics.white<metrics.lit*.4);assert.ok(metrics.orbit>100000);assert.equal(metrics.repeat,0);assert.equal(metrics.seam,0);assert.equal(metrics.restored,0);assert.equal(metrics.staticField,0);assert.ok(metrics.cutoff>10000);assert.ok(metrics.exposure>10000);assert.ok(metrics.roundtrip);
 await page.locator('#study').selectOption('trajectory');await page.locator('#study').selectOption('sweep');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('512-ANGLE'));await page.locator('#sweepGain').fill('1.5');await page.locator('#sweepGain').dispatchEvent('input');await page.locator('#reset').click();assert.equal(await page.locator('#study').inputValue(),'trajectory');assert.equal(await page.locator('#sweepGain').inputValue(),'1');
 await page.locator('#study').selectOption('sweep');await page.waitForFunction(()=>document.querySelector('#meter').textContent.includes('512-ANGLE'));await page.locator('summary',{hasText:'Capture the light'}).click();await page.locator('#exportSize').selectOption('720');
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('#png').click()]);const png=path.join(output,'sweep-export-720.png');await download.saveAs(png);const bytes=await fs.readFile(png);assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),720);
 const movie=await page.evaluate(async()=>{
  const {createRenderer}=await import('./renderer.mjs?v=sweep-1'),{defaults}=await import('./core.mjs?v=sweep-1'),{exportFrames,loadFrameWrap}=await import('../../shared/frame-export.mjs');
  const FrameWrap=await loadFrameWrap(),canvas=document.createElement('canvas'),renderer=createRenderer(canvas),p={...defaults,study:'sweep',elevation:16};
  try{const blob=await exportFrames({width:720,height:720,fps:30,duration:1,format:'mp4',createRecorder:o=>new FrameWrap(o),draw:({ctx,phase})=>{renderer.draw(p,phase,720,720);ctx.drawImage(canvas,0,0);},yieldEvery:1});return Array.from(new Uint8Array(await blob.arrayBuffer()));}finally{renderer.dispose();}
 });const moviePath=path.join(output,'sweep-720.mp4');await fs.writeFile(moviePath,Buffer.from(movie));const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,nb_frames,duration','-of','json',moviePath],{encoding:'utf8'})).streams[0];assert.equal(probe.codec_name,'h264');assert.equal(probe.width,720);assert.equal(probe.height,720);assert.equal(Number(probe.nb_frames),30);console.log('SWEEP_MP4 '+JSON.stringify(probe));
 // A failed optional asset request must not strand the original modes.
 const bad=await browser.newPage({reducedMotion:'reduce'});await bad.route('**/sweep-density.u16.gz*',r=>r.abort());await bad.goto(study+'?study=sweep');await bad.waitForFunction(()=>document.querySelector('#intro').textContent.includes('could not load'));assert.equal(await bad.locator('#study').inputValue(),'trajectory');await bad.close();
 assert.deepEqual(errors,[]);console.log('SWEEP_QA_SUCCESS');
})().catch(async error=>{console.error(error);await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
