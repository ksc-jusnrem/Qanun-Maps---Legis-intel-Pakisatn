import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadSourceReaderInputs,verifyFacsimileOutput} from './source-inputs.mjs';
import {renderLibraryReader} from './reader.mjs';
import {renderFacsimileReader} from './facsimile.mjs';
const json=u=>JSON.parse(fs.readFileSync(new URL(u,import.meta.url),'utf8'));
const load=id=>json('../../../landing-pages/qanun-maps/laws/'+id+'.json');
const audit=json('../source-status.json');
const layouts=json('./verified-layouts/manifest.json');
const facsimiles=json('./facsimiles/manifest.json');

test('source input loader binds six readable layouts to record, independent layout and audited PDF hashes',()=>{
 let count=0;
 for(const e of layouts.records){const r=load(e.id),s=audit.records[e.id],out=loadSourceReaderInputs(r,s);
  if(e.reading_status==='source_derived_readable_layout'){assert.ok(out.sourceLayoutText);assert.equal(renderLibraryReader(r,out).report.visible_punctuation_preserved,true);count++;
   assert.throws(()=>loadSourceReaderInputs(r,{...s,original:{...s.original,sha256:'0'.repeat(64)}}),/original PDF binding mismatch/);
   assert.throws(()=>loadSourceReaderInputs(r,{...s,stored_text_sha256:'0'.repeat(64)}),/audit input binding mismatch/);
  }else assert.equal(out.sourceLayoutText,undefined,'Image headers must not be loaded as readable body');
 }
 assert.equal(count,6);assert.throws(()=>loadSourceReaderInputs({...load(layouts.records[0].id),text:'changed'},{}),/record hash mismatch/);
});

test('source input loader accepts source pagination only for exact input and original PDF binding',()=>{
 const pagination=json('../source-pagination.json');const [id,p]=Object.entries(pagination.records).find(([id,p])=>audit.records[id]?.original?.sha256===p.source_pdf_sha256&&audit.records[id]?.stored_text_sha256===p.input_text_sha256);
 const r=load(id),s=audit.records[id],out=loadSourceReaderInputs(r,s);assert.ok(out.sourceArtifacts.length>0);assert.equal(out.sourceArtifacts.length,p.artifacts.length);assert.equal(renderLibraryReader(r,out).report.visible_punctuation_preserved,true);
 assert.deepEqual(loadSourceReaderInputs(r,{...s,original:{...s.original,sha256:'0'.repeat(64)}}).sourceArtifacts,[]);
 assert.deepEqual(loadSourceReaderInputs(r,{...s,stored_text_sha256:'0'.repeat(64)}).sourceArtifacts,[]);
});

test('facsimile output verifier checks every published image and original PDF without false text claims',()=>{
 const output=fileURLToPath(new URL('./.source-inputs-test-output-'+process.pid+'/',import.meta.url));assert.ok(output.startsWith(fileURLToPath(new URL('./',import.meta.url))));let pages=0;
 try{for(const f of facsimiles.records){const r=load(f.id),out=renderFacsimileReader(r,'/sources/facsimiles',{output});const verified=verifyFacsimileOutput(r,out.html,out.report,output);pages+=verified.source_facsimile_pages;
  assert.throws(()=>verifyFacsimileOutput(r,out.html,{...out.report,visible_content_preserved:true},output));
  assert.throws(()=>verifyFacsimileOutput(r,out.html.replace('id="source-page-002"','id="page-lost"'),out.report,output),/Missing original-page anchor/);
  if(f.selected_act_scope){assert.throws(()=>verifyFacsimileOutput(r,out.html.replace('data-source-page="107"','data-source-page="1"'),out.report,output),/Physical source PDF page mapping changed/);assert.throws(()=>verifyFacsimileOutput(r,out.html,{...out.report,original_pdf_page_count:59},output),/source scope mismatch/);}
  assert.throws(()=>verifyFacsimileOutput(r,out.html.replace('/page-002.png','/page-003.png'),out.report,output));
  const asset=path.join(output,'sources','facsimiles',f.id,f.pages[0].asset),bytes=fs.readFileSync(asset);fs.writeFileSync(asset,Buffer.from('changed'));assert.throws(()=>verifyFacsimileOutput(r,out.html,out.report,output),/Published original image changed/);fs.writeFileSync(asset,bytes);
 }}finally{for(const f of facsimiles.records){const folder=path.join(output,'sources','facsimiles',f.id);if(fs.existsSync(folder)){for(const file of fs.readdirSync(folder))fs.unlinkSync(path.join(folder,file));fs.rmdirSync(folder);}}if(fs.existsSync(output)){fs.rmdirSync(path.join(output,'sources','facsimiles'));fs.rmdirSync(path.join(output,'sources'));fs.rmdirSync(output);}}
 assert.equal(pages,facsimiles.records.reduce((n,r)=>n+r.page_count,0));assert.ok(facsimiles.records.some(r=>r.id==='pk-code-c02eccd95b859b79'));
});
