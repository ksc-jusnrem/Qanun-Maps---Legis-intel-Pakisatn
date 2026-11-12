import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadReadingVersions} from '../reading-versions.mjs';
import {getFacsimile} from '../reader/facsimile.mjs';
import {getSourceReadingInput} from './reading-inputs.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const normalize=s=>s.replace(/^[ \t]*={5}[ \t]*PDF[ \t]+PAGE[ \t]+\d+[ \t]*={5}[ \t\r]*$/gm,'').normalize('NFKC').replace(/[\ufeff\u00ad]/g,'').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
const report=JSON.parse(fs.readFileSync(path.join(here,'source-verification.json'),'utf8'));
const laws=fs.readdirSync(path.join(root,'landing-pages/qanun-maps/laws')).filter(p=>p.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(root,'landing-pages/qanun-maps/laws',file),'utf8')));
const versions=loadReadingVersions(laws),failures=[],counts={records:laws.length,notices:0,legacy_exact_transcriptions:0,restored_original_readings:0,manually_collated_readings:0,original_facsimiles:0,original_layout_inputs:0};
for(const legacy of laws){
 const cache=path.join(here,'cache/results',legacy.id+'.json');const row=fs.existsSync(cache)?JSON.parse(fs.readFileSync(cache,'utf8')):report.records[legacy.id];
 assert.ok(row,'Missing original-source row '+legacy.id);assert.equal(row.stored_text_sha256,legacy.text_sha256,'Stale original-source audit '+legacy.id);
 if(legacy.content_kind!=='stored_law_text'){assert.equal(row.comparison_status,'source_notice_no_legislation_text');counts.notices++;continue;}
 assert.ok(row.original?.identity_checked,'Missing original identity '+legacy.id);
 assert.equal(sha(fs.readFileSync(row.original.path)),row.original.sha256,'Original PDF changed '+legacy.id);
 assert.equal(row.current_force_status,'not_checked','Source comparison was improperly upgraded to current-force certification');
 const facsimile=getFacsimile(legacy.id);
 if(facsimile){assert.equal(facsimile.source_pdf_sha256,row.original.sha256);assert.equal(facsimile.input_text_sha256,legacy.text_sha256);counts.original_facsimiles++;continue;}
 const reading=versions.get(legacy.id);
 if(reading){
  assert.equal(reading.source_sha256,row.original.sha256);
  if(legacy.id==='pk-code-a2f0a11f70fdf902'){
   const review=JSON.parse(fs.readFileSync(path.join(root,'tools/qanun-library/manual-source-review.json'),'utf8'));
   assert.ok(review.reading_transcription_collated&&review.legacy_ocr_certified===false);assert.deepEqual(review.pages_reviewed,[1,2,3,4,5,6]);
   assert.equal(review.source_pdf_sha256,row.original.sha256);assert.equal(review.final_collation_sha256,sha(fs.readFileSync(path.join(root,'tools/qanun-library/railways-collation.json'))));counts.manually_collated_readings++;
  }else{
   const source=fs.readFileSync(row.original.extracted_text_path,'utf8').replace(/\r\n/g,'\n');assert.equal(sha(source),reading.text_sha256,'Restored reading differs from complete original '+legacy.id);assert.equal(sha(reading.text),reading.text_sha256);counts.restored_original_readings++;
  }
 }else{
  const source=normalize(fs.readFileSync(row.original.extracted_text_path,'utf8')),stored=normalize(legacy.text);
  if(row.comparison_status==='matched_original_normalized')assert.equal(source,stored,'Complete original comparison differs '+legacy.id);
  else if(row.comparison_status==='matched_original_character_stream')assert.equal(source.replace(/\s+/g,''),stored.replace(/\s+/g,''),'Complete original character sequence differs '+legacy.id);
  else{failures.push([legacy.id,row.comparison_status]);continue;}
  counts.legacy_exact_transcriptions++;
 }
 const input=getSourceReadingInput(reading||legacy,row.original.sha256);if(input.sourceLayoutText||input.displayCorrections)counts.original_layout_inputs++;
}
assert.equal(Object.keys(report.records).length,laws.length,'Original audit set differs from library');
const pixels=spawnSync('python',[path.join(here,'verify_facsimile_sources.py')],{cwd:root,encoding:'utf8',timeout:240000});
if(pixels.stdout)process.stdout.write(pixels.stdout);if(pixels.stderr)process.stderr.write(pixels.stderr);assert.equal(pixels.status,0,'Original facsimile pixels failed');assert.match(pixels.stdout,/SOURCE_FACSIMILE_PIXELS_PASSED/);
const inventoryFile=path.join(here,'source-supplement-inventory.json'),inventoryBytes=fs.readFileSync(inventoryFile),inventory=JSON.parse(inventoryBytes);
assert.equal(inventory.summary.small_image_screening_complete,true,'Original source image screening remains incomplete');
const supplementBase=path.join(root,'tools/qanun-library/reader/supplement-assets'),manifestBytes=fs.readFileSync(path.join(supplementBase,'manifest.json')),manifest=JSON.parse(manifestBytes),proof=JSON.parse(fs.readFileSync(path.join(supplementBase,'pixel-verification.json'),'utf8'));
assert.equal(manifest.source_inventory_sha256,sha(inventoryBytes),'Stale original page supplement manifest');assert.equal(manifest.status,'complete');
assert.equal(proof.source_inventory_sha256,sha(inventoryBytes));assert.equal(proof.manifest_sha256,sha(manifestBytes));assert.equal(proof.all_pixels_match,true);
const actualSupplements=new Map(manifest.records.map(r=>[r.id,r]));assert.equal(actualSupplements.size,inventory.records.length);
let supplementPages=0;
for(const expected of inventory.records){
 const actual=actualSupplements.get(expected.id);assert.ok(actual,'Missing original source graphics '+expected.id);
 assert.equal(actual.source_pdf_sha256,expected.original_pdf_sha256);assert.deepEqual(actual.pages.map(p=>p.source_page),expected.selected_physical_pages);
 assert.equal(sha(fs.readFileSync(path.join(supplementBase,expected.id,'original.pdf'))),expected.original_pdf_sha256);
 for(const page of actual.pages){
  const result=proof.results.find(p=>p.id===expected.id&&p.source_page===page.source_page);assert.ok(result?.matched,'Missing independent source graphics pixel proof');
  assert.equal(result.original_pdf_sha256,expected.original_pdf_sha256);assert.equal(result.independent_original_render_pixel_sha256,result.decoded_png_pixel_sha256);
  const actualSha=sha(fs.readFileSync(path.join(supplementBase,expected.id,page.asset)));assert.equal(actualSha,page.sha256);assert.equal(result.png_sha256,actualSha);supplementPages++;
 }
}
assert.equal(proof.pages,supplementPages);counts.original_graphics_records=actualSupplements.size;counts.original_graphics_pages=supplementPages;
console.log(JSON.stringify({...counts,unresolved:failures.length}));
if(failures.length){console.error('Current-reading source verification remains incomplete:',JSON.stringify(failures));process.exitCode=1;}
else console.log('ORIGINAL_SOURCE_COMPARISONS_PASSED');
