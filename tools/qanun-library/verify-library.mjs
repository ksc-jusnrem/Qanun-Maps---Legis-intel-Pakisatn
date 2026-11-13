import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyLibraryGraph} from './mapping/mapping.mjs';
import {historicalProvisionAnchors} from './historical-anchors.mjs';
import {displayRecordTitle} from './record-display.mjs';
import {verifyFacsimileOutput} from './reader/source-inputs.mjs';
import {validateFacsimileRelationships} from './mapping/facsimile-relationships.mjs';
import {getSourceSupplement,verifySourceSupplementsOutput} from './reader/supplements.mjs';
import {readerRoutes} from '../qanun-release/reader-routes.mjs';
import {readerEditionSummary} from '../qanun-release/reader-experience.mjs';

const output=path.resolve(process.argv[2]||'work/library-repair/public');
const laws=path.join(output,'laws');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#39|#x[\da-f]+|#\d+);/gi,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[v]??String.fromCodePoint(parseInt(v.slice(v[2]==='x'?3:2,-1),v[2]==='x'?16:10))));
const files=fs.readdirSync(laws).filter(n=>n.endsWith('.json'));
const records=files.map(n=>JSON.parse(fs.readFileSync(path.join(laws,n),'utf8')));
const effectiveRecords=records.map(r=>{const record=fs.existsSync(path.join(output,'reading-records',r.id+'.json'))?JSON.parse(fs.readFileSync(path.join(output,'reading-records',r.id+'.json'),'utf8')):r;return{...record,title:displayRecordTitle(record)};});
const graph=JSON.parse(fs.readFileSync(new URL('./library-graph-verification.json',import.meta.url),'utf8'));
const sourceAudit=JSON.parse(fs.readFileSync(path.join(output,'data/source-verification.json'),'utf8'));
const report=JSON.parse(fs.readFileSync(new URL('./library-integration-report.json',import.meta.url),'utf8'));
assert.equal(records.length,report.records);
const byId=new Map(effectiveRecords.map(r=>[r.id,r]));
const readerReports=new Map(report.readers.map(r=>[r.id,r]));
assert.equal(readerReports.size,records.length);
const pointCache=new Map();const characters=r=>{if(pointCache.has(r.id))return pointCache.get(r.id);if(pointCache.size>=8)pointCache.delete(pointCache.keys().next().value);const cp=Array.from(r.text);pointCache.set(r.id,cp);return cp;};
const anchorSets=new Map();let passages=0,provisions=0,notices=0,facsimiles=0,sourcePages=0;
for(const r of records){
 const html=fs.readFileSync(path.join(laws,r.id+'.html'),'utf8');
 const raw=fs.readFileSync(path.join(laws,r.id+'.txt'));
 assert.ok(html.includes(readerEditionSummary(byId.get(r.id),sourceAudit.records[r.id])),'Missing or incorrect early edition summary '+r.id);
 assert.ok(html.indexOf('class="reader-edition-summary"')<html.indexOf('id="law-text"'),'Edition summary appears after legal text '+r.id);
 const canonical=readerRoutes[r.id];assert.ok(canonical,'Missing canonical reader '+r.id);
 assert.ok(html.includes('rel="canonical" href="https://www.jusnrem.legal'+canonical+'"'),'Incorrect reader canonical '+r.id);
 assert.equal(fs.readFileSync(path.join(output,canonical.slice(1)+'.html'),'utf8'),html,'Canonical reader differs or loses historical anchors '+r.id);
 assert.equal(sha(raw),r.text_sha256,'Raw source changed '+r.id);
 assert.equal(raw.toString('utf8'),r.text,'Record and download differ '+r.id);
 const transcription=html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/);
 assert.ok(transcription,'Missing exact transcription '+r.id);
 assert.equal(decode(transcription[1].replace(/<\/?span\b[^>]*>/g,'')),r.text,'Original transcription differs '+r.id);
 const rr=readerReports.get(r.id);
 if(getSourceSupplement(r.id))verifySourceSupplementsOutput(byId.get(r.id),html,rr,output);
 if(rr.kind==='original_facsimile'){verifyFacsimileOutput(r,html,rr,output);facsimiles++;sourcePages+=rr.source_facsimile_pages;}
 else assert.ok(html.includes('<div id="law-text" class="reader-text structured-law"'),'Unstructured reader '+r.id);
 assert.ok(!html.includes('<pre id="law-text"'),'Legacy raw reader still main content '+r.id);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 const set=new Set(ids);assert.equal(set.size,ids.length,'Duplicate HTML IDs '+r.id);anchorSets.set(r.id,set);
 for(const old of historicalProvisionAnchors(r.id,r))assert.ok(set.has(old),'Lost previously published provision anchor '+r.id+' '+old);
 for(const p of r.passages){assert.ok(set.has(p.reader_fragment),'Lost passage anchor '+r.id+' '+p.reader_fragment);passages++;}
 for(const link of html.matchAll(/href="#([^"]+)"/g))assert.ok(set.has(decode(link[1])),'Broken local anchor '+r.id+' '+link[1]);
 assert.ok(set.has('library-relationships'),'No per-law mapping '+r.id);
 assert.ok(fs.existsSync(path.join(output,'law-maps',r.id+'.json')),'No per-law evidence download '+r.id);
 assert.ok(set.has('original-source-check'),'No original-source evidence '+r.id);
 assert.equal(rr.input_sha256,byId.get(r.id).text_sha256,'Stale reader report '+r.id);
 if(rr.kind!=='original_facsimile'){
 assert.equal(rr.visible_content_preserved,true,'Reading omitted or changed substantive characters '+r.id);
 assert.equal(rr.visible_punctuation_preserved,true,'Reading changed punctuation outside declared heading layout '+r.id);
 assert.equal(rr.retained_content_sha256,rr.rendered_content_sha256,'Visible reader differs from retained source '+r.id);
 }
 assert.ok(sourceAudit.records[r.id],'Missing original-source audit row '+r.id);
 if(r.content_kind==='source_notice'){notices++;assert.ok(html.includes('source notice'),'Notice treated as law '+r.id);}
 provisions+=rr.provision_count||0;
}
verifyLibraryGraph(effectiveRecords,graph);
const originalPageMappings=validateFacsimileRelationships(graph,effectiveRecords,{output});
for(const relationship of [...graph.citations,...graph.internal_references,...(graph.external_references||[]),...graph.unresolved]){
 for(const e of [relationship.evidence,relationship.instrument_evidence,relationship.context_evidence,relationship.target_evidence].filter(Boolean)){
  const record=byId.get(e.record_id);assert.ok(record);
  assert.equal(characters(record).slice(e.character_start,e.character_end).join(''),e.quote,'Citation evidence changed '+relationship.id);
  assert.equal(sha(e.quote),e.quote_sha256,'Citation evidence hash changed '+relationship.id);
  assert.ok(anchorSets.get(e.record_id).has(e.reader_fragment),'Citation source anchor missing '+relationship.id);
 }
 if(relationship.target_fragment)assert.ok(anchorSets.get(relationship.target).has(relationship.target_fragment),'Target provision anchor missing '+relationship.id);
}
const map=fs.readFileSync(path.join(output,'library-map.html'),'utf8');
assert.equal((map.match(/data-map-law=/g)||[]).length,records.length,'Map omits records');
assert.ok(fs.readFileSync(path.join(output,'mappings.html'),'utf8').includes('href="/library-map"'),'Map discovery link absent');
const serialized=JSON.stringify(sourceAudit);assert.ok(!/[A-Z]:[\\/]/.test(serialized),'Private local path published in source register');
assert.ok(!fs.existsSync(path.join(output,'tools')),'Private tooling published');
const summary={records:records.length,readable_laws:records.length-notices,source_notices:notices,original_facsimiles:facsimiles,source_pages:sourcePages,legacy_passages:passages,identified_provisions:provisions,original_page_mappings:originalPageMappings,graph:graph.statistics};
fs.mkdirSync('work/library-repair',{recursive:true});fs.writeFileSync('work/library-repair/integration-verification.json',JSON.stringify(summary,null,2));
console.log('LIBRARY_INTEGRATION_PASSED '+JSON.stringify(summary));
