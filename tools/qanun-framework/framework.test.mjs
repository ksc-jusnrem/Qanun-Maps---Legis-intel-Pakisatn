import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createService} from './service.mjs';
import {assessRule} from './assessment.mjs';
import {digest} from '../qanun-release/evidence-model.mjs';
const service=createService('landing-pages/qanun-maps'),m=service.model;
test('all source links become separately versioned research propositions',()=>{
 const source=JSON.parse(fs.readFileSync('tools/qanun-release/rule-case-mappings.json'));
 assert.equal(m.rules.length,source.links.length);assert.equal(new Set(m.rules.map(r=>r.id)).size,m.rules.length);
 for(const r of m.rules){assert.equal(r.review.structured_rule,'awaiting legal review');assert.equal(r.time.current_force,null);assert.equal(r.scope.jurisdiction,null);assert.equal(digest(r.authority.evidence.quote),r.authority.evidence.quote_sha256);assert.ok(r.evidence_ids.every(id=>m.evidence.excerpts.some(x=>x.id===id)));}
});
test('missing, unsupported, disputed and contradicted evidence never becomes an affirmative legal answer',()=>{
 const r=m.rules[0];assert.equal(assessRule(r).missing.length,r.conditions.length);
 const facts=Object.fromEntries(r.conditions.map(c=>[c.id,{status:'supported',evidence:''}]));assert.equal(assessRule(r,facts).missing.length,r.conditions.length);
 for(const c of r.conditions)facts[c.id].evidence='User document 1, paragraph 2';assert.equal(assessRule(r,facts).missing.length,0);assert.equal(assessRule(r,facts).outcome,'UNDETERMINED');
 facts[r.conditions[0].id]={status:'disputed'};assert.equal(assessRule(r,facts).disputed.length,1);
 facts[r.conditions[0].id]={status:'contradicted',evidence:'Record A'};assert.equal(assessRule(r,facts).contradicted.length,1);
 assert.throws(()=>assessRule(r,{invented:{status:'supported'}}));assert.throws(()=>assessRule(r,{[r.conditions[0].id]:{status:true}}));
});
test('exact passage retrieval rejects wrong versions and traversal',()=>{
 const r=m.rules[0],x=m.evidence.excerpts.find(x=>x.document_id===r.instrument_id),fragment=x.anchors[0].split('#')[1];
 const data=service.call('get_provision',{instrument_id:r.instrument_id,version_id:r.version_id,fragment}).data;
 assert.equal(digest(data.quote),data.quote_sha256);assert.throws(()=>service.call('get_provision',{instrument_id:r.instrument_id,version_id:'wrong',fragment}));assert.throws(()=>service.call('find_cases',{instrument_id:'../../private'}));
});
test('all research operations execute and disclose unavailable comparisons',()=>{
 const r=m.rules[0];assert.equal(service.call('get_rule',{rule_id:r.id}).data.id,r.id);
 assert.equal(service.call('assess_rule',{rule_id:r.id,facts:{}}).data.outcome,'UNDETERMINED');
 assert.ok(service.call('find_legislation',{query:'Rules of Business'}).data.results.some(x=>x.id===r.instrument_id));
 assert.ok(service.call('find_cases',{instrument_id:r.instrument_id}).data.length);
 assert.equal(service.call('get_mapping_evidence',{relationship_id:r.case_relationships[0].relationship_id}).data.excerpts.length,2);
 assert.equal(service.call('compare_versions',{instrument_id:r.instrument_id,from_version:r.version_id,to_version:'absent'}).data.status,'COMPARISON_UNAVAILABLE');
 assert.equal(service.call('compare_versions',{instrument_id:r.instrument_id,from_version:r.version_id,to_version:r.version_id}).data.status,'SAME_HELD_VERSION');
 assert.equal(service.call('coverage_gaps',{}).data.unresolved.length,m.coverage.filter(c=>!c.rule_ids.length).length);
 assert.throws(()=>service.call('get_rule',{rule_id:r.id,extra:true}));assert.throws(()=>service.call('get_rule',{rule_id:'missing'}));
});
test('Drive section candidates remain unsigned and source identities reconcile',()=>{
 const data=JSON.parse(fs.readFileSync('tools/qanun-framework/section-candidates.json'));
 assert.equal(data.records.length,data.provenance.records);assert.equal(data.records.reduce((n,r)=>n+r.sections.length,0),data.provenance.sections);assert.deepEqual(data.provenance.mismatches,[]);
 for(const r of data.records){assert.equal(r.sign_off,null);assert.equal(r.title_match,true);assert.ok(r.sections.every(s=>s.effect==='unsigned'));}
 const result=service.call('find_provisions',{query:'commencement'}).data;assert.ok(result.matches>0);assert.match(result.results[0].status,/not independently verified/);
});
