import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getFacsimile,renderFacsimileReader} from './facsimile.mjs';
import {parseSections} from '../../qanun-release/section-navigation.mjs';
import {validateFacsimileManifest} from './facsimile-frame.mjs';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const folder=fileURLToPath(new URL('./facsimiles/',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const load=id=>JSON.parse(fs.readFileSync(new URL('../../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'));

test('facsimile readers contain every original page and retain original PDF and legacy header anchors',()=>{
 let pages=0;
 for(const f of manifest.records){
  const r=load(f.id),out=renderFacsimileReader(r);assert.equal(getFacsimile(f.id).source_pdf_sha256,f.source_pdf_sha256);
  assert.equal(sha(fs.readFileSync(path.join(folder,f.id,'original.pdf'))),f.source_pdf_sha256);
  assert.equal(out.report.source_facsimile_pages,f.page_count);assert.equal(out.report.source_body_text_unavailable,true);assert.equal(out.report.visible_content_preserved,null);assert.equal(out.report.body_text_checked,false);
  assert.equal((out.html.match(/<img /g)||[]).length,f.page_count);assert.equal((out.nav.match(/href="#source-page-/g)||[]).length,f.page_count);
  for(const [index,p] of f.pages.entries()){
   assert.equal(p.page,index+1);const bytes=fs.readFileSync(path.join(folder,f.id,p.asset));assert.equal(sha(bytes),p.sha256);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),p.width);assert.equal(bytes.readUInt32BE(20),p.height);
   assert.ok(out.html.includes('id="source-page-'+String(p.page).padStart(3,'0')+'"'));assert.ok(out.html.includes('/'+f.id+'/'+p.asset));
  }
  for(const p of r.passages||[])assert.ok(out.html.includes('id="'+p.reader_fragment+'"'));
  for(const p of parseSections(r).entries)assert.ok(out.html.includes('id="'+p.anchor+'"'));
  const raw=out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1].replace(/&(amp|lt|gt|quot|#39);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[n]));assert.equal(raw,r.text);
  const ids=[...out.html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);pages+=f.page_count;
 }
 assert.equal(pages,manifest.records.reduce((n,r)=>n+r.page_count,0));assert.ok(manifest.records.length>=4);
});

test('selected Act reader distinguishes logical pages, physical original volume and archived source edition',()=>{
 const f=getFacsimile('pk-code-4ff23b094ca55ea4'),out=renderFacsimileReader(load(f.id));
 assert.equal(f.page_count,59);assert.equal(f.original_pdf_page_count,281);assert.equal(f.pages[0].source_page,107);assert.equal(f.pages.at(-1).source_page,165);assert.equal(f.pages[0].printed_page,131);assert.equal(f.pages.at(-1).printed_page,189);
 assert.ok(out.html.includes('complete 281-page volume'));assert.ok(out.html.includes('Open complete original ECP volume (281 pages)'));assert.ok(out.html.includes('/original.pdf#page=107'));assert.ok(out.html.includes('/original.pdf#page=165'));assert.ok(out.html.includes('archived 2002 compilation'));assert.ok(out.html.includes('data-source-page="107" data-selected-page="1"'));assert.ok(out.html.includes('data-source-page="165" data-selected-page="59"'));
 assert.equal(out.report.original_pdf_page_count,281);assert.equal(out.report.source_page_start,107);assert.equal(out.report.source_page_end,165);assert.equal(out.report.selected_act_scope,f.selected_act_scope);
 const bad=structuredClone(f);bad.pages[0].source_page=1;assert.throws(()=>validateFacsimileManifest(bad),/physical page mapping/);
 assert.throws(()=>validateFacsimileManifest({...f,source_edition_note:null}),/edition note/);assert.throws(()=>validateFacsimileManifest({...f,selected_act_scope:null}),/explicit Act scope/);assert.throws(()=>validateFacsimileManifest({...f,original_pdf_page_count:59}),/page scope|page counts/);
});

test('facsimile asset publishing copies only verified original PDF and complete page allowlist',()=>{
 const f=manifest.records[0],r=load(f.id),output=fileURLToPath(new URL('./.facsimile-test-output-'+process.pid+'/',import.meta.url));
 assert.ok(output.startsWith(fileURLToPath(new URL('./',import.meta.url))));
 const destination=path.join(output,'sources','facsimiles',f.id);
 try{
  renderFacsimileReader(r,'/sources/facsimiles',{output});
  assert.deepEqual(fs.readdirSync(destination).sort(),['original.pdf',...f.pages.map(p=>p.asset)].sort());
  for(const asset of [{asset:'original.pdf',sha256:f.source_pdf_sha256},...f.pages])assert.equal(sha(fs.readFileSync(path.join(destination,asset.asset))),asset.sha256);
  assert.throws(()=>renderFacsimileReader(r,'/../escape',{output}),/Invalid facsimile public asset base/);
  assert.throws(()=>renderFacsimileReader({...r,text:r.text+'changed'}),/legacy text identity mismatch/);
 }finally{
  if(fs.existsSync(destination)){for(const name of fs.readdirSync(destination))fs.unlinkSync(path.join(destination,name));fs.rmdirSync(destination);fs.rmdirSync(path.dirname(destination));fs.rmdirSync(path.dirname(path.dirname(destination)));fs.rmdirSync(output);}
 }
});

test('facsimile reviewed relationships retain source-page proof and unresolved printed identities',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(folder,'reviewed-relationships.json'),'utf8'));assert.ok(data.relationships.length>=7);
 for(const r of data.relationships){const f=getFacsimile(r.source_id),p=f.pages.find(p=>p.page===r.source_page);assert.equal(r.quote_sha256,sha(r.quote));assert.equal(r.source_page_image_sha256,p.sha256);assert.equal(r.source_pdf_sha256,f.source_pdf_sha256);assert.equal(r.character_start,null);assert.equal(r.evidence_type,'visual_page_transcription');}
 const unresolved=data.relationships.filter(r=>!r.target_id);assert.equal(unresolved.length,2);assert.ok(unresolved.some(r=>r.target_title.includes('1987 (X of 1897)')));assert.ok(unresolved.some(r=>r.target_title.includes('2023 (V of 2023)')));
});
