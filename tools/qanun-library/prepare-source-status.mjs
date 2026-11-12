import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadReadingVersions} from './reading-versions.mjs';
import {getFacsimile} from './reader/facsimile.mjs';
const root=path.resolve('.');
const here=path.join(root,'tools/qanun-library');
const complete=path.join(here,'sources/source-verification.json');
const audit=fs.existsSync(complete)?JSON.parse(fs.readFileSync(complete,'utf8')):null;
const records={};const statuses={};let originals=0,matched=0,notices=0;
const laws=fs.readdirSync('landing-pages/qanun-maps/laws').filter(n=>n.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(path.join('landing-pages/qanun-maps/laws',name),'utf8')));
const versions=loadReadingVersions(laws),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const accepted=new Set(['matched_original_normalized','matched_original_nonwhitespace','matched_original_character_stream','matched_original_character_sequence','original_reading_restored','manually_collated_original_scan','original_facsimile_complete']);
for(const law of laws){
 const name=law.id+'.json';
 const cached=path.join(here,'sources/cache/results',name);
 let a=fs.existsSync(cached)?JSON.parse(fs.readFileSync(cached,'utf8')):audit?.records?.[law.id]||null;
 const reading=versions.get(law.id);
 const facsimile=getFacsimile(law.id);
 if(facsimile){
  if(a?.original?.sha256!==facsimile.source_pdf_sha256||!a.original.identity_checked||law.text_sha256!==facsimile.input_text_sha256)throw Error('Facsimile source identity mismatch '+law.id);
  a={...a,source_material_status:'complete_original_facsimile',comparison_status:'original_facsimile_complete',comparison:{method:'Complete original PDF and all full-page images SHA-256 verified. Earlier stored transcription retained separately; the displayed statutory body is provided as original page images and has not been certified as text-checked.',source_pdf_sha256:facsimile.source_pdf_sha256,original_pages:facsimile.original_pdf_page_count||facsimile.source_pdf_page_count||facsimile.page_count,reading_pages:facsimile.page_count,selected_source_pages:facsimile.source_page_start?{start:facsimile.source_page_start,end:facsimile.source_page_end}:null,edition_scope:facsimile.source_edition_note||facsimile.edition_note||null,page_images_verified:true,body_text_checked:false},notes:[...(a.notes||[]),facsimile.source_edition_note||facsimile.edition_note||'Read the complete original page images. The earlier machine extraction is not certified as an accurate statutory transcription.']};
 }
 if(reading&&a?.original?.sha256===reading.source_sha256&&a.original.identity_checked){
  const legacyStatus=a.comparison_status;
  if(law.id==='pk-code-a2f0a11f70fdf902'){
   const review=JSON.parse(fs.readFileSync(new URL('./manual-source-review.json',import.meta.url),'utf8'));
   if(!review.reading_transcription_collated||review.pages_reviewed.length!==6||review.source_pdf_sha256!==reading.source_sha256||review.final_collation_sha256!==sha(fs.readFileSync(new URL('./railways-collation.json',import.meta.url))))throw Error('Manual source collation incomplete');
   a={...a,source_material_status:'original_scan_visually_collated',comparison_status:'manually_collated_original_scan',notes:[...a.notes,'The former OCR extraction contains errors. The distinct reading transcription was visually collated against all six original Gazette pages; original-page images and the earlier extraction are retained.'],comparison:{method:'All six original Gazette pages visually transcribed and independently collated, including words, numerals, negations and punctuation. Earlier OCR is not certified.',corrected_reading_text_sha256:reading.text_sha256,legacy_comparison_status:legacyStatus,original_pages:6,manual_review_sha256:sha(fs.readFileSync(new URL('./manual-source-review.json',import.meta.url)))}};
  }else{
   const text=fs.readFileSync(a.original.extracted_text_path,'utf8').replace(/\r\n/g,'\n');
   if(sha(text)!==reading.text_sha256||sha(fs.readFileSync(a.original.path))!==reading.source_sha256)throw Error('Restored reading differs from full identified original '+law.id);
   a={...a,source_material_status:'complete_original_text_recovered',comparison_status:'original_reading_restored',notes:[...a.notes,'The reading edition was restored from the complete identified original source. The earlier extracted version and historical passage identifiers remain available separately.'],comparison:{method:'Complete original-source extraction restored as a separately hashed reading edition; no page cap. Original PDF bytes and full extraction hash checked.',corrected_reading_text_sha256:reading.text_sha256,legacy_comparison_status:legacyStatus,legacy_characters:law.text.length,restored_characters:reading.text.length,original_pages:a.original.pages}};
  }
 }
 if(a&&a.stored_text_sha256!==law.text_sha256)throw Error('Stale original-source comparison '+law.id);
 const status=a?.comparison_status||'not_compared';statuses[status]=(statuses[status]||0)+1;
 if(a?.original?.sha256)originals++;
 if(law.content_kind==='source_notice')notices++;else if(accepted.has(status)&&a?.original?.identity_checked)matched++;
 const original=a?.original?{sha256:a.original.sha256||null,url:a.original.url||null,retrieved_at:a.original.retrieved_at||null,identity_basis:a.original.identity_basis,identity_checked:a.original.identity_checked===true,pages:a.original.pages,archive_hash_check:a.original.archive_hash_check||null,extraction_method:a.original.extraction_method}:null;
 const c=a?.comparison;
 const comparison=c?Object.fromEntries(Object.entries(c).filter(([k])=>!/(?:path|file)/i.test(k))):null;
 const notes=(a?.notes||[]).map(n=>String(n).replace(/[A-Z]:[\\/][^\n]+/g,'[local artifact path omitted]'));
 records[law.id]={id:law.id,title:law.title,stored_text_sha256:law.text_sha256,source_url:a?.source_url||law.source_url||null,source_material_status:a?.source_material_status||'not_obtained',comparison_status:status,original,comparison,current_force_status:'not_checked',notes};
}
const summary={records:Object.keys(records).length,originals_obtained:originals,source_verified_reading_editions:matched,text_compared_or_collated:matched-(statuses.original_facsimile_complete||0),complete_original_facsimiles:statuses.original_facsimile_complete||0,notices,unresolved:Object.keys(records).length-notices-matched,statuses};
const result={schema_version:'legis-intel-source-audit/1',audit_started_at:audit?.audited_at||null,audited_at:new Date().toISOString(),baseline_commit:'edfd4acf57fc2613d6c1f85235088efe710eb41f',summary,records};
fs.writeFileSync(path.join(here,'source-status.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(summary));
if(summary.unresolved&&!process.argv.includes('--allow-partial'))throw Error('Original-source comparisons remain incomplete; production preparation refused');
if(!summary.unresolved)console.log('PUBLIC_SOURCE_REGISTER_PREPARED');
