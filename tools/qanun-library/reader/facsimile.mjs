import fs from 'node:fs';
import {buildFacsimileFrame,validateFacsimileManifest} from './facsimile-frame.mjs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseSections} from '../../qanun-release/section-navigation.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
export function getFacsimile(id){const manifest=JSON.parse(fs.readFileSync(new URL('./facsimiles/manifest.json',import.meta.url),'utf8'));return manifest.records.find(r=>r.id===id)||null;}
export const facsimileCss=`.facsimile-reading{max-width:1100px;margin:1.5em 0}.facsimile-intro{font:16px/1.7 Arial,sans-serif;padding:18px;background:#eef3f5;border-left:3px solid #547684}.facsimile-actions,.facsimile-pagination{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:16px 0}.facsimile-page{margin:32px 0;scroll-margin-top:20px}.facsimile-page figcaption{font:15px/1.6 Arial,sans-serif;display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.facsimile-viewport{overflow:auto;background:#e6eaed;border:1px solid #c7d0d6;padding:8px}.facsimile-page img{display:block;width:100%;height:auto;max-width:none;background:white}.facsimile-page:target{outline:3px solid #b79640;outline-offset:8px}.facsimile-provenance{font:14px/1.65 Arial,sans-serif}.facsimile-provenance code{overflow-wrap:anywhere}.facsimile-extraction{margin:28px 0;padding:16px;border-top:1px solid #cad3d8}.facsimile-extraction pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 monospace;max-height:65vh;overflow:auto}.facsimile-pages-nav a{display:block;padding:8px 12px}.facsimile-legacy-marker{scroll-margin-top:20px}@media(max-width:760px){.facsimile-intro{font-size:14px;padding:14px}.facsimile-viewport{padding:3px}.facsimile-page figcaption{font-size:14px}}@media print{.facsimile-intro,.facsimile-actions,.facsimile-pagination,.facsimile-extraction{display:none}.facsimile-page{break-before:page;margin:0}.facsimile-viewport{padding:0;border:0;overflow:visible}.facsimile-page img{max-height:95vh;object-fit:contain}.facsimile-page figcaption{font-size:9pt}}`;

export function renderFacsimileReader(record,baseOrOptions={}, {output}={}){
 const {assetBase='/sources/facsimiles',output:optionOutput}=typeof baseOrOptions==='string'?{assetBase:baseOrOptions}:baseOrOptions;
 output=output??optionOutput;
 const f=getFacsimile(record.id);if(!f)throw new Error('No original facsimile for '+record.id);if(sha(Buffer.from(record.text||'','utf8'))!==f.input_text_sha256)throw new Error('Facsimile legacy text identity mismatch');
 if(!/^\/[a-z0-9/_-]+$/i.test(assetBase))throw new Error('Invalid facsimile public asset base');
 const source=path.join(fileURLToPath(new URL('./facsimiles/',import.meta.url)),f.id);
 if(!/^[a-z0-9-]+$/.test(f.id)||f.pages.length!==f.page_count)throw new Error('Invalid facsimile manifest');
 validateFacsimileManifest(f);
 const assets=[{asset:'original.pdf',sha256:f.source_pdf_sha256},...f.pages];
 for(const [i,p] of f.pages.entries())if(p.page!==i+1||p.asset!==`page-${String(i+1).padStart(3,'0')}.png`)throw new Error('Invalid facsimile page allowlist');
 for(const asset of assets){const bytes=fs.readFileSync(path.join(source,asset.asset));if(sha(bytes)!==asset.sha256)throw new Error('Facsimile asset hash mismatch: '+asset.asset);}
 if(output){const dest=path.resolve(output,'.'+assetBase,f.id);const outputRoot=path.resolve(output);if(!dest.startsWith(outputRoot+path.sep))throw new Error('Facsimile output escaped root');fs.mkdirSync(dest,{recursive:true});for(const asset of assets)fs.copyFileSync(path.join(source,asset.asset),path.join(dest,asset.asset));}
 const base=assetBase.replace(/\/$/,'')+'/'+f.id;const pageId=n=>'source-page-'+String(n).padStart(3,'0');
 const damagedOCR=f.body_text_status==='damaged_source_OCR_not_corrected_prefer_original_facsimile';
 const passageIds=new Set((record.passages||[]).map(p=>p.reader_fragment));
 const oldSections=[...new Set(parseSections(record).entries.map(p=>p.anchor))].filter(id=>!passageIds.has(id));
 const markers=oldSections.map(id=>`<span id="${esc(id)}" class="facsimile-legacy-marker" data-passage-kind="legacy_extraction_heading"></span>`).join('')+(record.passages||[]).map(p=>`<span id="${esc(p.reader_fragment)}" class="facsimile-legacy-marker" data-passage-kind="${f.selected_act_scope?'legacy_different_edition':damagedOCR?'original_damaged_ocr':'original_extracted_headers'}" data-passage-text="${esc(Array.from(record.text).slice(p.character_start,p.character_end).join(''))}"></span>`).join('');
 const {html,nav,scope}=buildFacsimileFrame(f,record,base,markers);
 return {html,nav,css:facsimileCss,facsimile:f,provisions:[],report:{id:record.id,kind:'original_facsimile',input_sha256:f.input_text_sha256,source_text_preserved:true,visible_content_preserved:null,visible_punctuation_preserved:null,source_pdf_sha256:f.source_pdf_sha256,page_count:f.page_count,source_facsimile_pages:f.page_count,page_images_verified:true,source_body_text_unavailable:true,legacy_passage_anchors:(record.passages||[]).length,legacy_provision_anchors:oldSections.length,body_text_checked:false,verification_scope:'All original pages rendered and hashed; original stored extraction retained separately. Selected passage review is separately recorded.',...scope}};
}
