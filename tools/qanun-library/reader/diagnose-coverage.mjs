import fs from 'node:fs';
import {readerInternals} from './reader.mjs';
const coverage=JSON.parse(fs.readFileSync(new URL('./coverage.json',import.meta.url),'utf8'));
const examples=[...coverage.records.filter(x=>x.provision_count===0).slice(0,10),...coverage.records.filter(x=>x.unmatched_contents_numbers.length>30).sort((a,b)=>b.unmatched_contents_numbers.length-a.unmatched_contents_numbers.length).slice(0,8)];
for(const c of examples){const r=JSON.parse(fs.readFileSync(new URL('../../../landing-pages/qanun-maps/laws/'+c.id+'.json',import.meta.url),'utf8'));const l=readerInternals.linesOf(r.text);const s=readerInternals.findStructure(r,l);console.log(JSON.stringify({id:r.id,title:r.title,count:s.entries.length,first:s.firstStrong,scope:s.entries[0]?.scope,start:l.slice(Math.max(0,s.firstStrong-2),s.firstStrong+4).map(x=>x.text),firsttext:r.text.slice(0,900),unmatched:s.unmatched_contents_numbers.length}));}
