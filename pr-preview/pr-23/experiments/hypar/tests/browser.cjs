const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
const server=spawn('python3',['-m','http.server','8765'],{stdio:'ignore'});
let browser;
try{
await new Promise(r=>setTimeout(r,800));
browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1400,height:1000},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8765/dist/experiments/hypar/?phase=0');await page.waitForTimeout(500);
const frames=[];
for(const phase of [0,.125,.25,.5,.75,1]){
 await page.locator('#phase').evaluate((e,p)=>{e.value=p;e.dispatchEvent(new Event('input'));},String(phase));await page.waitForTimeout(100);
 frames.push(await page.locator('#scene').evaluate(e=>e.toDataURL()));
 await page.screenshot({path:`/tmp/hypar-phase-${phase}.png`});
}
assert.equal(frames[0],frames[5]);assert.notEqual(frames[0],frames[2]);
await page.locator('#zoomCyclic').check();assert.equal(await page.locator('#zoom').isDisabled(),true);
await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.locator('#copyLink').click();
const url=await page.evaluate(()=>navigator.clipboard.readText());assert.match(url,/tracks=/);
await page.goto(url);assert.equal(await page.locator('#zoomCyclic').isChecked(),true);
await page.locator('#exportSize').selectOption('720');await page.locator('#exportFps').selectOption('30');
const png=page.waitForEvent('download');await page.locator('#png').click();await (await png).saveAs('/tmp/hypar.png');
await page.locator('#duration').fill('4');await page.locator('#duration').dispatchEvent('input');
const video=page.waitForEvent('download',{timeout:180000});await page.locator('#record').click();
assert.equal(await page.locator('#duration').isDisabled(),true);
await (await video).saveAs('/tmp/hypar.mp4');assert.equal(await page.locator('#status').textContent(),'MP4 export complete.');
await page.locator('#record').click();await page.locator('#record').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Export canceled.');
assert.equal(await page.locator('#duration').isDisabled(),false);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.screenshot({path:'/tmp/hypar-mobile.png'});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
assert.deepEqual(errors,[]);console.log('PASS: six phase renders, pixel seam, URL tracks, mobile, PNG, complete 720p/30fps cycle, cancellation; no browser errors');
}finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
