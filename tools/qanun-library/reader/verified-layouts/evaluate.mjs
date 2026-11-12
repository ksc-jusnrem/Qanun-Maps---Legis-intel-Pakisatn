import fs from 'node:fs';
import {renderLibraryReader} from '../reader.mjs';
const probes=JSON.parse(fs.readFileSync(new URL('./probe-results.json',import.meta.url),'utf8'));
const rows=[];
for(const row of probes){
 const record=JSON.parse(fs.readFileSync(new URL('../../../../landing-pages/qanun-maps/laws/'+row.id+'.json',import.meta.url),'utf8'));
 const methods=[];
 for(const method of row.methods.filter(m=>m.literal_stream_equal)){
   const text=fs.readFileSync(method.path,'utf8');const out=renderLibraryReader(record,{sourceLayoutText:text});
   const lines=text.split(/\r?\n/).filter(l=>l.trim());
   const metrics={method:method.method,path:method.path,provisions:out.provisions.map(p=>({number:p.number,title:p.title,scope:p.scope})),unmatched:out.report.unmatched_contents_numbers,word_fidelity:out.report.visible_content_preserved,punctuation_fidelity:out.report.visible_punctuation_preserved,short_line_fraction:lines.filter(l=>l.trim().length<=3).length/Math.max(1,lines.length),alignment_failures:out.report.structural_ambiguities.filter(p=>/alignment|mismatch/.test(p.reason)),opening:text.slice(0,800)};
   methods.push(metrics);
 }
 rows.push({id:row.id,title:row.title,methods});console.log(JSON.stringify(rows.at(-1)));
}
fs.writeFileSync(new URL('./evaluation.json',import.meta.url),JSON.stringify(rows,null,2));
