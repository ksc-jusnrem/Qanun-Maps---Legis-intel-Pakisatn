import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getFacsimile} from './facsimile.mjs';
import {physicalSourcePage,validateFacsimileManifest} from './facsimile-frame.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const layouts=JSON.parse(fs.readFileSync(new URL('./verified-layouts/manifest.json',import.meta.url),'utf8'));
let paginationCache;
function pagination(){return paginationCache??=JSON.parse(fs.readFileSync(new URL('../source-pagination.json',import.meta.url),'utf8'));}

/** Load only inputs cryptographically bound to this effective record and audited original. */
export function loadSourceReaderInputs(record,sourceStatus){
 const actual=sha(record.text||'');assert.equal(actual,record.text_sha256,'Reader input record hash mismatch '+record.id);
 const originalSha=sourceStatus?.original?.sha256;
 const out={sourceArtifacts:[]};
 const entry=layouts.records.find(e=>e.id===record.id&&e.reading_status==='source_derived_readable_layout');
 if(entry){
  assert.equal(entry.input_text_sha256,actual,'Source layout input binding mismatch '+record.id);
  assert.equal(sourceStatus?.stored_text_sha256,actual,'Source layout audit input binding mismatch '+record.id);
  assert.equal(originalSha,entry.original_pdf_sha256,'Source layout original PDF binding mismatch '+record.id);
  assert.equal(entry.literal_stream_equal,true,'Source layout lacks literal character proof '+record.id);
  assert.equal(entry.layout_path,'tools/qanun-library/reader/verified-layouts/layouts/'+record.id+'.txt','Unsafe source layout path');
  const bytes=fs.readFileSync(path.join(root,entry.layout_path));assert.equal(sha(bytes),entry.layout_sha256,'Source layout file hash mismatch '+record.id);
  const text=bytes.toString('utf8');assert.equal(text.replace(/\s/gu,''),(record.text||'').replace(/\s/gu,''),'Source layout literal character stream mismatch '+record.id);
  assert.equal(sha(text.replace(/\s/gu,'')),entry.literal_non_whitespace_sha256,'Source layout proof hash mismatch '+record.id);
  out.sourceLayoutText=text;
 }
 const p=pagination().records?.[record.id];
 if(p&&p.input_text_sha256===actual&&p.source_pdf_sha256===originalSha&&(sourceStatus?.stored_text_sha256===actual||sourceStatus?.comparison?.corrected_reading_text_sha256===actual)){
  assert.ok(/^[a-f0-9]{64}$/.test(originalSha),'Invalid pagination PDF hash');
  const chars=Array.from(record.text||'');let previousEnd=-1;
  out.sourceArtifacts=p.artifacts.map(a=>{
   assert.equal(a.input_text_sha256??p.input_text_sha256,actual,'Pagination artifact input binding mismatch '+record.id);
   assert.equal(a.source_pdf_sha256??p.source_pdf_sha256,originalSha,'Pagination artifact PDF binding mismatch '+record.id);
   assert.equal(a.reason,'page_footer_confirmed_in_original','Unknown source artifact reason');
   assert.ok(Number.isInteger(a.character_start)&&Number.isInteger(a.character_end)&&a.character_start>=previousEnd&&a.character_end>a.character_start&&a.character_end<=chars.length,'Invalid pagination range '+record.id);
   const value=chars.slice(a.character_start,a.character_end).join('');assert.match(value,/^\d+$/,'Pagination span is not digits');assert.equal(value,a.text,'Pagination source span mismatch');
   let start=a.character_start,end=a.character_end;while(start>0&&!/[\r\n]/.test(chars[start-1]))start--;while(end<chars.length&&!/[\r\n]/.test(chars[end]))end++;assert.equal(chars.slice(start,end).join('').trim(),value,'Pagination source line contains substantive text');
   assert.ok(Number.isInteger(a.source_page)&&a.source_page>0,'Invalid source page');if(sourceStatus.original.pages)assert.ok(a.source_page<=sourceStatus.original.pages,'Pagination page outside original');
   previousEnd=a.character_end;return {...a,input_text_sha256:actual,source_pdf_sha256:originalSha};
  });
 }
 return out;
}

