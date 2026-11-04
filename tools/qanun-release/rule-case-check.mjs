import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ruleCaseData as d,validateLawEvidence} from './rule-case-panels.mjs';
const mode=process.argv[2],root=process.cwd(),baseline=path.join(root,'landing-pages/qanun-maps');
const out=process.argv[3]||path.join(root,'work/rule-case-preview');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const cat=read(new URL('./catalogue.json',import.meta.url));
if(mode==='inventory'){
 const expected=cat.filter(c=>/\b(rules?|orders?)\b/i.test(c.title)).map(c=>c.id).sort();
 assert.deepEqual(d.inventory.map(i=>i.id).sort(),expected);
 assert.equal(new Set(d.inventory.map(i=>i.id)).size,d.inventory.length);
 for(const i of d.inventory){const r=read(path.join(baseline,'laws',i.id+'.json'));assert.equal(i.text_sha256,r.text_sha256);assert.equal(i.text_version_id,r.text_version_id);assert.equal(i.current_force,null);assert.ok(i.disposition);if(i.kind==='excluded_title_match'){assert.match(i.title,/\b(Act|Ordinance)\b/i);}else {assert.ok(i.authority_note);validateLawEvidence(i.authority_evidence,baseline);}}
 assert.equal(d.inventory.filter(i=>i.kind==='rules_or_order').length,15);
 console.log('RULE_INVENTORY_PASS: '+d.inventory.length+' candidates, 15 rules/orders, 23 excluded Acts/Ordinances');
}else if(mode==='evidence'){
 const cases=new Map(d.cases.map(c=>[c.id,c]));assert.equal(cases.size,d.cases.length);
 for(const c of d.cases){let j=read(path.join(root,'work/rule-case-completion/sources',c.source_file));if(j.content)j=JSON.parse(j.content[0].text);assert.equal(hash(j.text),c.judgment_text_sha256);assert.ok(!j.text_truncated);for(const id of c.links){const l=d.links.find(l=>l.id===id);assert.equal(l.case_id,c.id);assert.equal(Array.from(j.text).slice(l.judgment_evidence.character_start,l.judgment_evidence.character_end).join(''),l.judgment_evidence.quote);assert.equal(hash(l.judgment_evidence.quote),l.judgment_evidence.sha256);assert.ok(l.judgment_pinpoint&&l.version_note);validateLawEvidence(l.law_evidence,baseline);}}
 for(const l of d.links){assert.equal(l.law_id,l.law_evidence.law_id);assert.ok(d.inventory.find(i=>i.id===l.law_id).case_links.includes(l.id));}
 assert.equal(cases.get('sc-mustafa-impex-ca1428-2016').decision_date,'2016-08-18');
 assert.equal(cases.get('ihc-farrukh-wp1-2020').decision_date,null);
 assert.equal(cases.get('phc-shahjehan-ca84-2011').decision_date,'2011-10-26');
 const bad=structuredClone(d.links[0].law_evidence);bad.quote='Incorrect substituted provision';assert.throws(()=>validateLawEvidence(bad,baseline));
 const swapped=structuredClone(d.links[0].law_evidence);swapped.law_id='pk-code-a3869310f6800995';assert.throws(()=>validateLawEvidence(swapped,baseline));
 console.log('RULE_EVIDENCE_PASS: exact judgment/provision hashes and ranges, case identity/date controls, wrong-quote and swapped-instrument negative controls');
}else if(mode==='integration'){
 const mp=fs.readFileSync(path.join(out,'mappings.html'),'utf8'),cp=fs.readFileSync(path.join(out,'case-law.html'),'utf8');
 for(const c of d.cases)assert.ok(cp.includes(`id="reviewed-${c.id}"`));
 for(const l of d.links){const rp=fs.readFileSync(path.join(out,'laws',l.law_id+'.html'),'utf8');assert.ok(mp.includes(`id="rule-case-${l.id}"`));assert.ok(mp.includes(`/case-law#reviewed-${l.case_id}`));assert.ok(cp.includes(`/mappings#rule-case-${l.id}`));assert.ok(rp.includes(`/mappings#rule-case-${l.id}`));for(const p of l.law_evidence.passages)assert.ok(rp.includes(`id="${p.fragment}"`));}
 for(const i of d.inventory.filter(i=>i.kind==='rules_or_order'))assert.ok(mp.includes(`id="coverage-${i.id}"`));
 assert.ok(cp.includes('judgment not checked'));assert.ok(mp.includes('Case mapping unresolved'));assert.ok(cp.includes('No automatic merging'));
 console.log('RULE_INTEGRATION_PASS: reciprocal rule/case/provision anchors, coverage and evidence distinctions');
}else if(mode==='release'){
 const r=read(new URL('./integration-manifest.json',import.meta.url));assert.equal(r.record_count,1732);assert.equal(r.law_text_count,1728);assert.equal(r.public_file_count,5207);assert.equal(r.research.rule_cases.case_relationship_count,9);assert.equal(r.research.rule_cases.reviewed_case_count,5);assert.ok(r.download_bytes_unchanged&&r.source_text_characters_unchanged);
 const result=spawnSync(process.execPath,['tools/qanun-release/research-check.mjs',out],{stdio:'inherit'});assert.equal(result.status,0);
 const policy=read('vercel.json').headers.flatMap(x=>x.headers).find(h=>h.key==='Content-Security-Policy').value;
 for(const p of ['index.html','case-law.html','laws/pk-code-6c462b7d924dbbe3.html']){const html=fs.readFileSync(path.join(out,p),'utf8');for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){assert.ok(policy.includes('sha256-'+crypto.createHash('sha256').update(m[1]).digest('base64')),'Inline script must be allowed by CSP: '+p);}}
 for(const i of d.inventory){assert.deepEqual(fs.readFileSync(path.join(out,'laws',i.id+'.json')),fs.readFileSync(path.join(baseline,'laws',i.id+'.json')));}
 assert.equal(cat.find(c=>c.id==='pk-code-4774a7711e72e080').type,'Ordinance');assert.equal(cat.find(c=>c.id==='pk-code-fc441e1e0e53090d').type,'Act');
 console.log('RULE_RELEASE_PASS: source preservation, 1732 readers, separate discovery identities, corrected classifications');
}else throw Error('Use inventory, evidence, integration or release');
