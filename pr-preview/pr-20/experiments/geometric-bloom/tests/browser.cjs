const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
const server=spawn('python3',['-m','http.server','8765'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,1000));
const b=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await b.newPage({viewport:{width:1400,height:1000},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8765/dist/experiments/geometric-bloom/?phase=.25');await page.waitForTimeout(600);
assert.equal(await page.locator('#openingCyclic').isChecked(),true);
await page.locator('#phase').evaluate(e=>{e.value='.5';e.dispatchEvent(new Event('input'));});await page.waitForTimeout(100);
assert.equal(await page.locator('#openingValue').textContent(),'1.00');
await page.locator('#openingCyclic').uncheck();await page.locator('#opening').fill('.45');await page.locator('#opening').dispatchEvent('input');
await page.locator('#openingCyclic').check();
await page.locator('#exportSize').selectOption('720');await page.locator('#exportFps').selectOption('30');
await page.locator('#duration').fill('4');await page.locator('#duration').dispatchEvent('input');
await page.locator('#record').click();
try{const dl=await page.waitForEvent('download',{timeout:120000});await dl.saveAs('/tmp/bloom.mp4');}catch(e){throw new Error('Export: '+await page.locator('#status').textContent());}
console.log('STATUS',await page.locator('#status').textContent(),'ERRORS',errors);
assert.deepEqual(errors,[]);
await page.locator('#record').click();await page.locator('#record').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Export canceled.');
assert.equal(await page.locator('#duration').isDisabled(),false);
await b.close();server.kill();
})().catch(e=>{console.error(e);process.exit(1)});
