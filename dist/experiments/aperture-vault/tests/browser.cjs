const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async()=>{
  const output = await fs.mkdtemp(path.join(os.tmpdir(),'aperture-vault-qa-'));
  const browser = await chromium.launch({
    headless:true,
    ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({viewport:{width:1300,height:850},acceptDownloads:true});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
    const base = process.env.QA_URL || 'http://127.0.0.1:8780/dist/experiments/aperture-vault/';
    await page.goto(base+'?phase=0');
    await page.waitForFunction(()=>{
      const c = document.querySelector('#scene');
      return c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data[3]===255;
    });
    const seek = async phase=>{
      await page.locator('#phase').evaluate((e,p)=>{e.value=p;e.dispatchEvent(new Event('input'));},String(phase));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const canvasData = ()=>page.locator('#scene').evaluate(e=>e.toDataURL());
    if(process.env.EXPECT_RENDERER) assert.match(await page.locator("#renderer").textContent(),new RegExp(process.env.EXPECT_RENDERER));
    const closed = await canvasData();
    await seek(.28);
    const staged = await canvasData();
    assert.notEqual(staged,closed);
    await page.screenshot({path:path.join(output,'bounce.png')});
    await page.locator('#lighting').selectOption('direct');
    assert.equal(await page.locator('#phase').inputValue(),'0.28');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.notEqual(await canvasData(),staged);
    await page.screenshot({path:path.join(output,'direct.png')});
    await page.locator('#lighting').selectOption('bounce');
    await seek(1);
    assert.equal(await canvasData(),closed);

    await page.locator('#rotationCyclic').check();
    assert.equal(await page.locator('#rotation').isDisabled(),true);
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await page.locator('#lighting').selectOption('direct');
    await page.locator('#copyLink').click();
    const url = await page.evaluate(()=>navigator.clipboard.readText());
    assert.match(url,/tracks=/);
    await page.goto(url);
    assert.equal(await page.locator('#lighting').inputValue(),'direct');
    assert.equal(await page.locator('#rotationCyclic').isChecked(),true);

    await page.locator('#exportSize').selectOption('720');
    await page.locator('#exportFps').selectOption('30');
    const png = page.waitForEvent('download');
    await page.locator('#png').click();
    await (await png).saveAs(path.join(output,'still.png'));
    const file = await fs.readFile(path.join(output,'still.png'));
    assert.equal(file.readUInt32BE(16),720);
    assert.equal(file.readUInt32BE(20),720);

    await page.locator('#duration').fill('4');
    await page.locator('#record').click();
    assert.equal(await page.locator('#lighting').isDisabled(),true);
    await page.locator('#record').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Export canceled.');
    assert.equal(await page.locator('#lighting').isDisabled(),false);
    if(process.env.TEST_MP4 === '1') {
      const video = page.waitForEvent('download',{timeout:240000});
      await page.locator('#record').click();
      const outputFile=path.join(output,'cycle.mp4');
      await (await video).saveAs(outputFile);
      const info = JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',outputFile]));
      assert.deepEqual([info.streams[0].width,info.streams[0].height,info.streams[0].nb_frames,info.streams[0].r_frame_rate],[720,720,'120','30/1']);
      assert.equal(Number(info.streams[0].duration),4);
    }

    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(output,'mobile.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('Passed: scene seam, light comparison, tracks URL, PNG dimensions, cancellation, mobile; evidence:', output);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
