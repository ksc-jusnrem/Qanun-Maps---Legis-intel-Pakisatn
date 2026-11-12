import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {attachFacsimileRelationships,validateFacsimileRelationships,renderFacsimileRelationships} from './facsimile-relationships.mjs';

const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function setup(t,page=1){
 const repoRoot=fs.mkdtempSync(path.join(os.tmpdir(),'facsimile-relationship-test-'));
 t.after(()=>{if(!path.resolve(repoRoot).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(repoRoot).startsWith('facsimile-relationship-test-'))throw Error('Unsafe temporary cleanup');fs.rmSync(repoRoot,{recursive:true,force:true});});
 const source={id:'source-law',title:'Source Ordinance, 2025',text:'Damaged OCR retained separately.'};source.text_sha256=sha(source.text);source.text_version_id='law:'+source.id+':'+source.text_sha256;
 const target={id:'target-law',title:'Target Constitution',text:'89. Power of President to promulgate Ordinances.'};target.text_sha256=sha(target.text);target.text_version_id='law:'+target.id+':'+target.text_sha256;
 const directory=path.join(repoRoot,'registers'),assetDir=path.join(repoRoot,'assets/source-law');fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(assetDir,{recursive:true});
 const pdf=Buffer.from('%PDF-1.7\noriginal source fixture'),png=Buffer.from('original image fixture'),name='page-'+String(page).padStart(3,'0')+'.png';
 fs.writeFileSync(path.join(assetDir,'original.pdf'),pdf);fs.writeFileSync(path.join(assetDir,name),png);
 const manifest={records:[{id:source.id,title:source.title,input_text_sha256:source.text_sha256,source_pdf_sha256:sha(pdf),original_url:'https://example.gov.test/original.pdf',asset_directory:'assets/source-law',pdf_asset:'original.pdf',pages:[{page,asset:name,sha256:sha(png)}]}]};
 const quote='in exercise of the powers conferred by Article 89';
 const row={source_id:source.id,source_title:source.title,source_page:page,printed_page:'721',source_provision:'Promulgating recital',relation:'cites_enabling_authority',target_id:target.id,target_title:target.title,target_provision:'Article 89(1)',quote,quote_sha256:sha(quote),source_pdf_sha256:sha(pdf),source_original_url:manifest.records[0].original_url,source_page_image:name,source_page_image_sha256:sha(png),reader_anchor:'source-page-'+String(page).padStart(3,'0'),image_href:'/sources/facsimiles/source-law/'+name,pdf_href:'/sources/facsimiles/source-law/original.pdf#page='+page,evidence_type:'visual_page_transcription',transcription_method:'Selected passage manually read; line wraps collapsed.',character_start:null,character_end:null,review_scope:'Selected passage only; no current-force certification.'};
 const proof={record_id:target.id,title:target.title,text_sha256:target.text_sha256,text_version_id:target.text_version_id,provision_number:'89',reader_anchor:'provision-89-0',character_start:0,character_end:Array.from(target.text).length,quote:target.text,quote_sha256:sha(target.text),review_scope:'Held target opening; current force not checked.'};
 const options={repoRoot,directory,manifest,relationships:{relationships:[row]},targets:[proof]},records=[source,target];
 const save=()=>{for(const [name,value]of[['manifest.json',manifest],['reviewed-relationships.json',options.relationships],['reviewed-target-passages.json',options.targets]])fs.writeFileSync(path.join(directory,name),JSON.stringify(value));};save();
 return{repoRoot,directory,records,options,row,proof,save,assetDir};
}
test('attaches visual evidence without inventing OCR offsets and renders both directions',t=>{
 const f=setup(t),g={statistics:{}};attachFacsimileRelationships(g,f.records,f.options);assert.equal(g.facsimile_relationships.length,1);const r=g.facsimile_relationships[0];
 assert.equal(r.character_start,null);assert.equal(r.character_end,null);assert.equal(r.target_evidence.record_id,'target-law');assert.match(r.source_reader_href,/#source-page-001$/);
 assert.match(renderFacsimileRelationships(f.records[0],g),/id="facsimile-relationships"/);assert.match(renderFacsimileRelationships(f.records[1],g),/references from other laws/);
 assert.deepEqual(validateFacsimileRelationships(g,f.records,f.options),{relationships:1,source_records:1,target_records:1});
});
test('physical original page107 is supported without assuming subset index1',t=>{
 const f=setup(t,107),g={};attachFacsimileRelationships(g,f.records,f.options);assert.match(g.facsimile_relationships[0].source_reader_href,/#source-page-107$/);assert.match(g.facsimile_relationships[0].pdf_href,/#page=107$/);
});
test('printed identity discrepancies remain unresolved and never acquire a canonical target',t=>{
 const f=setup(t);f.row.target_id=null;f.row.target_title='General Clauses Act, 1987 (X of 1897)';f.row.identity_status='Printed discrepancy retained; target unresolved.';const g={};attachFacsimileRelationships(g,f.records,f.options);
 assert.equal(g.facsimile_relationships[0].target_reader_href,null);assert.equal(g.facsimile_relationships[0].target_evidence,null);assert.match(renderFacsimileRelationships(f.records[0],g),/1987/);
 delete f.row.identity_status;assert.throws(()=>attachFacsimileRelationships({},f.records,f.options),/identity explanation/);
});
test('changed image, original PDF, quote and invented offsets each fail',t=>{
 const f=setup(t);fs.writeFileSync(path.join(f.assetDir,f.row.source_page_image),'changed');assert.throws(()=>attachFacsimileRelationships({},f.records,f.options),/bytes changed/);
 const h=setup(t);fs.writeFileSync(path.join(h.assetDir,'original.pdf'),'changed');assert.throws(()=>attachFacsimileRelationships({},h.records,h.options),/bytes changed/);
 const j=setup(t);j.row.quote='fabricated';assert.throws(()=>attachFacsimileRelationships({},j.records,j.options),/quote hash/);
 const k=setup(t);k.row.character_start=0;assert.throws(()=>attachFacsimileRelationships({},k.records,k.options),/invented text offsets/);
});
test('changed source identity, target version, target range and missing proof fail',t=>{
 const f=setup(t);f.records[0].title='Different law';assert.throws(()=>attachFacsimileRelationships({},f.records,f.options),/source record identity/);
 const g=setup(t);g.proof.text_version_id='wrong';assert.throws(()=>attachFacsimileRelationships({},g.records,g.options),/target record identity/);
 const h=setup(t);h.proof.character_start=1;assert.throws(()=>attachFacsimileRelationships({},h.records,h.options),/target passage mismatch/);
 const j=setup(t);j.options.targets=[];assert.throws(()=>attachFacsimileRelationships({},j.records,j.options),/missing reviewed target/);
});
test('runtime inputs refresh and stale attached relationships fail validation',t=>{
 const f=setup(t),o={repoRoot:f.repoRoot,directory:f.directory},g={};attachFacsimileRelationships(g,f.records,o);f.row.review_scope='Changed reviewed scope';f.save();assert.throws(()=>validateFacsimileRelationships(g,f.records,o),/differs from current source register/);attachFacsimileRelationships(g,f.records,o);assert.equal(g.facsimile_relationships[0].review_scope,'Changed reviewed scope');
});
test('generated anchors and public asset bytes are checked, not just file existence',t=>{
 const f=setup(t),g={};attachFacsimileRelationships(g,f.records,f.options);const output=path.join(f.repoRoot,'public');fs.mkdirSync(path.join(output,'laws'),{recursive:true});fs.writeFileSync(path.join(output,'laws/source-law.html'),'<span id="source-page-001"></span>');fs.writeFileSync(path.join(output,'laws/target-law.html'),'<span id="provision-89-0"></span>');const a=path.join(output,'sources/facsimiles/source-law');fs.mkdirSync(a,{recursive:true});fs.copyFileSync(path.join(f.assetDir,'original.pdf'),path.join(a,'original.pdf'));fs.copyFileSync(path.join(f.assetDir,f.row.source_page_image),path.join(a,f.row.source_page_image));
 validateFacsimileRelationships(g,f.records,{...f.options,output});fs.writeFileSync(path.join(a,f.row.source_page_image),'wrong bytes');assert.throws(()=>validateFacsimileRelationships(g,f.records,{...f.options,output}),/public asset bytes mismatch/);fs.writeFileSync(path.join(output,'laws/target-law.html'),'missing anchor');assert.throws(()=>validateFacsimileRelationships(g,f.records,{...f.options,output}),/generated reader anchor missing/);
});
