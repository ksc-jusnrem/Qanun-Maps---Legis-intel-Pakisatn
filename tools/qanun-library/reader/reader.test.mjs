import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import crypto from 'node:crypto';
import './facsimile.test.mjs';
import './source-inputs.test.mjs';
import './supplements.test.mjs';
import {renderLibraryReader} from './reader.mjs';
import {parseSections} from '../../qanun-release/section-navigation.mjs';

const root = path.resolve(new URL('../../../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const laws = new URL('../../../landing-pages/qanun-maps/laws/',import.meta.url);
const load = id => JSON.parse(fs.readFileSync(new URL(id+'.json',laws),'utf8'));
const make = text => ({id:'test-record',title:'Example Act, 2026',content_kind:'stored_law_text',text,text_sha256:crypto.createHash('sha256').update(text).digest('hex'),passages:[]});
const moduleSha256=crypto.createHash('sha256').update(fs.readFileSync(new URL('./reader.mjs',import.meta.url))).digest('hex');
const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[n]));

test('paragraphs reflow hard wraps; print contents are separated without deleting the preamble',()=>{
 const r=make('EXAMPLE ACT\nCONTENTS\n1. Short title\n2. Powers\n\nEXAMPLE ACT\nAn Act to provide an example.\nWHEREAS an example is necessary;\n1. Short title.—(1) This Act may be\ncalled the Example Act.\n(2) It extends to the whole\nof the Province.\n2. Powers.—The authority may act.');
 const out=renderLibraryReader(r);
 assert.deepEqual(out.provisions.map(p=>p.number),['1','2']);
 assert.equal(out.report.visible_content_preserved,true);
 assert.match(out.html,/WHEREAS an example is necessary/);
 assert.match(out.html,/called the Example Act/);
 assert.match(out.html,/Print contents from the source/);
 assert.equal(decode(out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1]),r.text);
});

test('explicit page markers are excluded, while standalone legal numbers and substantive content remain',()=>{
 const r=make('Page 1 of 2\n\n1. Scope.—The amount is\n25\nrupees.\n\nPage 2 of 2\n2. Powers.—The authority may act.');const out=renderLibraryReader(r);
 assert.equal(out.report.page_artifacts.length,2);
 assert.match(out.html,/amount is 25 rupees/);
 assert.equal(out.report.visible_content_preserved,true);
});

test('tabular rows retain layout and lists and explicit source notes remain visible',()=>{
 const r=make('1. Scope.—These provisions apply.\n(a) first condition;\n(b) second condition.\n\nName      Amount\nTax       12\nDuty      25\n\n1 Inserted by Act II of 2020.\n2. Powers.—A power is conferred.');const out=renderLibraryReader(r);
 assert.match(out.html,/class="law-layout"/);
 assert.match(out.html,/class="law-list-item"/);
 assert.match(out.html,/class="law-source-note"/);
 assert.match(out.html,/Inserted by Act II of 2020/);
 assert.equal(out.report.visible_content_preserved,true);
});

test('an inserted quotation cannot displace the main provision with the same number',()=>{
 const r=make('1. Short title.—This is an amendment.\n2. Amendment.—For section 1 substitute the following:\n1. New provision.—This quotation is retained.\n3. Saving.—Earlier action remains.');const out=renderLibraryReader(r);
 assert.deepEqual(out.provisions.map(p=>p.number),['1','2','3']);
 assert.match(out.html,/New provision/);
 assert.equal(out.report.visible_content_preserved,true);
 assert.equal(out.report.structural_ambiguities.length,1);
});

test('inserted future-number text does not take the place of the Act provision named in its contents',()=>{
 const r=make('CONTENTS\n1. Short title\n2. Amendment\n3. Commencement\n\nAn Act to amend another Act.\n1. Short title.—This Act applies.\n2. Amendment.—The following section shall be substituted:\n3. Definitions.—The inserted words are retained.\n3. Commencement.—This Act commences at once.');
 const out=renderLibraryReader(r);assert.deepEqual(out.provisions.filter(x=>x.scope==='main').map(x=>x.title),['Short title','Amendment','Commencement']);assert.match(out.html,/inserted words are retained/);assert.equal(out.report.visible_punctuation_preserved,true);
});

