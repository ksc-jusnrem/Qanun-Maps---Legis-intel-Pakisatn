import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {digest} from './evidence-model.mjs';
const output=process.argv[2]||'landing-pages/qanun-maps';
const root=path.join(output,'laws');
const report={record_count:0,stored_law_text:0,source_notice:0,passages:0,collections:{},status:'PASS',scope:'Stored text, TXT bytes, version identity and Unicode/UTF-8 passage integrity; not legal completeness, authenticity or currency'};
for(const name of fs.readdirSync(root).filter(x=>x.endsWith('.json'))){
 const r=JSON.parse(fs.readFileSync(path.join(root,name),'utf8')),raw=fs.readFileSync(path.join(root,r.id+'.txt'));
 assert.equal(name,r.id+'.json');assert.equal(typeof r.text,'string');assert.ok(raw.equals(Buffer.from(r.text,'utf8')),r.id+' TXT differs');
 assert.equal(digest(raw),r.text_sha256,r.id+' hash');assert.equal(r.text_version_id,`law:${r.id}:sha256:${r.text_sha256}`);
 assert.ok(['stored_law_text','source_notice'].includes(r.content_kind));
 const points=Array.from(r.text),seen=new Set();let previous=0;
 for(const p of r.passages){
  assert.ok(Number.isSafeInteger(p.character_start)&&Number.isSafeInteger(p.character_end)&&p.character_start>=previous&&p.character_end>p.character_start&&p.character_end<=points.length);
  assert.ok(!seen.has(p.reader_fragment));seen.add(p.reader_fragment);
  const quote=points.slice(p.character_start,p.character_end).join('');assert.equal(digest(quote),p.passage_sha256);
  assert.equal(raw.subarray(p.utf8_byte_start,p.utf8_byte_end).toString('utf8'),quote);
  previous=p.character_end;report.passages++;
 }
 if(process.argv[2]){const html=fs.readFileSync(path.join(root,r.id+'.html'),'utf8');assert.ok(html.includes('Content extent'));assert.equal(html.includes('id="reader-search"'),r.content_kind==='stored_law_text');}
 report.record_count++;report[r.content_kind]++;report.collections[r.source_collection]=(report.collections[r.source_collection]||0)+1;
}
const cases=JSON.parse(fs.readFileSync(new URL('./case-discovery.json',import.meta.url),'utf8')).records;
report.judicial_discovery_records=cases.length;assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
for(const c of cases){for(const field of ['citedByCount','fullText','snippet','headnote','books'])assert.ok(!Object.hasOwn(c,field));assert.ok(c.evidence_status.includes('not checked'));}
fs.mkdirSync('work/remediation',{recursive:true});fs.writeFileSync('work/remediation/corpus-integrity.json',JSON.stringify(report,null,2));
console.log('REMEDIATION_CHECK_PASS '+JSON.stringify(report));
