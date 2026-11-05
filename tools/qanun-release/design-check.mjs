import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {commercialSection} from './commercial-presentation.mjs';
import {loadEvidenceModel} from './evidence-model.mjs';

const output=process.argv[2];
if(!output)throw Error('Provide generated public output');
const read=name=>fs.readFileSync(path.join(output,name),'utf8');
const source=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const home=read('index.html'),library=read('legislation.html'),membership=read('membership.html');
const mappings=read('mappings.html'),cases=read('case-law.html');
assert.match(home,/<form[^>]+action="\/legislation" method="get"/);
assert.ok(!home.includes('data-record=')&&!home.includes('const QANUN_RECORDS='),'Home must not contain the full catalogue');
assert.equal((library.match(/data-record=/g)||[]).length,1732);
assert.ok(membership.includes(commercialSection),'Membership prices, availability and terms must be retained verbatim');
for(const route of ['/legislation','/mappings','/case-law','/membership'])assert.ok(home.includes(`href="${route}"`));
for(const html of [home,library,membership,mappings,cases]){
  assert.equal((html.match(/<main /g)||[]).length,1);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  assert.ok(html.includes('href="#main"'));
}
assert.equal((mappings.match(/<details class="research-drawer">/g)||[]).length,4);
assert.equal((cases.match(/<details class="research-drawer">/g)||[]).length,1);
assert.ok(cases.indexOf('</details>',cases.indexOf('<details class="research-drawer">'))<cases.indexOf('id="research-search"'));
assert.ok(!mappings.includes('<!--rule-case-panels-->'),'All release insertion points must be consumed');
const model=loadEvidenceModel(output);
for(const match of home.matchAll(/href="\/mappings\?relationship=([^#]+)#/g))assert.ok(model.relationships.some(r=>r.id===match[1]),'Homepage example must resolve');

// Legacy links redirect only into the library; arbitrary incoming parameters are discarded.
function redirect(url){let destination;const u=new URL(url,'https://www.jusnrem.legal');vm.runInNewContext(source('./home-ui.js'),{URLSearchParams,location:{search:u.search,hash:u.hash,replace(value){destination=value;}}});return destination;}
assert.equal(redirect('/?q=health&jur=Punjab&shown=80#catalogue'),'/legislation?q=health&jur=Punjab&shown=80#catalogue');
assert.equal(redirect('/?record=pk-code-6c462b7d924dbbe3'),'/legislation?record=pk-code-6c462b7d924dbbe3#catalogue');
assert.equal(redirect('/#pk-code-6c462b7d924dbbe3'),'/legislation#pk-code-6c462b7d924dbbe3');
assert.equal(redirect('/?q=health&return=https://example.com'),'/legislation?q=health#catalogue');
for(const url of ['/','/#membership','/?campaign=reference','/#%E0%A4%A'])assert.equal(redirect(url),undefined);

// Reader return links preserve both current and legacy search state, but cannot leave the site.
function readerReturn(requested){const link={href:'/legislation?record=test#catalogue'};vm.runInNewContext(source('./reader-ui.js'),{URL,URLSearchParams,document:{getElementById(id){return id==='catalogue-return'?link:null;}},location:{search:'?return='+encodeURIComponent(requested),origin:'https://www.jusnrem.legal'}});return link;}
for(const url of ['/legislation?q=health&jur=Punjab#pk-code-6c462b7d924dbbe3','/?q=health#catalogue'])assert.equal(readerReturn(url).href,url);
for(const url of ['https://example.com/legislation#catalogue','//example.com/#catalogue','javascript:alert(1)','/membership#catalogue','/legislation?unknown=1#catalogue','/legislation#%22onclick'])assert.equal(readerReturn(url).href,'/legislation?record=test#catalogue');

// A bookmarked research card must reveal its containing drawer, including nested drawers.
const outer={open:false,parentElement:null},inner={open:false,parentElement:{closest:()=>outer}};
let hashListener;
const location={hash:'#reviewed-case'};
vm.runInNewContext(source('./research-details.js'),{location,document:{getElementById:id=>id==='reviewed-case'?{closest:()=>inner}:null},addEventListener:(event,fn)=>{assert.equal(event,'hashchange');hashListener=fn;}});
assert.ok(inner.open&&outer.open);
inner.open=outer.open=false;location.hash='#absent';hashListener();assert.ok(!inner.open&&!outer.open);
location.hash='#reviewed-case';hashListener();assert.ok(inner.open&&outer.open);
location.hash='#%E0%A4%A';assert.doesNotThrow(()=>hashListener());

// The mappings script precedes its reference panels in the document. Wait for parsing before revealing an initial bookmark.
let loaded,parsed=false;
inner.open=outer.open=false;
vm.runInNewContext(source('./research-details.js'),{location:{hash:'#reviewed-case'},document:{readyState:'loading',getElementById:()=>parsed?{closest:()=>inner}:null,addEventListener:(event,fn)=>{assert.equal(event,'DOMContentLoaded');loaded=fn;}},addEventListener:()=>{}});
assert.ok(!inner.open&&!outer.open);
parsed=true;loaded();assert.ok(inner.open&&outer.open);

const policy=JSON.parse(fs.readFileSync('vercel.json','utf8')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
assert.ok(policy.includes("form-action 'self'"),'The homepage GET search must be allowed');
assert.ok(policy.includes("default-src 'none'")&&!policy.includes("script-src 'unsafe-inline'"));
const tokens=new Set();
for(const filename of ['index.html','legislation.html','membership.html','mappings.html','case-law.html','laws/pk-code-6c462b7d924dbbe3.html']){
  const html=read(filename);
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
    const token='sha256-'+crypto.createHash('sha256').update(match[1]).digest('base64');
    tokens.add(token);assert.ok(policy.includes(token),'Script blocked by CSP: '+filename);
  }
}
assert.equal(tokens.size,5);
assert.match(read('laws/pk-code-6c462b7d924dbbe3.html'),/id="catalogue-return"[^>]+href="\/legislation\?record=/);
console.log('DESIGN_INTEGRATION_PASS: dedicated routes, preserved membership, 1732 catalogue entries, mapped examples, legacy navigation, safe reader returns, research bookmarks and five exact CSP scripts.');
