import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cleanDisplay} from './reader-display.mjs';
const script=fs.readFileSync(new URL('./research-ui.js',import.meta.url),'utf8');
function session(url){
 const location=new URL(url,'https://www.jusnrem.legal'),events={},fields={};
 for(const name of ['q','court','topic','scope'])fields[name]={value:'',options:[{value:''},{value:name==='scope'?'pakistan':'test'}],querySelector:()=>null,addEventListener:(type,fn)=>events[name+type]=fn};
 const form={querySelector:s=>fields[s==='input'?'q':s.match(/name=(\w+)/)[1]],addEventListener:(type,fn)=>events['form'+type]=fn};
 const cards=Array.from({length:90},()=>({dataset:{scope:'pakistan',search:'mustafa impex',court:'test',topics:'["test"]',laws:'["law-id"]'}}));
 const status={},more={addEventListener:(type,fn)=>events.more=fn},law={querySelector:()=>({})};
 vm.runInNewContext(script,{URLSearchParams,Number,document:{querySelector:s=>({'#research-search':form,'#research-more':more,'#research-status':status,'#law-filter':law}[s]),querySelectorAll:()=>cards},location,history:{replaceState:(_a,_b,url)=>{location.href=new URL(url,location).href;}},queueMicrotask:fn=>fn(),addEventListener:(type,fn)=>events[type]=fn});
 return {fields,events,location,status,law,cards};
}
test('case query, filters and pagination survive reload and browser history',()=>{
 const a=session('/case-law');a.fields.q.value='Mustafa Impex';a.events.qinput();a.fields.court.value='test';a.events.courtchange();a.fields.topic.value='test';a.events.topicchange();a.events.more();
 const b=session(a.location.href);assert.equal(b.fields.q.value,'Mustafa Impex');assert.equal(b.fields.court.value,'test');assert.equal(b.fields.topic.value,'test');assert.match(b.status.textContent,/60 shown/);
 b.location.search='?q=absent';b.events.popstate();assert.match(b.status.textContent,/0 matching/);
});
test('clear filters also removes a linked-law constraint',()=>{const a=session('/case-law?law=law-id&q=Mustafa&court=test');a.events.formreset();assert.equal(a.fields.q.value,'');assert.equal(a.location.search,'?scope=');assert.equal(a.law.hidden,true);});
test('all source collections survives reload instead of falling back to Pakistan',()=>{const a=session('/case-law?scope=');assert.equal(a.fields.scope.value,'');a.events.qinput();const b=session(a.location.href);assert.equal(b.fields.scope.value,'');});
test('reading display preserves all characters and passage markup',()=>{const raw='<span id="p-1">\n \n\n\nSection 1. Text\nPage 2 of 4\n</span>';const rendered=cleanDisplay(raw);assert.ok(rendered.includes('extraction-space'));assert.equal(rendered.replace(/<[^>]*>/g,''),raw.replace(/<[^>]*>/g,''));assert.ok(rendered.includes('id="p-1"'));});
