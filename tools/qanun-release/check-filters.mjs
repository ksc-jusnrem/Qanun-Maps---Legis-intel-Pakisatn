import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.argv[2];
const data=JSON.parse(fs.readFileSync(path.join(root,'tools/qanun-release/case-discovery.json'),'utf8')).records;
function control(value=''){return {value,events:{},addEventListener(name,fn){this.events[name]=fn;}};}
const q=control(),court=control(),topic=control(),scope=control('Pakistan source bodies');scope.options=['Pakistan source bodies','','AJK source bodies','Comparative foreign','Northern Areas historical source body','Source body needs review'].map(value=>({value}));
const form=control();form.querySelector=s=>({'input':q,'[name=court]':court,'[name=topic]':topic,'[name=scope]':scope}[s]);
const cards=data.map(c=>({id:'case-'+c.id,hidden:false,dataset:{scope:c.source_scope,court:c.court,search:[c.title,c.citation,c.court,...c.topics].join(' ').toLowerCase(),topics:JSON.stringify(c.topics),laws:JSON.stringify(c.law_links.map(l=>l.law_id))},querySelector:()=>({}),scrollIntoView(){}}));
const more=control(),status={},filter={querySelector:()=>({})};
const document={querySelector:s=>({'#research-search':form,'#research-more':more,'#research-status':status,'#law-filter':filter}[s]),querySelectorAll:()=>cards,getElementById:id=>cards.find(c=>c.id===id)};
vm.runInNewContext(fs.readFileSync(path.join(root,'tools/qanun-release/research-ui.js'),'utf8'),{document,location:{search:'',hash:''},URLSearchParams,queueMicrotask,addEventListener(){}});
assert.match(status.textContent,/2,277 matching records/);assert.equal(cards.filter(c=>!c.hidden).length,30);assert.ok(cards.filter(c=>!c.hidden).every(c=>c.dataset.scope==='Pakistan source bodies'));
scope.value='Comparative foreign';scope.events.change();assert.match(status.textContent,/103 matching records/);assert.ok(cards.filter(c=>!c.hidden).every(c=>c.dataset.scope==='Comparative foreign'));
scope.value='';scope.events.change();q.value='POWER LINE';q.events.input();assert.ok(cards.filter(c=>!c.hidden).some(c=>c.id==='case-234454'));assert.ok(cards.filter(c=>!c.hidden).every(c=>c.dataset.search.includes('power')&&c.dataset.search.includes('line')));
q.value='';q.events.input();court.value='Supreme Court of India';court.events.change();assert.match(status.textContent,/64 matching records/);more.events.click();assert.equal(cards.filter(c=>!c.hidden).length,60);
console.log('PASS: actual research UI script defaults to Pakistan labels, separates foreign records, searches Power Line, filters India court and paginates. DOM harness; not a browser render test.');