/** Distinct original-image containment check; never substitutes a text-fidelity assertion. */
export function verifyFacsimileOutput(record,html,readerReport,output){
 const f=getFacsimile(record.id);assert.ok(f,'Unknown facsimile record '+record.id);
 const scope=validateFacsimileManifest(f);
 assert.equal(sha(record.text||''),f.input_text_sha256,'Facsimile record differs from preserved extraction');
 assert.equal(readerReport.kind,'original_facsimile');assert.equal(readerReport.input_sha256,f.input_text_sha256);assert.equal(readerReport.source_pdf_sha256,f.source_pdf_sha256);
 assert.equal(readerReport.source_facsimile_pages,f.page_count);assert.equal(readerReport.page_count,f.page_count);assert.equal(readerReport.page_images_verified,true);assert.equal(readerReport.source_body_text_unavailable,true);assert.equal(readerReport.body_text_checked,false);assert.equal(readerReport.source_text_preserved,true);
 for(const key of ['original_pdf_page_count','source_pdf_page_count','source_page_start','source_page_end','selected_act_scope','source_edition_note'])assert.equal(readerReport[key],scope[key],'Facsimile source scope mismatch '+key);
 assert.equal(readerReport.visible_content_preserved,null);assert.equal(readerReport.visible_punctuation_preserved,null);
 assert.match(html,/<section\b[^>]*id="law-text"[^>]*data-reader-kind="original-facsimile"/,'Primary reader is not original facsimile');
 assert.ok(html.includes('id="original-transcription"')&&html.includes('id="source-transcription"'),'Missing preserved extraction');
 const images=[...html.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)].filter(m=>m[1].includes('/'+record.id+'/'));
 assert.equal(images.length,f.page_count,'Incomplete or duplicated original-page images');
 let assetBase;
 for(const [i,p] of f.pages.entries()){
  const image=images[i],suffix='/'+f.id+'/'+p.asset;assert.ok(image[1].endsWith(suffix),'Original page order or filename changed');const base=image[1].slice(0,-suffix.length);assert.match(base,/^\/[a-z0-9/_-]+$/i,'Unsafe published original asset path');assetBase??=base;assert.equal(base,assetBase);
  assert.ok(html.includes('id="source-page-'+String(p.page).padStart(3,'0')+'"'),'Missing original-page anchor');assert.ok(html.includes('href="'+image[1]+'"'),'Missing full-resolution source-page link');
  const figure=html.match(new RegExp('<figure\\b[^>]*id="source-page-'+String(p.page).padStart(3,'0')+'"[^>]*>'));assert.ok(figure&&figure[0].includes('data-source-page="'+physicalSourcePage(f,p)+'"'),'Physical source PDF page mapping changed');
  assert.ok(html.includes('href="'+assetBase+'/'+f.id+'/original.pdf#page='+physicalSourcePage(f,p)+'"'),'Missing physical source PDF page link');
  const file=path.resolve(output,'.'+image[1]);assert.ok(file.startsWith(path.resolve(output)+path.sep),'Published source path escaped output');const bytes=fs.readFileSync(file);assert.equal(sha(bytes),p.sha256,'Published original image changed '+p.page);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),p.width);assert.equal(bytes.readUInt32BE(20),p.height);assert.ok(image[0].includes('width="'+p.width+'"')&&image[0].includes('height="'+p.height+'"'),'Source image native dimensions absent');
 }
 const pdfHref=assetBase+'/'+f.id+'/original.pdf';assert.ok(html.includes('href="'+pdfHref+'"'),'Missing original PDF link');assert.equal(sha(fs.readFileSync(path.resolve(output,'.'+pdfHref))),f.source_pdf_sha256,'Published original PDF changed');
 if(scope.selected_act_scope){assert.ok(html.includes(scope.source_edition_note),'Missing source-edition difference');assert.ok(html.includes('complete '+scope.original_pdf_page_count+'-page volume'),'Original source volume mislabelled');assert.ok(html.includes('archived 2002 compilation'),'Legacy compilation scope missing');}
 for(const p of record.passages||[])assert.ok(html.includes('id="'+p.reader_fragment+'"'),'Missing legacy header passage anchor');
 return {id:record.id,source_facsimile_pages:f.page_count,source_pdf_sha256:f.source_pdf_sha256,page_images_verified:true,body_text_checked:false,...scope};
}