test('only original-offset whitespace deletions are accepted as source-proven display corrections',()=>{
 const r=make('1. Scope.—No person shall b e liable, except as provided.\n2. Saving.—Earlier rights remain.');const start=Array.from(r.text).join('').indexOf('b e')+1;const out=renderLibraryReader(r,{displayCorrections:[{character_start:start,character_end:start+1,replacement:''}]});
 assert.match(out.html,/shall be liable, except/);assert.equal(out.report.display_corrections_applied,1);assert.equal(out.report.visible_punctuation_preserved,true);assert.ok(out.html.includes('shall b e liable'));
 assert.throws(()=>renderLibraryReader(r,{displayCorrections:[{character_start:0,character_end:1,replacement:''}]}),/Invalid original-offset whitespace correction/);
});

test('a proven correction across physical line endings joins the word and retains original offsets',()=>{
 const r=make('📜\n1. Scope.—No person shall b\r\n \r\ne liable.\n2. Saving.—Rights remain.');const chars=Array.from(r.text);const start=chars.join('').indexOf('b\r\n')-1;const actual=chars.findIndex((ch,i)=>ch==='b'&&chars[i+1]==='\r')+1;const end=chars.findIndex((ch,i)=>i>actual&&ch==='e');const out=renderLibraryReader(r,{displayCorrections:[{character_start:actual,character_end:end,replacement:''}]});
 assert.match(out.html,/shall be liable/);assert.equal(out.report.visible_punctuation_preserved,true);assert.equal(out.provisions.find(x=>x.number==='2').character_start,chars.findIndex((ch,i)=>ch==='2'&&chars[i+1]==='.'));assert.equal(decode(out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1]),r.text);
});

test('independent source layout restores fragmented words only with exact full character-stream equality',()=>{
 const r=make('📜\n1. S h o r t t i t l e . — T h i s A c t a p p l i e s .\n2. S a v i n g . — R i g h t s r e m a i n .');const layout='📜\n1. Short title.—This Act applies.\n\n2. Saving.—Rights remain.';const out=renderLibraryReader(r,{sourceLayoutText:layout});
 assert.match(out.html,/This Act applies/);assert.equal(out.report.original_source_layout_applied,true);assert.equal(out.report.visible_punctuation_preserved,true);assert.equal(out.provisions.find(x=>x.number==='2').character_start,Array.from(r.text).indexOf('2'));assert.equal(decode(out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1]),r.text);
 assert.throws(()=>renderLibraryReader(r,{sourceLayoutText:layout.replace('Rights remain.','Rights do not remain.')}),/full non-whitespace character stream/);
});

test('only an exact isolated digit line with input hash and original PDF/page proof can be omitted as pagination',()=>{
 const r=make('1. Scope.—The amount is 13 rupees.\n(d) Keep the record.\n 13 \n(e) Give notice.\n2. Saving.—Rights remain.');const cp=Array.from(r.text);const start=cp.join('').indexOf('\n 13 \n')+2;const proof={character_start:start,character_end:start+2,text:'13',source_pdf_sha256:'a'.repeat(64),source_page:14,reason:'page_footer_confirmed_in_original',input_text_sha256:r.text_sha256};
 const out=renderLibraryReader(r,{sourceArtifacts:[proof],sourceLayoutText:r.text});assert.equal(out.report.visible_punctuation_preserved,true);assert.ok(out.report.page_artifacts.some(a=>a.source_page===14));assert.match(out.html,/amount is 13 rupees/);const body=out.html.split('<details class="original-transcription"')[0];assert.doesNotMatch(body,/>13<\/p>/);
 assert.throws(()=>renderLibraryReader(r,{sourceArtifacts:[{...proof,input_text_sha256:'0'.repeat(64)}]}),/Invalid original-source pagination artifact/);
 const amount=cp.join('').indexOf('13 rupees');assert.throws(()=>renderLibraryReader(r,{sourceArtifacts:[{...proof,character_start:amount,character_end:amount+2}]}),/Invalid original-source pagination artifact/);
});

