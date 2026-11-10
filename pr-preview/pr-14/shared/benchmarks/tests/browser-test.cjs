// npm install --no-save playwright; npx playwright install chromium
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.mjs')?'text/javascript':'text/plain');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/shared/benchmarks/canvas.html`);
  await page.locator('#run').click();
  await page.waitForFunction(()=>window.benchmarkResult||window.benchmarkError,{},{timeout:300000});
  const outcome=await page.evaluate(()=>({result:window.benchmarkResult,error:window.benchmarkError}));
  assert.equal(outcome.error,undefined);assert.deepEqual(errors,[]);
  const result=outcome.result;result.environment.browserVersion=browser.version();
  const output=path.resolve(process.env.QA_OUTPUT||'/tmp/rotation-qa-output','rotation-canvas-results.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output,pass:result.pass,geometryAccuracy:result.geometryAccuracy,results:result.results,pixels:result.pixels},null,2));
  assert.ok(result.pass,'Canvas/geometry equivalence failed; see JSON');
 }finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
