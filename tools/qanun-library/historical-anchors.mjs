import fs from 'node:fs';
import path from 'node:path';
import {parseSections} from '../qanun-release/section-navigation.mjs';
const historicalCache=new Map();
const replaced=new Set(['pk-code-a2f0a11f70fdf902',...['./repaired-records/','./sources/reading-records/'].flatMap(p=>{const u=new URL(p,import.meta.url);return fs.existsSync(u)?fs.readdirSync(u).filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)):[];})]);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function historicalProvisionAnchors(id,record){
 if(historicalCache.has(id))return historicalCache.get(id);
 const file=new URL('../../landing-pages/qanun-maps/laws/'+id+'.html',import.meta.url);
 const stored=[...fs.readFileSync(file,'utf8').matchAll(/\bid="(provision-[^"]+)"/g)].map(m=>m[1]);
 const generated=replaced.has(id)?parseSections(record||JSON.parse(fs.readFileSync(new URL('../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'))).entries.map(e=>e.anchor):[];
 const result=[...new Set([...stored,...generated])];historicalCache.set(id,result);return result;
}
export function preserveHistoricalAnchors(record,html,anchors=historicalProvisionAnchors(record.id,record)){
 const initialIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const known=new Set([...anchors,...(record.passages||[]).map(p=>p.reader_fragment)]);let relocated=false;
 if(html.includes('data-reader-kind="original-facsimile"'))html=html.replace(/<span\b[^>]*\bid="([^"]+)"[^>]*><\/span>/g,(all,id)=>{if(known.has(id)){relocated=true;return '';}return all;});
 const original=html.match(/<pre id="source-transcription">([\s\S]*?)<\/pre>/);if(!original)throw Error('Missing historical transcription '+record.id);
 const historical=anchors,allIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const missing=historical.filter(id=>!initialIds.has(id));if(!missing.length&&!relocated)return {html,count:0,changed:false};
 const outside=html.replace(original[0],''),outsideIds=new Set([...outside.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const chars=Array.from(record.text),events=new Map(),add=(offset,value)=>events.set(offset,(events.get(offset)||'')+value);
 for(const id of historical){if(outsideIds.has(id))continue;const m=id.match(/-(\d+)$/);const at=m?Number(m[1]):NaN;if(!Number.isSafeInteger(at)||at<0||at>chars.length)throw Error('Invalid historical provision offset '+record.id+' '+id);add(at,'<span id="'+esc(id)+'" class="legacy-section-anchor"></span>');}
 for(const p of record.passages||[]){if(!outsideIds.has(p.reader_fragment))add(p.character_start,'<span id="'+esc(p.reader_fragment)+'" class="passage-anchor" data-passage-text="'+esc(chars.slice(p.character_start,p.character_end).join(''))+'"></span>');}
 let raw='';for(let i=0;i<=chars.length;i++){raw+=events.get(i)||'';if(i<chars.length)raw+=esc(chars[i]);}
 return {html:html.replace(original[0],'<pre id="source-transcription">'+raw+'</pre>'),count:missing.length,changed:true};
}
export function applyHistoricalAnchors({output,records,report}){
 let total=0;for(const r of records){const file=path.join(output,'laws',r.id+'.html');const result=preserveHistoricalAnchors(r,fs.readFileSync(file,'utf8'));if(result.changed)fs.writeFileSync(file,result.html);const rr=report.readers.find(x=>x.id===r.id);if(rr)rr.additional_historical_section_anchors=result.count;total+=result.count;}report.additional_historical_section_anchors=total;return total;
}
