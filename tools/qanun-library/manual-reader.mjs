import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const collation=JSON.parse(fs.readFileSync(new URL('./railways-collation.json',import.meta.url),'utf8'));

export function renderManuallyCollatedReader(record,base,{output}){
 if(record.id!==collation.record_id)return base;
 const pageDirectory=new URL('./original-pages/',import.meta.url);
 const pageManifest=JSON.parse(fs.readFileSync(new URL('./original-pages/manifest.json',import.meta.url),'utf8'));
 if(pageManifest.source_pdf_sha256!==collation.source_pdf_sha256||pageManifest.pages.length!==collation.pages.length)throw Error('Scan/collation identity mismatch');
 const readingText=collation.pages.map(p=>p.paragraphs.join('\n\n')).join('\n\n');
 const readingHash=sha(readingText),events=new Map();
 const add=(offset,html)=>events.set(offset,(events.get(offset)||'')+html);
 for(const p of record.passages)add(p.character_end,'</span>');
 for(const p of record.passages)add(p.character_start,`<span id="${esc(p.reader_fragment)}" class="passage-anchor">`);
 // Legacy provision links remain attached to their exact original OCR position.
 for(const m of base.html.matchAll(/<span id="(provision-[^"]+)"[^>]*data-source-start="(\d+)"[^>]*><\/span>/g))add(Number(m[2]),`<span id="${esc(m[1])}" class="provision-anchor"></span>`);
 const points=Array.from(record.text);let original='';for(let i=0;i<=points.length;i++){original+=events.get(i)||'';if(i<points.length)original+=esc(points[i]);}
 const provisions=[];
 const pages=collation.pages.map(page=>{
  const artifact=pageManifest.pages.find(p=>p.page===page.page);if(!artifact)throw Error('Missing original page');
  const bytes=fs.readFileSync(new URL(artifact.file,pageDirectory));if(sha(bytes)!==artifact.sha256)throw Error('Original page image changed');
  const imageName='railways-2025-page-'+page.page+'.png';fs.mkdirSync(path.join(output,'source-pages'),{recursive:true});fs.writeFileSync(path.join(output,'source-pages',imageName),bytes);
  const body=page.paragraphs.map((paragraph,index)=>{const m=paragraph.match(/^(\d{1,2})\.\s/);const anchor=m?'manual-section-'+m[1]:'manual-page-'+page.page+'-paragraph-'+index;if(m)provisions.push({number:m[1],title:paragraph.split('—')[0],anchor,kind:'Section',scope:'main',source_page:page.page});return `<${m?'h2':'p'} id="${anchor}" class="${m?'law-heading':/^\([a-z\d]+\)/i.test(paragraph)?'law-list-item':''}">${esc(paragraph)}</${m?'h2':'p'}>`;}).join('\n');
  return `<section id="manual-page-${page.page}" class="collated-source-page"><h2 class="law-division">Gazette page ${esc(page.printed_page)}</h2><span id="p-collated-page-${page.page}" class="passage-anchor" data-passage-text="${esc(page.paragraphs.join(' '))}"></span>${body}<details><summary>Compare original Gazette page ${esc(page.printed_page)}</summary><a href="/source-pages/${imageName}" target="_blank" rel="noopener"><img src="/source-pages/${imageName}" width="${artifact.width}" height="${artifact.height}" loading="lazy" alt="Original Gazette of Pakistan page ${esc(page.printed_page)}" style="max-width:100%;height:auto"></a></details></section>`;
 }).join('\n');
 const notice='<p class="reader-quality-note">Reading transcription collated against all six pages of the original Gazette scan. Expand each page to compare the original. The earlier OCR extraction contains errors and is retained separately for historical passage links.</p>';
 const html=`<div id="law-text" class="reader-text structured-law" data-reading-sha256="${readingHash}">${notice}${pages}</div><details class="original-transcription" id="original-transcription"><summary>Earlier OCR extraction — contains transcription errors</summary><p>This is the preserved earlier extraction, not the corrected reading text. Its legacy passage identifiers remain available. Original OCR text SHA-256: ${esc(record.text_sha256)}.</p><pre id="source-transcription">${original}</pre></details>`;
 const nav='<details open><summary>Contents of this legislation</summary><nav aria-label="Identified provisions" class="law-navigation">'+provisions.map(p=>`<a href="#${p.anchor}">Section ${esc(p.number)} — ${esc(p.title.replace(/^\d+\.\s*/,''))}</a>`).join('')+collation.pages.map(p=>`<a href="#manual-page-${p.page}">Original Gazette page ${esc(p.printed_page)}</a>`).join('')+'</nav></details>';
 fs.writeFileSync(path.join(output,'laws',record.id+'.reader.txt'),readingText);
 return{...base,html,nav,provisions,report:{...base.report,display_source:'manually_collated_original_scan',source_pdf_sha256:collation.source_pdf_sha256,reading_text_sha256:readingHash,manual_source_pages:collation.pages.length,visible_content_preserved:true,visible_punctuation_preserved:true,retained_content_sha256:readingHash,rendered_content_sha256:readingHash,verification_scope:collation.review_scope,provision_count:provisions.length,paragraph_count:collation.pages.reduce((n,p)=>n+p.paragraphs.length,0),status:'manually_collated_original_scan'}};
}
