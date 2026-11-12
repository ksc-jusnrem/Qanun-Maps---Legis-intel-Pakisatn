import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../work/browser-runtime/package.json',import.meta.url));
const {chromium}=require('playwright-core');
const base=process.argv[2]||'http://127.0.0.1:4187';
const out=path.resolve('work/library-repair/browser');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const prefix=viewport.width===390?'mobile':'desktop';
  const visit=async url=>{const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.evaluate(()=>document.fonts.ready);return response;};
  const response=await visit(base+'/laws/pk-code-6c462b7d924dbbe3');assert.equal(response.status(),200);
  assert.equal(await page.locator('#law-text').evaluate(e=>e.tagName),'DIV');
  const rule14=page.locator('nav[aria-label="Identified provisions"] a').filter({hasText:/^Rule 14\b/}).first();await rule14.click();
  assert.match(await page.locator(':target').textContent(),/14/);
  assert.ok(await page.locator('#law-text p').count()>10);
  const sourceControl=page.locator('#reader-format');if(await sourceControl.count()){assert.match(await sourceControl.textContent(),/View source transcription/);await sourceControl.click();assert.ok(await page.locator('#original-transcription').evaluate(e=>e.open));await rule14.click();}
  const overflow=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));assert.ok(overflow.width<=overflow.viewport+1,JSON.stringify(overflow));
  await page.screenshot({path:path.join(out,prefix+'-rule14.png')});
  await page.locator('#reader-query').fill('Cabinet');await page.locator('#reader-search').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>/\d+ matching/.test(document.getElementById('reader-search-status').textContent));
  assert.ok(await page.locator('#reader-search-results li').count()>0);
  await visit(base+'/laws/punjab-code-d660763e2dce89e6#library-relationships');
  const relationships=page.locator('#library-relationships');assert.ok(await relationships.getByRole('link').count()>2);
  assert.match(await relationships.textContent(),/Higher Education|Companies/);
  await page.screenshot({path:path.join(out,prefix+'-law-map.png')});
  await visit(base+'/library-map?law=punjab-code-d660763e2dce89e6#library-map');
  await page.waitForFunction(()=>document.querySelectorAll('[data-map-law]:not([hidden])').length===1);
  await page.locator('#library-map-clear').click();assert.equal(await page.locator('[data-map-law]:not([hidden])').count(),1732);
  await page.locator('#library-map-query').fill('Companies');await page.waitForFunction(()=>document.querySelectorAll('[data-map-law]:not([hidden])').length<1732);assert.ok(await page.locator('[data-map-law]:not([hidden])').count()>0);
  const mapOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);assert.ok(mapOverflow);
  await page.screenshot({path:path.join(out,prefix+'-library-map.png')});
  await visit(base+'/laws/pk-code-4fd8caf7b4384576');
  assert.ok(await page.locator('nav[aria-label="Identified provisions"] a').count()>=5,'Pension source layout lost provisions');
  const pension5=page.locator('nav[aria-label="Identified provisions"] a').filter({hasText:/^Section 5\b/}).first();assert.ok(!(await pension5.textContent()).includes('SCHEDULE'));assert.ok(await page.locator('#law-text .law-division').filter({hasText:/THE SCHEDULE/}).count()===1);
  await page.screenshot({path:path.join(out,prefix+'-pension.png')});
  for(const [kp,number] of [['kp-code-c0b8bf5083693604',2],['kp-code-f4b59eb600407733',4],['kp-code-59a43affa0de6d6b',3]]){await visit(base+'/laws/'+kp);assert.equal(await page.locator('nav[aria-label="Identified provisions"] a').count(),number);}
  await visit(base+'/laws/pk-code-2fff45df8bbd92f6#source-supplement-page-00312');
  const form=page.locator('#source-supplement-page-00312 img');await form.scrollIntoViewIfNeeded();await form.evaluate(e=>e.decode());assert.ok(await form.evaluate(e=>e.complete&&e.naturalWidth>0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const rotation=page.locator('#source-supplement-page-00312 input[type="checkbox"]');await rotation.check();assert.ok(await form.evaluate(e=>getComputedStyle(e).transform!=='none'));await rotation.uncheck();
  await page.screenshot({path:path.join(out,prefix+'-cpc-original-form.png')});
  await visit(base+'/laws/pk-code-f40603913b933194');
  assert.ok((await page.locator('#reading-source-transcription').textContent()).length>2000000,'Income Tax full 822-page reading truncated');
  assert.ok(await page.locator('#original-transcription').count()===1,'Legacy Income Tax archive absent');
  const oldIncome=await (await page.request.get(base+'/laws/pk-code-f40603913b933194.json')).json();
  await visit(base+'/laws/pk-code-f40603913b933194#'+oldIncome.passages.at(-1).reader_fragment);await page.waitForFunction(()=>document.getElementById('original-transcription').open);assert.equal(await page.locator('#source-transcription').textContent(),oldIncome.text.replace(/\r\n?/g,'\n'));
  for(const id of ['pk-code-5097d83dca653be9','pk-code-ab0f59c91b74feab','pk-code-c02eccd95b859b79','pk-code-4ff23b094ca55ea4']){
   await visit(base+'/laws/'+id+'#source-page-002');
   assert.equal(await page.locator('#law-text').getAttribute('data-reader-kind'),'original-facsimile');
   const image=page.locator('#source-page-002 img');await image.scrollIntoViewIfNeeded();await image.evaluate(e=>e.decode());
   assert.ok(await image.evaluate(e=>e.complete&&e.naturalWidth>0&&e.naturalHeight>0),'Original page failed to load');
   if(id!=='pk-code-4ff23b094ca55ea4')assert.ok(await page.locator('#facsimile-relationships').count()>0,'Original-page relationships missing');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Facsimile page overflows viewport');
   await page.screenshot({path:path.join(out,prefix+'-'+id+'.png')});
   if(id==='pk-code-4ff23b094ca55ea4'){const archived=await (await page.request.get(base+'/laws/'+id+'.json')).json();await visit(base+'/laws/'+id+'#'+archived.passages[0].reader_fragment);await page.waitForFunction(()=>document.getElementById('original-transcription').open);assert.equal(await page.locator('#source-transcription').textContent(),archived.text.replace(/\r\n?/g,'\n'));}
  }
  assert.deepEqual(errors,[],'Browser/CSP errors');results.push({viewport,status:'passed',journeys:['operative Rule14','reader search','instrument relationships','law-filtered map','search and reset','horizontal overflow','browser errors','Pension Schedule boundary','all three marginal-heading KP readers','complete Income Tax reading and earlier version','all four original facsimile readers','original CPC form image and rotation','historical passage links open exact earlier versions']});await page.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,results},null,2));console.log('BROWSER_LIBRARY_JOURNEYS_PASSED '+JSON.stringify(results));
}finally{await browser.close();}