test('a late TEXT object cannot classify earlier operative sections as print contents',()=>{
 const r=make('CONTENTS\n1. Short title\n2. Powers\n\nAn Act to provide powers.\nIt is hereby enacted as follows.\n1. Short title.—This Act applies.\n2. Powers.—The authority may act.\nTEXT');const out=renderLibraryReader(r);assert.deepEqual(out.provisions.map(p=>p.number),['1','2']);assert.equal(out.report.visible_punctuation_preserved,true);assert.ok(out.report.contents_boundary.evidence==='operative_legal_recital');
});

test('all accepted fallback layouts match literal characters and six text-bodied sources have numbered navigation',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./verified-layouts/manifest.json',import.meta.url),'utf8'));assert.equal(manifest.accepted,manifest.records.length);assert.equal(manifest.nonmatches.length,0);
 for(const entry of manifest.records){const r=load(entry.id);assert.equal(r.text_sha256,entry.input_text_sha256);const bytes=fs.readFileSync(new URL('../../../'+entry.layout_path,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.layout_sha256);const layout=bytes.toString('utf8');assert.equal(layout.replace(/\s/gu,''),r.text.replace(/\s/gu,''));const out=renderLibraryReader(r,{sourceLayoutText:layout});assert.equal(out.report.visible_punctuation_preserved,true,entry.id);assert.equal(out.report.visible_content_preserved,true,entry.id);assert.equal(out.report.original_source_layout_applied,true);if(entry.reading_status==='source_derived_readable_layout')assert.ok(out.provisions.length>0,entry.id+' lacks source numbering');else assert.ok(entry.low_text_image_pages.length>0);}
 assert.equal(manifest.readable_text_layouts,6);assert.equal(manifest.image_body_exceptions.length,2);
});

test('Unicode offsets and original passage identifiers survive the structured layout',()=>{
 const text='📜\n1. Scope.—A person’s rights remain.\n2. Powers.—Only lawful acts.';const r=make(text);r.passages=[{reader_fragment:'p-2-20-example',character_start:2,character_end:20}];
 const out=renderLibraryReader(r);assert.equal(out.provisions[0].character_start,2);assert.match(out.html,/id="p-2-20-example"/);assert.match(out.html,/data-passage-text=/);assert.equal(out.report.visible_content_preserved,true);
 const body=out.html.match(/<p class="" data-source-start="(\d+)"[^>]*>A person’s rights remain\.<\/p>/);assert.ok(body);assert.equal(Array.from(text).slice(Number(body[1]),Number(body[1])+8).join(''),'A person');
});

