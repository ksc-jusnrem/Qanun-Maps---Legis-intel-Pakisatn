import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createReaderRoutes,titleSlug,legacyReaderDestination,canonicalReaderLinks} from './canonical-readers.mjs';
import {readerRoutes} from './reader-routes.mjs';
import {materializeReaderAliases} from './reader-aliases.mjs';
import {readerEditionSummary} from './reader-experience.mjs';
import {buildConnectors,clientCardIds} from './connectors.mjs';
import {fourStageSchematic,conceptDetail} from './project-concepts.mjs';
import {buildPolicyPages} from './site-policies.mjs';
import {commercialSection} from './commercial-presentation.mjs';
import {homeContent} from './design-presentation.mjs';
import {pageMetadata,applySearchVisibility} from './search-visibility.mjs';
import middleware,{config} from '../../middleware.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const originalManifest=JSON.parse(fs.readFileSync(path.join(root,'QANUN-LAW-ASSETS-2026-10-31.json'),'utf8')).output_allowlist;
const sourceAudit=JSON.parse(fs.readFileSync(new URL('../qanun-library/source-status.json',import.meta.url),'utf8'));
// Full ID/title coverage is cheap; raw-byte and historical-parser verification stays in S2.
const records=JSON.parse(fs.readFileSync(new URL('./catalogue.json',import.meta.url),'utf8')).map(r=>({...r,content_kind:r.kind,source_collection:r.collection,passage_anchors:['passage-fixture-'+r.id],historical_anchors:['provision-fixture-'+r.id],text_sha256:'opaque-source-version-fixture'}));
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'legis-experience-'));
const head=title=>'<!doctype html><html lang="en"><head><title>'+title+'</title></head><body>';
const header='<header><nav aria-label="Main"><a href="/connectors#client-setup">Connect your AI</a></nav></header>';
const footer='<footer><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/guide">Guide</a><a href="/glossary">Glossary</a></footer>';
const ids=html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);

