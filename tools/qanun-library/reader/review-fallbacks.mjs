import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync(new URL('./coverage.json',import.meta.url),'utf8'));
for(const item of c.records.filter(x=>x.status==='paragraph_source_transcription')){const r=JSON.parse(fs.readFileSync(new URL('../../../landing-pages/qanun-maps/laws/'+item.id+'.json',import.meta.url),'utf8'));console.log(JSON.stringify({id:r.id,title:r.title,characters:r.text.length,source:r.source_url,start:r.text.slice(0,1100)}));}
