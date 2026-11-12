import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createService} from '../qanun-framework/service.mjs';
import {digest} from './evidence-model.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qanun-remediation-'));
fs.mkdirSync(path.join(root,'laws'));
const links=JSON.parse(fs.readFileSync(new URL('./rule-case-mappings.json',import.meta.url)));
const statutes=JSON.parse(fs.readFileSync(new URL('./statute-rule-mappings.json',import.meta.url)));
const ids=new Set([...links.links.map(x=>x.law_id),...statutes.nodes.filter(x=>x.node_kind==='owned_instrument').map(x=>x.id)]);
for(const id of ids)for(const ext of ['json','txt'])fs.copyFileSync(path.join('landing-pages/qanun-maps/laws',id+'.'+ext),path.join(root,'laws',id+'.'+ext));
const service=createService(root);
function fixture(kind='stored_law_text'){
 const text='A person shall not enter. درخواست 😀 30 days.',hash=digest(text),quote='enter.',start=Array.from(text.slice(0,text.indexOf(quote))).length;
 const r={id:'test-evidence',title:'Test evidence',text,content_kind:kind,text_sha256:hash,text_version_id:`law:test-evidence:sha256:${hash}`,passages:[{reader_fragment:'test-passage',character_start:start,character_end:start+quote.length,passage_sha256:digest(quote)}]};
 fs.writeFileSync(path.join(root,'laws/test-evidence.json'),JSON.stringify(r));fs.writeFileSync(path.join(root,'laws/test-evidence.txt'),text);return r;
}
const request=r=>({instrument_id:r.id,version_id:r.text_version_id,fragment:'test-passage'});
test('a located substring retains governing negation and is never called legally faithful',()=>{
 const r=fixture(),d=service.call('get_provision',request(r)).data;
 assert.equal(d.quote,'enter.');assert.match(d.context.before,/shall not/);assert.match(d.context.after,/درخواست 😀 30 days/);
 assert.match(d.quotation_status,/legal meaning and contextual sufficiency not verified/);assert.match(d.offset_convention,/Unicode code points/);
 assert.equal(d.current_force,null);assert.equal(d.content_extent,null);
});
test('altered numerals, wrong versions, forged version identity, bad passage hash and download disagreement fail',()=>{
 let r=fixture();r.text=r.text.replace('30 days','60 days');fs.writeFileSync(path.join(root,'laws/test-evidence.json'),JSON.stringify(r));assert.throws(()=>service.call('get_provision',request(r)),/integrity/);
 r=fixture();assert.throws(()=>service.call('get_provision',{...request(r),version_id:'wrong'}),/version/);
 r.text_version_id='forged';fs.writeFileSync(path.join(root,'laws/test-evidence.json'),JSON.stringify(r));assert.throws(()=>service.call('get_provision',request(r)),/integrity/);
 r=fixture();r.passages[0].passage_sha256='0'.repeat(64);fs.writeFileSync(path.join(root,'laws/test-evidence.json'),JSON.stringify(r));assert.throws(()=>service.call('get_provision',request(r)),/Passage integrity/);
 r=fixture();fs.writeFileSync(path.join(root,'laws/test-evidence.txt'),'different download');assert.throws(()=>service.call('get_provision',request(r)),/download mismatch/);
});
test('source notices cannot be returned as legislation passages',()=>{const r=fixture('source_notice');assert.throws(()=>service.call('get_provision',request(r)),/source notice/);});
test('missing facts, unencoded provisions and unsupported date arguments cannot produce affirmative outcomes',()=>{
 const r=service.model.rules[0];assert.equal(service.call('assess_rule',{rule_id:r.id,facts:{}}).data.outcome,'UNDETERMINED');
 for(const rule_id of ['Article 9','Article 2',''])assert.throws(()=>service.call('assess_rule',{rule_id,facts:{}}));
 for(const date of ['1900-01-01','2026-01-01','invalid'])assert.throws(()=>service.call('assess_rule',{rule_id:r.id,facts:{},date}),/Unknown argument/);
 assert.throws(()=>service.call('assess_rule',{rule_id:r.id,facts:{[r.conditions[0].id]:false}}));
});
test('connector draft search accepts instrument titles consistently with the public search',()=>{
 assert.ok(service.call('find_provisions',{query:'Rules of Business'}).data.matches>0);
 assert.throws(()=>service.call('find_provisions',{query:'commencement',instrument_id:'missing'}));
});
function readerHarness(extraHeadings=[],extraPassages=[]){
 const node=()=>({value:'',children:[],events:{},hidden:true,textContent:'',addEventListener(n,f){this.events[n]=f;},replaceChildren(){this.children=[];},append(...x){this.children.push(...x);},focus(){this.focused=true;}});
 const elements=Object.fromEntries(['catalogue-return','reader-search','reader-query','reader-search-status','reader-search-results','reader-search-clear'].map(x=>[x,node()]));
 const heading={textContent:'Rule 16 — Cabinet consideration',getAttribute:()=> '#provision-16'};
 const passage={id:'p-1',textContent:'A person shall not enter. درخواست 😀 30 days.'};
 const document={getElementById:id=>elements[id],querySelectorAll:s=>s.startsWith('nav')?[heading,...extraHeadings]:[passage,...extraPassages],createElement:node};
 vm.runInNewContext(fs.readFileSync(new URL('./reader-ui.js',import.meta.url),'utf8'),{document,location:{search:''},URLSearchParams,URL});
 const search=q=>{elements['reader-query'].value=q;elements['reader-search'].events.submit({preventDefault(){}});};
 return {elements,search,passage};
}
test('reader searches headings and Unicode passages, clears results and preserves the original text',()=>{
 const {elements:e,search,passage}=readerHarness();const original=passage.textContent;
 search('Rule 16');assert.match(e['reader-search-status'].textContent,/1 matching/);assert.equal(e['reader-search-results'].children[0].children[0].href,'#provision-16');
 search('درخواست 😀');assert.equal(e['reader-search-results'].children[0].children[0].href,'#p-1');
 search('zzzxqnomatch');assert.match(e['reader-search-status'].textContent,/0 matching/);assert.equal(e['reader-search-results'].children.length,0);
 search('<script>');assert.equal(e['reader-search-results'].children.length,0);
 e['reader-search-clear'].events.click();assert.equal(e['reader-query'].value,'');assert.match(e['reader-search-status'].textContent,/Enter a provision/);assert.equal(passage.textContent,original);
});
test('numbered provision search does not confuse section 42 with 142, 420 or 42A',()=>{
 const headings=['42','142','420','42A'].map(n=>({textContent:'Section '+n+' — Example',getAttribute:()=> '#section-'+n}));
 const {elements:e,search}=readerHarness(headings);
 search('section 42');assert.equal(e['reader-search-results'].children.length,1);assert.equal(e['reader-search-results'].children[0].children[0].href,'#section-42');
 search('section 42a');assert.equal(e['reader-search-results'].children[0].children[0].href,'#section-42A');
});
test('all text matches are reachable and a new query or clear resets pagination',()=>{
 const passages=Array.from({length:45},(_,i)=>({id:'p-extra-'+i,textContent:'Repeated result '+i}));
 const {elements:e,search}=readerHarness([],passages);
 const more=e['reader-search'].children.find(n=>n.id==='reader-search-more');
 search('Repeated');assert.equal(e['reader-search-results'].children.length,20);assert.equal(more.hidden,false);
 more.events.click();assert.equal(e['reader-search-results'].children.length,40);assert.equal(e['reader-search-results'].children[20].children[0].focused,true);
 more.events.click();assert.equal(e['reader-search-results'].children.length,45);assert.equal(e['reader-search-results'].children[40].children[0].focused,true);assert.equal(more.hidden,true);
 search('Repeated');assert.equal(e['reader-search-results'].children.length,20);
 e['reader-search-clear'].events.click();assert.equal(more.hidden,true);assert.equal(e['reader-search-results'].children.length,0);
});
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