test('complete1732record corpus has stable unique human paths, independent of input order',()=>{
 assert.equal(records.length,1732);assert.equal(records.filter(r=>r.content_kind==='source_notice').length,4);
 const heldIds=Object.keys(originalManifest).filter(n=>/^laws\/[^/]+\.json$/.test(n)).map(n=>n.slice(5,-5)).sort();assert.deepEqual(records.map(r=>r.id).sort(),heldIds);for(const r of records)assert.ok(originalManifest['laws/'+r.id+'.txt']);
 assert.deepEqual(createReaderRoutes(records),readerRoutes);
 assert.deepEqual(createReaderRoutes([...records].reverse()),readerRoutes);
 assert.equal(new Set(Object.values(readerRoutes)).size,1732);
 assert.equal(readerRoutes['pk-code-a35e1c15e60e5ad1'],'/laws/right-of-access-to-information-act-2017');
 assert.equal(readerRoutes['pk-code-7a0c36b8d5c1c0a6'],'/laws/pakistan-council-for-science-and-technology-act-2017');
 for(const r of records){assert.ok(readerRoutes[r.id]);assert.match(readerRoutes[r.id],/^\/laws\/[a-z0-9-]+$/);assert.ok(readerRoutes[r.id].length<240);}
});
test('colliding titles, accents and punctuation cannot merge identities; malformed IDs fail',()=>{
 const a={id:'pk-code-aaaaaaaaaaaaaaaa',title:'Access Act, 2017'},b={id:'pk-code-bbbbbbbbbbbbbbbb',title:'Áccess Act 2017'};
 const routes=createReaderRoutes([a,b]);assert.notEqual(routes[a.id],routes[b.id]);assert.ok(routes[a.id].endsWith('--'+a.id));assert.ok(routes[b.id].endsWith('--'+b.id));
 assert.deepEqual(createReaderRoutes([b,a]),routes);
 assert.throws(()=>createReaderRoutes([a,{...b,id:a.id}]),/duplicate/);
 assert.throws(()=>createReaderRoutes([{id:'../outside',title:'Bad'}]),/Invalid/);
 assert.equal(titleSlug('Right of Access to Information Act, 2017'),'right-of-access-to-information-act-2017');
 assert.equal(titleSlug(''), 'legislation');
 assert.ok(titleSlug('A very long '+('descriptive institutional title '.repeat(12))+'Act, 2017').endsWith('-2017'));
});
test('every legacy reader and .html URL301redirects; encoded queries and browser fragments survive',()=>{
 const search='?q=a%2Bb&x=1&x=2&blank=&encoded=%23part';
 const matcher=new RegExp('^'+config.matcher[0]+'$');
 for(const r of records){
  for(const suffix of ['','.html']){
   const input='https://www.jusnrem.legal/laws/'+r.id+suffix+search;
   assert.ok(matcher.test(new URL(input).pathname),'Middleware misses '+r.id+suffix);
   const out=middleware(new Request(input));assert.equal(out.status,301);
   const location=new URL(out.headers.get('location'));assert.equal(location.pathname,readerRoutes[r.id]);assert.equal(location.search,search);assert.equal(location.hash,'');
  }
  const hash='#'+(r.passage_anchors[0]||'law-text');const destination=legacyReaderDestination('https://www.jusnrem.legal/laws/'+r.id+search+hash,readerRoutes);
  assert.equal(new URL(destination.url).hash,hash);
  // RFC9110 fragment inheritance: the server cannot see the fragment and does not replace it.
  const location=middleware(new Request('https://www.jusnrem.legal/laws/'+r.id)).headers.get('location');assert.ok(!location.includes('#'));
  assert.equal(new URL(location+hash).hash,hash);
 }
});
test('JSON/TXT, reader versions, canonical slugs, MCP and unknown records cannot be misdirected',()=>{
 const id=records[0].id;const matcher=new RegExp('^'+config.matcher[0]+'$');
 for(const pathname of ['/laws/'+id+'.json','/laws/'+id+'.txt','/laws/'+id+'.reader.txt','/reading-records/'+id+'.json',readerRoutes[id],'/mcp','/api/mcp','/laws/not-a-held-record']){
  assert.equal(legacyReaderDestination('https://www.jusnrem.legal'+pathname,readerRoutes),null);assert.ok(!matcher.test(pathname));assert.equal(middleware(new Request('https://www.jusnrem.legal'+pathname)),undefined);
 }
 assert.equal(middleware(new Request('https://www.jusnrem.legal/laws/pk-code-0000000000000000')).status,404);
 assert.equal(legacyReaderDestination('https://www.jusnrem.legal/laws/pk-code-0000000000000000',readerRoutes).unknown,true);
});
test('reader status covers every actual record; unknown, facsimile, restored, collated and notice cases stay bounded',()=>{
 for(const r of records){const html=readerEditionSummary(r,sourceAudit.records[r.id]);assert.ok(html.includes('Edition and review limits'));assert.ok(html.includes('does not establish current force'));assert.ok(!/Verified law|law is current|current law verified/i.test(html));}
 const unknown={id:'fixture',version:null,source_snapshot:'2026-11-12',content_kind:'stored_law_text'};
 assert.ok(readerEditionSummary(unknown,{comparison_status:'matched_original_normalized'}).includes('<dd>Not established in this record</dd>'));
 assert.ok(readerEditionSummary(unknown,{comparison_status:'not-a-reviewed-state'}).includes('Original-source comparison pending'));
 for(const [state,label] of [['original_facsimile_complete','Original-page facsimile'],['original_reading_restored','Source-restored reading'],['manually_collated_original_scan','Visually collated reading']])assert.ok(readerEditionSummary(unknown,{comparison_status:state}).includes('<dd>'+label+'</dd>'));
 assert.ok(readerEditionSummary({...unknown,content_kind:'source_notice'},{}).includes('legislation text unavailable'));
 const versioned=readerEditionSummary({...unknown,version:'Gazette edition, 17 August 2026'},{});assert.ok(versioned.includes('Gazette edition, 17 August 2026'));assert.ok(versioned.includes('Source snapshot: 2026-11-12. This is not a legal-currency date.'));
 assert.ok(readerEditionSummary({...unknown,version:'<script>bad</script>'},{}).includes('&lt;script&gt;'));
});
test('representative static alias pipeline preserves opaque anchors, download names and canonical metadata',()=>{
 const records=JSON.parse(fs.readFileSync(new URL('./catalogue.json',import.meta.url),'utf8')).filter(r=>['pk-code-a35e1c15e60e5ad1','pk-code-7a0c36b8d5c1c0a6','balochistan-code-d9d838bd66607fd9'].includes(r.id)).map(r=>({...r,title:r.id==='balochistan-code-d9d838bd66607fd9'?'Balochistan Sales Tax on Services Act, 2015 , 2015':r.title,content_kind:r.kind,source_collection:r.collection,passage_anchors:['passage-fixture-'+r.id],historical_anchors:['provision-fixture-'+r.id],text_sha256:'opaque-source-version-fixture'}));
 const routes=Object.fromEntries(records.map(r=>[r.id,readerRoutes[r.id]]));
 const output=temp();
 try{
  fs.mkdirSync(path.join(output,'laws'));fs.mkdirSync(path.join(output,'data'));
  for(const name of Object.keys(pageMetadata))fs.writeFileSync(path.join(output,name+'.html'),head(name)+'<main><h1>'+name+'</h1></main></body></html>');
  let passageCount=0,historicalCount=0;
  for(const r of records){
   const anchors=[...new Set([...r.passage_anchors,...r.historical_anchors])];passageCount+=r.passage_anchors.length;historicalCount+=r.historical_anchors.length;
   const html=head(r.title)+'<main><h1>'+r.title+'</h1>'+readerEditionSummary(r,sourceAudit.records[r.id])+'<div id="law-text">'+anchors.map(id=>'<span id="'+id+'"></span>').join('')+'</div><section id="original-source-check"></section><div id="source-details"></div></main><a href="/laws/'+r.id+'#law-text">Reader</a><a href="'+r.id+'.txt">TXT</a></body></html>';
   fs.writeFileSync(path.join(output,'laws',r.id+'.html'),html);fs.writeFileSync(path.join(output,'laws',r.id+'.txt'),r.text_sha256);fs.writeFileSync(path.join(output,'laws',r.id+'.json'),JSON.stringify({id:r.id,text_sha256:r.text_sha256}));
  }
  applySearchVisibility(output,records);materializeReaderAliases(output,records,{routes});
  const sm=fs.readFileSync(path.join(output,'sitemap.xml'),'utf8');assert.equal((sm.match(/<loc>/g)||[]).length,Object.keys(pageMetadata).length+records.length);
  for(const r of records){
   const old=fs.readFileSync(path.join(output,'laws',r.id+'.html'),'utf8'),alias=fs.readFileSync(path.join(output,readerRoutes[r.id].slice(1)+'.html'),'utf8');assert.equal(alias,old);
   const anchorSet=new Set(ids(alias));for(const id of [...r.passage_anchors,...r.historical_anchors])assert.ok(anchorSet.has(id),'Lost '+r.id+'#'+id);
   assert.equal(fs.readFileSync(path.join(output,'laws',r.id+'.txt'),'utf8'),r.text_sha256);assert.equal(JSON.parse(fs.readFileSync(path.join(output,'laws',r.id+'.json'),'utf8')).id,r.id);
   assert.equal((alias.match(/rel="canonical"/g)||[]).length,1);assert.ok(alias.includes('https://www.jusnrem.legal'+readerRoutes[r.id]));
   assert.equal(sm.includes('https://www.jusnrem.legal'+readerRoutes[r.id]+'</loc>'),r.content_kind==='stored_law_text');
  }
  assert.equal(passageCount,records.length);assert.equal(historicalCount,records.length); // Complete actual40922+597anchors are checked against both HTML names by verify-library.mjs in S2.
  const bad=records.map(r=>r.id==='pk-code-a35e1c15e60e5ad1'?{...r,title:'Different institution'}:r);assert.throws(()=>materializeReaderAliases(output,bad,{routes}),/manifest differs/);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
test('HTML href rewriting preserves query/fragment, download paths, unknown identities and source transcription',()=>{
 const id='pk-code-a35e1c15e60e5ad1',route=readerRoutes[id];const input='<a href="/laws/'+id+'?a=1&amp;b=2#section-1">law</a><a href="/laws/'+id+'.txt">txt</a><pre>&lt;a href=&quot;/laws/'+id+'&quot;&gt;</pre>';
 const out=canonicalReaderLinks(input,readerRoutes);assert.ok(out.includes('href="'+route+'?a=1&amp;b=2#section-1"'));assert.ok(out.includes('href="/laws/'+id+'.txt"'));assert.ok(out.includes('&quot;/laws/'+id+'&quot;'));
 assert.equal(canonicalReaderLinks('<a href="/laws/pk-code-0000000000000000">unknown</a>',readerRoutes),'<a href="/laws/pk-code-0000000000000000">unknown</a>');
});
test('setup chooser precedes benefit text, resolves six stable keyboard targets and preserves pilot/tool boundaries',()=>{
 const output=temp();try{
  buildConnectors({output,head,header,footer});const html=fs.readFileSync(path.join(output,'connectors.html'),'utf8');const seen=ids(html);assert.equal(new Set(seen).size,seen.length);
  assert.ok(html.indexOf('id="client-setup"')<html.indexOf('id="why-mcp"'));assert.ok(html.includes('aria-labelledby="client-chooser-title"'));
  for(const id of Object.values(clientCardIds)){assert.ok(html.includes('href="#'+id+'"'));assert.ok(html.includes('id="'+id+'" class="connector-card" tabindex="-1"'));}
  assert.ok(html.includes('operator-issued pilot'));assert.ok(html.includes('/contact#pilot-access'));assert.ok(html.includes('Nine read-only research tools'));assert.ok(html.includes('UNDETERMINED'));assert.ok(html.includes('OAuth sign-in and account-linked access are a separate release step'));
  assert.ok(html.includes('Historical source versions are held for selected records'));assert.ok(!html.includes('A second historical version is not currently held'));
  for(const [,href] of html.matchAll(/href="(\/client-setup\/[^"#]+)"/g))assert.ok(fs.existsSync(path.join(output,href.slice(1))),href);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
test('four-stage path retains six concepts and explicit planned status; home explains title versus reader search',()=>{
 for(const label of ['Source','Machine-readable text','Rule mapping','Testable rules'])assert.ok(fourStageSchematic.includes('<h3>'+label+'</h3>'));
 assert.equal((fourStageSchematic.match(/<li>/g)||[]).length,4);assert.ok(fourStageSchematic.includes('<ol aria-label="Source to testable rules">'));assert.ok(fourStageSchematic.includes('Development objective'));assert.ok(fourStageSchematic.includes('nine research propositions'));assert.ok(fourStageSchematic.includes('does not execute binding legal outcomes'));assert.ok(conceptDetail.includes('Six connected concepts'));
 const home=homeContent({readerCount:1732,caseCount:2397,relationshipCount:18});assert.ok(home.includes('Title-only search'));assert.ok(home.includes('Open a result to search within its text'));assert.ok(home.includes('/guide#quick-start'));
 const intro=fs.readFileSync(new URL('./project-introduction.mjs',import.meta.url),'utf8');assert.ok(intro.includes('+conceptDetail+fourStageSchematic+automicaPhilosophy'));
});
test('dedicated contact/privacy/terms reuse actual current copy and retain former anchor destinations',()=>{
 const source=fs.readFileSync(new URL('./build.mjs',import.meta.url),'utf8');const output=temp();try{
  const contact=source.match(/<section id="contact">[\s\S]*?<\/section>/)?.[0],privacy=source.match(/<section id="privacy">[\s\S]*?<\/section>/)?.[0];assert.ok(contact&&privacy);
  buildPolicyPages({output,head,header,footer,aboutHtml:contact+privacy,membershipHtml:commercialSection});
  const c=fs.readFileSync(path.join(output,'contact.html'),'utf8'),p=fs.readFileSync(path.join(output,'privacy.html'),'utf8'),t=fs.readFileSync(path.join(output,'terms.html'),'utf8');
  assert.ok(c.includes('mailto:contact@jusnrem.com?subject=Legis-Intel%20pilot%20access'));assert.ok(c.includes('id="pilot-access"'));assert.ok(c.includes('does not activate access'));assert.ok(p.includes(privacy));assert.ok(t.includes('to the extent owned by KSC.JUSNREM'));assert.ok(t.includes('does not create a blanket licence'));assert.ok(t.includes('TXT and JSON'));assert.ok(commercialSection.includes('id="terms"'));assert.ok(source.includes('<section id="contact">')&&source.includes('<section id="privacy">'));
  assert.throws(()=>buildPolicyPages({output,head,header,footer,aboutHtml:'',membershipHtml:commercialSection}),/absent/);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
