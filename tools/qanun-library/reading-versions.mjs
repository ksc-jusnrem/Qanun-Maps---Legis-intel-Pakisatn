import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createReadingVersion(legacy,text,original){
 const textSha=sha(text),points=Array.from(text),passages=[];let byte=0;
 for(let start=0;start<points.length;start+=1600){const end=Math.min(points.length,start+1600),quote=points.slice(start,end).join(''),bytes=Buffer.byteLength(quote),quoteSha=sha(quote);passages.push({passage_id:`law:${legacy.id}:sha256:${textSha}:chars-${start}-${end}:${quoteSha}`,character_start:start,character_end:end,utf8_byte_start:byte,utf8_byte_end:byte+bytes,passage_sha256:quoteSha,reader_fragment:`p-r-${textSha.slice(0,8)}-${start}-${end}-${quoteSha.slice(0,16)}`});byte+=bytes;}
 return{...legacy,text,text_sha256:textSha,source_sha256:original.sha256,text_version_id:`law:${legacy.id}:sha256:${textSha}`,source_url:original.url||legacy.source_url,source_snapshot:original.retrieved_at||null,version:`Full identified original source: ${original.pages||'all'} PDF pages; original SHA-256 ${original.sha256}`,text_quality:'Complete source-derived reading transcription. The earlier extraction is preserved separately; current force and later amendment history are not certified.',passages,reading_provenance:{original,legacy_text_sha256:legacy.text_sha256,legacy_text_version_id:legacy.text_version_id,extracted_text_sha256:textSha,scope:'All text-bearing pages in the identified original source; no extraction page cap.'}};
}

export function loadReadingVersions(records){
 const restored=new Map();
 for(const record of records){for(const base of [new URL('./repaired-records/',import.meta.url),new URL('./sources/reading-records/',import.meta.url)]){const file=new URL(record.id+'.json',base);if(!fs.existsSync(file))continue;const data=JSON.parse(fs.readFileSync(file,'utf8')),reading=data.record||data;if(!reading.text||reading.id!==record.id||sha(reading.text)!==reading.text_sha256)throw Error('Invalid restored reading version '+record.id);restored.set(record.id,reading);break;}}
 const manual=JSON.parse(fs.readFileSync(new URL('./railways-collation.json',import.meta.url),'utf8'));
 const legacy=records.find(r=>r.id===manual.record_id);if(legacy){const text=manual.pages.map(p=>p.paragraphs.join('\n\n')).join('\n\n');restored.set(legacy.id,createReadingVersion(legacy,text,{sha256:manual.source_pdf_sha256,url:manual.source_url,pages:manual.pages.length,retrieved_at:null,method:'Independent full-page visual collation of original Gazette scan'}));}
 return restored;
}

export function preserveLegacyVersion(legacy,reader){
 const html=reader.html.replace(/id="source-transcription"/g,'id="reading-source-transcription"').replace(/id="original-transcription"/g,'id="reading-source-details"').replace('Earlier OCR extraction — contains transcription errors','Source-collated reading transcription').replace('This is the preserved earlier extraction, not the corrected reading text. Its legacy passage identifiers remain available.','This is the current source-collated reading transcription. The earlier extraction and its historical identifiers are retained below.');
 const events=new Map(),add=(n,s)=>events.set(n,(events.get(n)||'')+s);
 for(const p of legacy.passages)add(p.character_end,'</span>');for(const p of legacy.passages)add(p.character_start,`<span id="${esc(p.reader_fragment)}" class="passage-anchor">`);
 const points=Array.from(legacy.text);let raw='';for(let i=0;i<=points.length;i++){raw+=events.get(i)||'';if(i<points.length)raw+=esc(points[i]);}
 const archive=`<details class="original-transcription" id="original-transcription"><summary>Earlier extracted version and historical passage links</summary><p>This earlier extraction is preserved for provenance. The reading edition above was recovered or corrected against the identified original source. Earlier text SHA-256: ${esc(legacy.text_sha256)}.</p><pre id="source-transcription">${raw}</pre></details>`;
 return{...reader,html:html+archive,report:{...reader.report,legacy_input_sha256:legacy.text_sha256,reading_version_restored:true}};
}
