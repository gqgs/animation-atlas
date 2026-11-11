const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('experiments/wild-silk/',process.env.BASE_URL||'http://localhost:8094/').href);
 await page.locator('#loopDiscovery summary').click();await page.locator('#loopBroad').click();
 await page.waitForFunction(()=>document.querySelector('#loopStatus').textContent.includes('pass screening'),{},{timeout:240000});
 assert.ok(await page.locator('#loopResults article').count()>0);
 const first=await page.locator('#loopResults canvas').first().evaluate(c=>c.toDataURL());
 await page.waitForTimeout(1500);
 assert.notEqual(await page.locator('#loopResults canvas').first().evaluate(c=>c.toDataURL()),first);
 await page.getByRole('button',{name:'Save ★',exact:true}).first().click();
 await page.locator('#loopView').selectOption('saved');assert.equal(await page.locator('#loopResults article').count(),1);
 await page.getByRole('button',{name:'Load loop',exact:true}).first().click();
 const config=await page.evaluate(()=>JSON.parse(localStorage.getItem('wild-silk-loops-v1'))[0]);
 assert.equal(await page.locator('#seed').inputValue(),config.seed);
 assert.equal(Number(await page.locator('#wave').inputValue()),config.settings.wave);
 assert.equal(Number(await page.locator('#zoomMin').inputValue()),config.tracks.zoom.min);
 await page.reload();await page.locator('#loopDiscovery summary').click();await page.locator('#loopView').selectOption('saved');assert.equal(await page.locator('#loopResults article').count(),1);
 await page.locator('#loopNear').click();await page.locator('#loopStop').click();
 assert.match(await page.locator('#loopStatus').textContent(),/stopped/);
 await page.locator('#loopBroad').click();await page.locator('#loopNear').click();await page.locator('#loopStop').click();
 await page.waitForTimeout(300);assert.match(await page.locator('#loopStatus').textContent(),/stopped/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('Loop discovery browser checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
