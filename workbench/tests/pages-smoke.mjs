import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const prefix='/ReachSenseAI/',root=resolve('site');
const errors=[],requests=[];
const server=createServer(async(req,res)=>{
  try {
    requests.push({method:req.method,path:req.url});
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.method!=='GET'||!path.startsWith(prefix))throw Error('Static site only');
    let name=decodeURIComponent(path.slice(prefix.length));if(!name||name.endsWith('/'))name+='index.html';
    const file=resolve(root,name);if(relative(root,file).startsWith('..'))throw Error('Outside site');
    const data=await readFile(file);
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
      '.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.stl':'model/stl'}[extname(file)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await chromium.launch({headless:true,channel:process.env.REACHSENSE_BROWSER_CHANNEL || undefined,
  executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
await mkdir('workbench/test-results',{recursive:true});
async function capture(download){const chunks=[];for await(const c of await download.createReadStream())chunks.push(c);return Buffer.concat(chunks);}
try {
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(origin);
  await page.locator('#demo').click();
  await page.waitForFunction(()=>document.getElementById('markers').textContent.includes('พบ 6 marker'),{},{timeout:45000});
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const box=await page.locator('#canvas').boundingBox();
  for(const [x,y] of [[100,100],[200,100],[500,300],[530,340]])await page.mouse.click(box.x+x/960*box.width,box.y+y/720*box.height);
  await page.locator('#plane').check();assert.match(await page.locator('#score').innerText(),/-4.00/);
  await page.locator('#save').click();
  const recordPromise=page.waitForEvent('download');await page.locator('#export').click();
  const record=JSON.parse((await capture(await recordPromise)).toString());
  assert.equal(record.measurement_valid,false);assert.equal(record.records[0].markers.length,6);
  await page.locator('#camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);
  await page.locator('#freeze').click();await page.locator('#stop').click();
  assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  console.log('PASS static project path: browser marker detection, manual score/export and synthetic camera lifecycle');

  await page.getByRole('link',{name:/ดู CAD/}).click();
  await page.waitForFunction(()=>!document.getElementById('downloadKit').disabled,{},{timeout:30000});
  assert.equal(await page.locator('.finger-card').count(),6);
  assert.equal(await page.locator('#viewer canvas').count(),1);
  assert.equal(await page.locator('#viewerStatus').isHidden(),true);
  assert.match(await page.locator('#metricOffset').innerText(),/8/);
  await page.locator('#viewTop').click();await page.locator('#viewSide').click();await page.locator('#viewIso').click();
  await page.screenshot({path:'workbench/test-results/cad-desktop.png',fullPage:true});
  await page.locator('.finger-card[data-id="31"] button').click();assert.match(await page.locator('#modelTag').innerText(),/31/);
  await page.locator('.finger-card[data-id="22"] button').click();
  await page.locator('#d22').fill('18.5');await page.locator('#markerEdge').fill('12.5');
  assert.equal(await page.locator('#downloadKit').isDisabled(),true);
  await page.locator('#apply').click();await page.waitForFunction(()=>!document.getElementById('downloadKit').disabled);
  assert.match(await page.locator('#metricDiameter').innerText(),/18.5/);assert.match(await page.locator('#metricOffset').innerText(),/9.25/);
  const stlPromise=page.waitForEvent('download');await page.locator('#downloadStl').click();const stl=await capture(await stlPromise);
  const catalog=JSON.parse(await readFile('site/cad/data/catalog.json','utf8'));
  assert.equal(createHash('sha256').update(stl).digest('hex'),catalog.meshes['d18.5-e12.5'].sha256);
  const zipPromise=page.waitForEvent('download');await page.locator('#downloadKit').click();const zip=await capture(await zipPromise);
  await writeFile('workbench/test-results/browser-custom-kit.zip',zip);
  // Parse the actual client ZIP independently of the CAD module.
  const {default:JSZip}=await import('jszip');const archive=await JSZip.loadAsync(zip);
  const manifest=JSON.parse(await archive.file('manifest.json').async('string'));
  assert.equal(manifest.parameters.d22,18.5);assert.equal(manifest.parameters.edge,12.5);
  assert.equal(manifest.models.length,6);assert.equal(manifest.measurement_valid,false);
  assert.deepEqual(manifest.models.map(m=>m.id),[21,22,23,31,32,33]);
  assert.equal(manifest.models[1].anatomical_tip_R_mm,null);
  for(const name of Object.keys(manifest.files)) {
    const data=await archive.file(name).async('nodebuffer');
    assert.equal(createHash('sha256').update(data).digest('hex'),manifest.files[name].sha256);
  }
  const plate=await JSZip.loadAsync(await archive.file('all-six-holders.3mf').async('nodebuffer'));
  const xml=await plate.file('3D/3dmodel.model').async('string');
  assert.match(xml,/unit="millimeter"/);assert.equal((xml.match(/<object /g)||[]).length,6);assert.equal((xml.match(/<item /g)||[]).length,6);
  assert.ok((await archive.file('left-middle-22.scad').async('string')).includes('finger_diameter_mm = 18.5;'));
  assert.match(await archive.file('marker-22.svg').async('string'),/width="16.5mm"/);
  console.log('PASS CAD: actual 3D view, six roles, changed size, exact STL hash, six-file ZIP/SCAD/SVG/3MF');
  await page.locator('#d22').fill('50');await page.locator('#apply').click();await page.waitForFunction(()=>!document.getElementById('apply').disabled);
  assert.equal(await page.locator('#downloadKit').isDisabled(),true);assert.match(await page.locator('#cadStatus').innerText(),/12–26/);
  await context.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(origin);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await phone.goto(origin+'cad/');await phone.waitForFunction(()=>!document.getElementById('downloadKit').disabled);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await phone.screenshot({path:'workbench/test-results/cad-mobile.png',fullPage:true});
  await phone.goto(origin+'rgb-lab/');await phone.locator('#example').click();
  await phone.waitForFunction(()=>document.getElementById('calibrationStatus').textContent.includes('EXPLORATORY ONLY'));
  console.log('PASS mobile layout and preserved RGB Lab under the Pages project subpath');
  assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&!r.path.includes('/api/')));
  await writeFile('workbench/test-results/pages-summary.json',JSON.stringify({passed:3,errors,backend_requests:0,static_project_path:prefix},null,2));
  console.log('PASS no browser/HTTP errors and no backend/API/image-upload requests');
} finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
