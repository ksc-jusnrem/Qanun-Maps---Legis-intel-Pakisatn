import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {enrichProvisionTargets} from './enrich-provisions.mjs';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function fixture(title='Target Act, 2000'){
 const text='1. Scope.\nApplies.\n2.\nDefinitions.—An actual source definition.';const start=text.indexOf('2.');
 const record={id:'target',title,text,text_sha256:sha(text),text_version_id:'law:target:'+sha(text),source_url:'https://example.gov/target',passages:[{character_start:0,character_end:text.length,reader_fragment:'p-source'}]};
 const ref={id:'external',source:'source',target:'target',provision_kind:'section',provision_number:'2',resolution:'operative_heading_not_identified',target_fragment:null,target_evidence:null};
 const graph={internal_references:[],external_references:[ref],coverage:{source:{internal:[],unresolved:['external']}},statistics:{}};
 const provision={scope:'main',kind:'Section',number:'2',character_start:start,character_end:text.length,anchor:'provision-2-'+start};
 return{record,ref,graph,provision};
}
test('cross-law enrichment uses exact target-record evidence and unique main heading',()=>{
 const {record,ref,graph,provision}=fixture();enrichProvisionTargets(graph,[record],new Map([['target',[provision]]]));
 assert.equal(ref.target_fragment,provision.anchor);assert.equal(ref.target_evidence.record_id,'target');assert.equal(ref.target_evidence.quote,record.text.slice(provision.character_start));assert.equal(ref.target_evidence.quote_sha256,sha(ref.target_evidence.quote));assert.equal(ref.resolution_scope,'numbered_heading_only');assert.deepEqual(graph.coverage.source.unresolved,[]);
});
test('schedule duplication does not replace a main provision and multiple main candidates remain unresolved',()=>{
 const f=fixture();enrichProvisionTargets(f.graph,[f.record],new Map([['target',[{...f.provision,scope:'schedule-1'}]]]));assert.equal(f.ref.target_fragment,null);
 enrichProvisionTargets(f.graph,[f.record],new Map([['target',[f.provision,{...f.provision,anchor:'duplicate'}]]]));assert.equal(f.ref.target_fragment,null);
});
test('amending instruments, wrong provision kind and ambiguous source editions cannot be upgraded',()=>{
 const f=fixture('Target (Amendment) Act, 2000');enrichProvisionTargets(f.graph,[f.record],new Map([['target',[f.provision]]]));assert.equal(f.ref.target_fragment,null);
 f.record.title='Target Act, 2000';f.provision.kind='Rule';enrichProvisionTargets(f.graph,[f.record],new Map([['target',[f.provision]]]));assert.equal(f.ref.target_fragment,null);
 f.provision.kind='Section';f.ref.resolution='ambiguous_source_editions';enrichProvisionTargets(f.graph,[f.record],new Map([['target',[f.provision]]]));assert.equal(f.ref.target_fragment,null);
});
