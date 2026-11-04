import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadEvidenceModel} from './evidence-model.mjs';
import {renderInspector} from './evidence-inspector.mjs';
const model=loadEvidenceModel('landing-pages/qanun-maps');
const html=renderInspector(model);
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function harness(search='') {
 const node=()=>({hidden:false,value:'',dataset:{},attrs:{},events:{},textContent:'',addEventListener(n,fn){this.events[n]=fn;},setAttribute(n,v){this.attrs[n]=v;},append(n){this.child=n;},focus(){this.focused=true;}});
 const panels=[...html.matchAll(/data-evidence-detail="([^"]+)" data-kind="([^"]+)" data-search="([^"]+)"/g)].map(m=>({...node(),dataset:{evidenceDetail:m[1],kind:m[2],search:decode(m[3])}}));
 const buttons=panels.map(p=>({...node(),dataset:{evidenceSelect:p.dataset.evidenceDetail}}));
 const ids={};for(const m of html.matchAll(/id="([^"]+)"/g)) ids[m[1]]=node();
 const root=ids['evidence-inspector'];root.dataset.modelId=model.model_id;root.querySelectorAll=s=>s.includes('detail')?panels:buttons;
 const location={href:'https://www.jusnrem.legal/mappings'+search},events={},history=[];
 const context={document:{getElementById:id=>ids[id],createElement:node},location,history:{pushState(a,b,url){history.push(url);location.href=new URL(url,location.href).href;}},URL,addEventListener(n,fn){events[n]=fn;}};
 vm.runInNewContext(fs.readFileSync(new URL('./evidence-ui.js',import.meta.url),'utf8'),context);
 return {ids,panels,buttons,events,history,location,visible:()=>panels.filter(p=>!p.hidden)};
}
test('Actual UI script selects, filters, clears, and maintains accessible selection',()=>{
 const h=harness();assert.equal(h.visible().length,1);assert.equal(h.buttons[0].attrs['aria-pressed'],'true');assert.match(h.ids['evidence-status'].textContent,/18 connections/);
 h.ids['evidence-kind'].value='case';h.ids['evidence-kind'].events.change();assert.match(h.ids['evidence-status'].textContent,/9 connections/);assert.equal(h.visible()[0].dataset.kind,'case');
 h.ids['evidence-query'].value='Mustafa Rule 16';h.ids['evidence-query'].events.input();assert.equal(h.buttons.filter(b=>!b.hidden).length,2);
 h.ids['evidence-query'].value='no match';h.ids['evidence-query'].events.input();assert.equal(h.visible().length,0);assert.match(h.ids['evidence-status'].textContent,/No connections/);
 h.ids['evidence-clear'].events.click();assert.match(h.ids['evidence-status'].textContent,/18 connections/);assert.ok(h.ids['evidence-query'].focused);
});
test('Permanent selection survives reload and back navigation',()=>{
 const h=harness();h.buttons[12].events.click();assert.equal(h.visible()[0].dataset.evidenceDetail,h.buttons[12].dataset.evidenceSelect);assert.ok(h.history.at(-1).includes(model.model_id));
 const reload=harness(new URL(h.location.href).search);assert.equal(reload.visible()[0].dataset.evidenceDetail,h.visible()[0].dataset.evidenceDetail);
 h.location.href='https://www.jusnrem.legal/mappings?relationship=act2025-partial-repeal&map='+model.model_id;h.events.popstate();assert.equal(h.visible()[0].dataset.evidenceDetail,'act2025-partial-repeal');
});
test('A missing relationship or different map edition never silently selects a replacement',()=>{
 for(const query of ['?relationship=absent','?map=old-edition&relationship=rob-art99']){const h=harness(query);assert.equal(h.visible().length,0);assert.equal(h.ids['evidence-route-warning'].hidden,false);assert.equal(h.ids['evidence-controls'].hidden,true);assert.equal(h.ids['evidence-route-warning'].child.href,'/mappings#evidence-inspector');}
});
test('Without JavaScript all excerpts and native links are available',()=>{
 assert.equal((html.match(/data-evidence-detail=/g)||[]).length,18);assert.ok(!/class="evidence-detail"[^>]* hidden/.test(html));assert.match(html,/<noscript>/);assert.match(html,/Open exact reader passage/);
});
