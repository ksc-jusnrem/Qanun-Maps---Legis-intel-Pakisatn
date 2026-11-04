import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildEvidenceModel,exactExcerpt,digest} from './evidence-model.mjs';
import {renderInspector} from './evidence-inspector.mjs';
const input=()=>({statutes:JSON.parse(fs.readFileSync(new URL('./statute-rule-mappings.json',import.meta.url))),cases:JSON.parse(fs.readFileSync(new URL('./rule-case-mappings.json',import.meta.url))),readLaw:id=>({record:JSON.parse(fs.readFileSync(path.join('landing-pages/qanun-maps/laws',id+'.json'))),raw:fs.readFileSync(path.join('landing-pages/qanun-maps/laws',id+'.txt'))})});
test('Actual corpus produces eighteen separate evidence-backed assertions with explicit versions',()=>{
 const m=buildEvidenceModel(input());assert.equal(m.relationships.length,18);assert.equal(m.documents.filter(d=>d.kind==='judgment').length,5);assert.equal(m.documents.filter(d=>d.kind==='unresolved_instrument').length,1);
 assert.equal(m.excerpts.length,29);assert.equal(m.model_id,buildEvidenceModel(input()).model_id);assert.ok(m.relationships.every(e=>e.effective_at===null));
 assert.ok(m.excerpts.filter(e=>e.document_id.startsWith('judgment:')).every(e=>!e.full_text_rechecked));
 assert.match(m.relationships.find(e=>e.id==='act2025-partial-repeal').notes.join(' '),/not the whole|Not repeal of the entire/);
 assert.ok(m.relationships.find(e=>e.id==='rob-art99').notes.some(s=>s.includes('28 September 2026')));
});
test('Unicode offsets are code points; invalid bounds cannot silently truncate',()=>{
 assert.equal(exactExcerpt('A😀B',1,2,'😀'),digest('😀'));
 for(const [a,b,q] of [[-1,1,'A'],[0,4,'A😀B'],[0.1,1,'A'],[1,1,''],[0,1,'X']])assert.throws(()=>exactExcerpt('A😀B',a,b,q));
});
test('Substituted law text, quotations, versions, passage hashes and anchors fail closed',()=>{
 for(const mutate of [d=>{Object.values(d.statutes.evidence)[0].quote+='x';},d=>{d.statutes.nodes[0].text_sha256='a'.repeat(64);},d=>{Object.values(d.statutes.evidence)[0].passages[0].passage_sha256='b'.repeat(64);},d=>{Object.values(d.statutes.evidence)[0].passages[0].reader_url='https://evil.example/laws/x.html#x';}]) {const d=input();mutate(d);assert.throws(()=>buildEvidenceModel(d));}
 const d=input(),read=d.readLaw;d.readLaw=id=>({...read(id),raw:Buffer.from('substituted text')});assert.throws(()=>buildEvidenceModel(d),/hash mismatch/);
});
test('Dangling, swapped and duplicate identities cannot become verified relationships',()=>{
 for(const mutate of [d=>{d.statutes.edges[0].target='missing';},d=>{d.statutes.edges.push(d.statutes.edges[0]);},d=>{d.cases.cases.push(d.cases.cases[0]);},d=>{d.cases.links[0].law_id=d.cases.links[1].law_id+'x';},d=>{d.statutes.edges[0].evidence_ids=['newact-repeal'];},d=>{d.statutes.edges[0].effective_at='2025-05-29';}]){const d=input();mutate(d);assert.throws(()=>buildEvidenceModel(d));}
});
test('Judgment excerpt corruption fails while full-text review remains explicitly inherited',()=>{
 const d=input();d.cases.links[0].judgment_evidence.quote+='tampered';assert.throws(()=>buildEvidenceModel(d),/Judgment excerpt/);
});
test('Public projection excludes private fields and escapes hostile text',()=>{
 const d=input();d.statutes.nodes[0].private_manuscript='PRIVATE-MARKER';d.cases.cases[0].books='PRIVATE-MARKER';d.cases.cases[0].title='<img src=x onerror=alert(1)>';
 const m=buildEvidenceModel(d),html=renderInspector(m);assert.ok(!JSON.stringify(m).includes('PRIVATE-MARKER'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img src=x'));assert.equal((html.match(/data-evidence-detail=/g)||[]).length,18);
 assert.ok(html.includes('Permanent link'));assert.ok(html.includes(m.model_id));assert.ok(html.includes('full judgment not rechecked'));
});
