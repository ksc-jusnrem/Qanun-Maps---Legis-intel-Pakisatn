import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getSourceSupplement,renderSourceSupplements,verifySourceSupplementsOutput} from './supplements.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const assetURL=new URL('./supplement-assets/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',assetURL),'utf8'));
const load=id=>JSON.parse(fs.readFileSync(new URL('../../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'));
const audit=JSON.parse(fs.readFileSync(new URL('../sources/source-verification.json',import.meta.url),'utf8'));

test('source supplements publish all reviewed original graphics without changing archived text or passage contracts',()=>{
 const output=fileURLToPath(new URL('./.supplement-test-output-'+process.pid+'/',import.meta.url));assert.ok(output.startsWith(fileURLToPath(new URL('./',import.meta.url))));let pages=0;
 try{for(const f of manifest.records){
  const r=load(f.id),before=JSON.stringify(r),out=renderSourceSupplements(r,{output,sourceStatus:audit.records[r.id]});assert.equal(JSON.stringify(r),before);assert.equal(getSourceSupplement(r.id).source_pdf_sha256,f.source_pdf_sha256);
  assert.equal(out.report.source_body_contains_untranscribed_images,true);assert.equal(out.report.full_source_body_text_checked,false);assert.equal(out.report.source_image_transcription_checked,false);assert.equal(out.report.source_image_supplement_pages,f.page_count);assert.equal(out.report.visible_content_preserved,undefined,'A supplement must not replace main extracted-text fidelity');assert.equal(out.report.kind,undefined,'A supplement must not replace main reader kind');
  assert.ok(out.html.includes('not fully represented by the searchable transcription'));assert.ok(out.html.includes('no verified OCR transcription is claimed'));
  assert.ok(out.html.includes('Rotate 90° for reading'));assert.ok(out.css.includes('rotate(90deg)'));
  const checked=verifySourceSupplementsOutput(r,out.html,out.report,output);pages+=checked.source_image_supplement_pages;
  const folder=path.join(output,'sources','supplements',f.id);assert.deepEqual(fs.readdirSync(folder).sort(),['original.pdf',...f.pages.map(p=>p.asset)].sort());
  for(const p of f.pages){const bytes=fs.readFileSync(path.join(folder,p.asset));assert.equal(sha(bytes),p.sha256);assert.equal(bytes.readUInt32BE(16),p.width);assert.equal(bytes.readUInt32BE(20),p.height);assert.ok(out.nav.includes('#source-supplement-page-'+String(p.source_page).padStart(5,'0')));}
  assert.throws(()=>renderSourceSupplements({...r,text:r.text+'changed'}),/input record hash mismatch/);
  assert.throws(()=>renderSourceSupplements(r,{sourceStatus:{original:{sha256:'0'.repeat(64)}}}),/audited PDF binding mismatch/);
  if(f.id==='pk-code-f40603913b933194'){const original=audit.records[r.id].original;const restored=fs.readFileSync(original.extracted_text_path,'utf8').replace(/\r\n/g,'\n');assert.equal(sha(restored),original.extracted_text_sha256);assert.ok(f.accepted_input_text_sha256.includes(sha(restored)));const repaired={...r,text:restored,text_sha256:sha(restored)};assert.equal(renderSourceSupplements(repaired,{sourceStatus:audit.records[r.id]}).report.input_sha256,sha(restored),'Same original PDF must bind independently restored reading version');}
  assert.throws(()=>renderSourceSupplements(r,{assetBase:'/../escaped'}),/asset base/);
  assert.throws(()=>verifySourceSupplementsOutput(r,out.html,{...out.report,full_source_body_text_checked:true},output));
  const p=f.pages[0],asset=path.join(folder,p.asset),original=fs.readFileSync(asset);fs.writeFileSync(asset,'changed');assert.throws(()=>verifySourceSupplementsOutput(r,out.html,out.report,output),/Published supplement image changed/);fs.writeFileSync(asset,original);
  assert.throws(()=>verifySourceSupplementsOutput(r,out.html.replace('data-source-page="'+p.source_page+'"','data-source-page="0"'),out.report,output),/physical page/);
  const ids=[...out.html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const link of out.html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(link[1]));
 }}finally{for(const f of manifest.records){const folder=path.join(output,'sources','supplements',f.id);if(fs.existsSync(folder)){for(const file of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,file));fs.rmdirSync(folder);}}if(fs.existsSync(output)){fs.rmdirSync(path.join(output,'sources','supplements'));fs.rmdirSync(path.join(output,'sources'));fs.rmdirSync(output);}}
 assert.equal(pages,manifest.summary.selected_pages);assert.equal(manifest.records.length,manifest.summary.records);assert.ok(pages>=21);assert.equal(renderSourceSupplements(load('pk-code-5097d83dca653be9')),null,'Complete facsimile readers are not duplicated as supplements');
});

test('supplement PNGs have independently re-rendered original-page pixel proof tied to current manifest',()=>{
 const proof=JSON.parse(fs.readFileSync(new URL('pixel-verification.json',assetURL),'utf8'));assert.equal(proof.manifest_sha256,sha(fs.readFileSync(new URL('manifest.json',assetURL))));assert.equal(proof.source_inventory_sha256,manifest.source_inventory_sha256);assert.equal(proof.all_pixels_match,true);assert.equal(proof.pages,manifest.summary.selected_pages);assert.equal(proof.records,manifest.records.length);
 for(const f of manifest.records)for(const p of f.pages){const row=proof.results.find(r=>r.id===f.id&&r.source_page===p.source_page);assert.ok(row);assert.equal(row.original_pdf_sha256,f.source_pdf_sha256);assert.equal(row.png_sha256,p.sha256);assert.equal(row.independent_original_render_pixel_sha256,p.pixel_sha256);assert.equal(row.decoded_png_pixel_sha256,p.pixel_sha256);assert.equal(row.matched,true);}
});
