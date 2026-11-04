import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {loadEvidenceModel} from './evidence-model.mjs';
import {escape} from './evidence-inspector.mjs';
const output=process.argv[2];
if(!output) throw Error('Provide generated public output');
const m=loadEvidenceModel(output),html=fs.readFileSync(path.join(output,'mappings.html'),'utf8');
assert.equal((html.match(/data-evidence-detail=/g)||[]).length,m.relationships.length);
assert.equal((html.match(/data-evidence-select=/g)||[]).length,m.relationships.length);
assert.ok(html.includes(`data-model-id="${m.model_id}"`));
const referenced=new Set(m.relationships.flatMap(e=>e.evidence_ids));
assert.ok(referenced.size>0); // Other source excerpts may describe unlinked powers; only linked evidence is rendered here.
for(const e of m.excerpts.filter(e=>referenced.has(e.id))){assert.ok(html.includes(escape(e.quote)),e.id);for(const link of e.anchors.filter(x=>x.startsWith('/laws/'))){const [reader,fragment]=link.split('#');assert.ok(fs.readFileSync(path.join(output,reader+'.html'),'utf8').includes(`id="${fragment}"`));}}
const policy=JSON.parse(fs.readFileSync('vercel.json','utf8')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
assert.equal((html.match(/<script>/g)||[]).length,1);
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.ok(policy.includes('sha256-'+crypto.createHash('sha256').update(match[1]).digest('base64')),'Inspector script CSP mismatch');
for(const e of m.relationships)assert.ok(html.includes(`relationship=${e.id}#evidence-inspector`));
console.log(`EVIDENCE_INTEGRATION_PASS: ${m.relationships.length} relationships, ${referenced.size} linked excerpts, reader anchors, pinned links and exact script CSP`);