test('Pension repeal heading remains separate from THE SCHEDULE and its printed amendment marker',()=>{
 const r=load('pk-code-4fd8caf7b4384576');const layout=fs.readFileSync(new URL('./verified-layouts/layouts/'+r.id+'.txt',import.meta.url),'utf8');const out=renderLibraryReader(r,{sourceLayoutText:layout});
 const repeal=out.provisions.find(p=>p.scope==='main'&&p.number==='5');assert.ok(repeal);assert.equal(repeal.nav_title,'[Repeal.]');assert.ok(!repeal.title.includes('SCHEDULE'));assert.equal(out.report.division_count,1);
 assert.match(out.html,/<h2[^>]*class="law-division"[^>]*>1\[THE SCHEDULE<\/h2>/);assert.match(out.nav,/>Section 5 — \[Repeal\.\]<\/a>/);assert.match(out.nav,/>1\[THE SCHEDULE<\/a>/);
 const division=out.html.match(/<h2 id="division-(\d+)" class="law-division" data-source-start="(\d+)"/);assert.ok(division);assert.equal(repeal.character_end,Number(division[2]),'Main repeal provision must end before the Schedule');assert.ok(Array.from(r.text).slice(repeal.character_end).join('').replace(/\s/gu,'').startsWith('1[THESCHEDULE'));
 assert.equal(out.report.visible_content_preserved,true);assert.equal(out.report.visible_punctuation_preserved,true);assert.equal(out.report.retained_punctuation_sha256,out.report.rendered_punctuation_sha256);
 assert.equal(decode(out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1]),r.text);for(const p of r.passages)assert.ok(out.html.includes('id="'+p.reader_fragment+'"'));
});

test('Rules of Business includes Rule 14 and every existing legacy heading and passage link',()=>{
 const r=load('pk-code-6c462b7d924dbbe3');const out=renderLibraryReader(r);
 assert.ok(out.provisions.find(p=>p.number==='14'&&/Law and Justice/.test(p.title)));
 assert.ok(out.provisions.find(p=>p.number==='16'));
 assert.equal(out.report.visible_content_preserved,true);
 for(const p of r.passages)assert.ok(out.html.includes('id="'+p.reader_fragment+'"'));
 for(const e of parseSections(r).entries)assert.ok(out.html.includes('id="'+e.anchor+'"'));
 assert.equal(decode(out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1]),r.text);
});

test('Constitution navigation recognises article numbers obscured by source note digits and includes previously omitted articles',()=>{
 const out=renderLibraryReader(load('pk-code-30ecabb4a7ed433a'));
 for(const number of ['1','3','14','34','47','57','65','68','71','239','270AA'])assert.ok(out.provisions.some(p=>p.number===number),'Article '+number+' missing');
 assert.equal(out.report.visible_content_preserved,true);
 assert.equal(out.report.visible_punctuation_preserved,true);
});

test('print contents never swallow the early operative sections of plain-period or marginal-heading sources',()=>{
 for(const id of ['pk-code-48f42e79c90c13b6','pk-code-bd227b13c09b48ba','pk-code-f2652017dc26f3ca','pk-code-754b3805e8d76fbe','kp-code-a6074824f081e544']){
  const out=renderLibraryReader(load(id));assert.ok(out.provisions.some(x=>x.scope==='main'&&x.number==='1'),id+' missing section1');assert.ok(out.provisions.some(x=>x.scope==='main'&&x.number==='2'),id+' missing section2');
  for(const range of out.report.source_print_contents)assert.ok(range.character_end<=out.report.contents_boundary.character_start,id+' contents excludes operative range');
  assert.equal(out.report.visible_punctuation_preserved,true,id+' punctuation changed');
 }
});

test('whole existing library has faithful visible content, exact original transcription and legacy passage coverage',()=>{
 const reports=[];const problems=[];
 for(const name of fs.readdirSync(laws).filter(n=>n.endsWith('.json')).sort()){
   const r=JSON.parse(fs.readFileSync(new URL(name,laws),'utf8'));const out=renderLibraryReader(r);reports.push(out.report);
   if(!out.report.visible_content_preserved||!out.report.visible_punctuation_preserved)problems.push({id:r.id,words:out.report.visible_content_preserved,punctuation:out.report.visible_punctuation_preserved});
   assert.equal(decode(out.html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/)[1]),r.text||'',r.id+' original text');
   for(const p of r.passages||[])assert.ok(out.html.includes('id="'+p.reader_fragment+'"'),r.id+' missing passage '+p.reader_fragment);
   const ids=[...out.html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,r.id+' duplicate anchors');
 }
 fs.writeFileSync(new URL('./coverage.json',import.meta.url),JSON.stringify({module_sha256:moduleSha256,record_count:reports.length,visible_content_failures:problems,records:reports},null,2));
 assert.ok(reports.length>1000,'wrong input folder');
 assert.deepEqual(problems,[],'Visible content preservation failed; inspect coverage.json');
});
