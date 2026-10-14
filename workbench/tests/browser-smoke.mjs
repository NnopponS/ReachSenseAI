import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
  args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const origin=process.env.REACHSENSE_TEST_URL || 'http://127.0.0.1:8000';
const errors=[];
await mkdir('workbench/test-results',{recursive:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1200},acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(origin);
  await page.getByRole('button',{name:'ลองภาพจำลอง'}).click();
  await page.waitForFunction(()=>document.getElementById('markers').textContent.includes('พบ 6 marker'));
  const box=await page.locator('#canvas').boundingBox();
  const click=async(x,y)=>page.mouse.click(box.x+x/960*box.width,box.y+y/720*box.height);
  await click(100,100);await click(200,100);await click(500,300);await click(530,340);
  assert.equal(await page.locator('#save').isDisabled(),true);
  await page.locator('#plane').check();
  assert.match(await page.locator('#score').innerText(),/-4.00/);
  assert.match(await page.locator('#distance').innerText(),/5.00/);
  assert.match(await page.locator('#meaning').innerText(),/ภาพจำลอง/);
  await page.locator('#save').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
  const download=await downloadPromise;
  const chunks=[];for await(const chunk of await download.createReadStream()) chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(exported.measurement_valid,false);
  assert.ok(Math.abs(exported.records[0].signed_overlap_cm-(-4))<1e-9);
  assert.equal(exported.records[0].synthetic,true);
  assert.match(exported.records[0].source_sha256,/^[a-f0-9]{64}$/);
  await page.screenshot({path:'workbench/test-results/workbench-desktop.png',fullPage:true});
  await page.locator('#plane').uncheck();assert.equal(await page.locator('#save').isDisabled(),true);
  await page.locator('#undo').click();assert.equal(await page.locator('#save').isDisabled(),true);
  console.log('PASS desktop: six-marker detection, manual 3–4–5 geometry, assumptions, undo, JSON export');

  // The software camera is an input/lifecycle check, not a physical-camera acceptance test.
  await page.locator('#camera').click();
  await page.waitForFunction(()=>!document.getElementById('freeze').disabled);
  await page.locator('#freeze').click();
  await page.waitForFunction(()=>document.getElementById('sourceStatus').textContent==='ภาพนิ่ง');
  await page.locator('#stop').click();
  assert.equal(await page.locator('#video').evaluate(video=>video.srcObject),null);
  assert.equal(await page.locator('#stop').isDisabled(),true);
  console.log('PASS synthetic camera: start, freeze, stop and track release');
  const rgb=await context.newPage();
  rgb.on('pageerror',error=>errors.push(error.message));
  await rgb.goto(`${origin}/rgb-lab/`);
  await rgb.locator('#example').click();
  await rgb.waitForFunction(()=>document.getElementById('calibrationStatus').textContent.includes('EXPLORATORY ONLY'));
  const workerCheck=await rgb.evaluate(async()=>{
    const bundle=await (await fetch('./examples/exploratory.json')).json();
    const worker=new Worker('./worker.js');
    return await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{worker.terminate();reject(new Error('RGB worker readiness timeout'));},30000);
      worker.onerror=event=>{clearTimeout(timeout);worker.terminate();reject(new Error(event.message));};
      worker.onmessage=({data})=>{
        if(data.type==='error'){clearTimeout(timeout);worker.terminate();reject(new Error(data.message));}
        if(data.type==='ready'){
          const pixels=new Uint8Array(bundle.camera.width*bundle.camera.height*4);
          worker.postMessage({type:'frame',id:1,time:0,width:bundle.camera.width,height:bundle.camera.height,pixels:pixels.buffer},[pixels.buffer]);
        }
        if(data.type==='frame'){clearTimeout(timeout);worker.terminate();resolve(data);}
      };
      worker.postMessage({type:'configure',bundle});
    });
  });
  assert.equal(workerCheck.measurement,null);
  assert.ok(Object.values(workerCheck.results).every(r=>r.reason==='reference-unobserved'));
  console.log('PASS integrated RGB Lab: exploratory calibration, actual WASM worker, missing references rejected');
  await context.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const phone=await mobile.newPage();phone.on('pageerror',error=>errors.push(error.message));
  await phone.goto(origin);
  const demo=await phone.request.get(`${origin}/api/demo.png`);
  await phone.locator('#upload').setInputFiles({name:'digital-observation.png',mimeType:'image/png',buffer:await demo.body()});
  await phone.waitForFunction(()=>document.getElementById('markers').textContent.includes('พบ 6 marker'));
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await phone.locator('#sourceStatus').innerText(),'ภาพนิ่ง');
  await phone.screenshot({path:'workbench/test-results/workbench-mobile.png',fullPage:true});
  console.log('PASS mobile viewport: PNG upload, detection and no horizontal overflow (Chromium, not physical Android/iOS)');
  assert.deepEqual(errors,[]);
  await writeFile('workbench/test-results/browser-summary.json',JSON.stringify({passed:4,errors,physical_camera_validated:false},null,2));
  console.log('PASS no browser exceptions or HTTP errors');
} finally {await browser.close();}
