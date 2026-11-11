const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const root=process.env.BASE_URL||'http://localhost:8080/';
  const url=new URL('experiments/wild-silk/index.html',root).href;
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#metrics').textContent.includes('λ'));
  assert.equal(await page.locator('#zoomCyclic').isChecked(),true);
  assert.equal(await page.locator('#rotationCyclic').isChecked(),true);
  const seed=await page.locator('#seed').inputValue();
  await page.locator('#discover').click();
  await page.waitForFunction(()=>document.querySelectorAll('#results button').length>=2,{},{timeout:60000});
  await page.locator('#results button').first().click();
  assert.notEqual(await page.locator('#seed').inputValue(),seed);
  assert.ok(await page.locator('#saved option').count()>1);
  await page.locator('#seed').fill('invalid');await page.locator('#apply').click();
  assert.match(await page.locator('#status').textContent(),/Could not load/);
  await page.goto(url+'?seed='+seed+'&phase=0.375&framing=full&zoom=0.7');
  assert.equal(await page.locator('#phase').inputValue(),'0.375');
  assert.equal(await page.locator('#play').textContent(),'Play');
  assert.equal(await page.locator('#framing').inputValue(),'full');
  await page.locator('#exportSize').selectOption('720');
  const download=page.waitForEvent('download');await page.locator('#png').click();
  assert.match((await download).suggestedFilename(),/\.png$/);
  const render=await page.evaluate(async()=>{
    const {sample,decode}=await import('./core.mjs');const {makePainter}=await import('./painter.mjs');
    const orbit=sample(decode(document.querySelector('#seed').value),100000);
    const {defaultTracks}=await import('./parameters.mjs');
    const settings={palette:'pearl',framing:'core',exposure:1.6,zoom:.8,rotation:0,motion:0};
    const draw=makePainter(orbit,settings,defaultTracks,{exact:true}),c=document.createElement('canvas');c.width=c.height=720;
    draw(c,0);const a=c.toDataURL();draw(c,1);const b=c.toDataURL();draw(c,.5);const d=c.toDataURL();draw(c,0);
    return {seam:a===b,animated:a!==d,repeat:a===c.toDataURL()};
  });assert.deepEqual(render,{seam:true,animated:true,repeat:true});
  // UI integration with the real shared exporter and a deterministic recorder double.
  await page.evaluate(()=>{
    window.CCapture={FrameWrap:class{
      start(){window.frames=[];}capture(c){window.frames.push([c.width,c.height]);}
      stop(){}save(callback){callback(new Blob(['test'],{type:'video/mp4'}));}dispose(){}
    }};
  });
  await page.locator('#duration').fill('8');await page.locator('#exportFps').selectOption('30');
  const video=page.waitForEvent('download');await page.locator('#record').click();await video;
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='MP4 export complete.');
  assert.deepEqual(await page.evaluate(()=>[window.frames.length,window.frames[0]]),[240,[720,720]]);
  assert.equal(await page.locator('#seed').isEnabled(),true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#hide').click();assert.equal(await page.locator('aside').isVisible(),false);
  await page.screenshot({path:process.env.SCREENSHOT||'/tmp/wild-silk-browser.png'});
  assert.deepEqual(errors,[]);console.log('Wild Silk browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
