import fs from 'node:fs';
import {renderLibraryReader} from './reader.mjs';
for(const id of process.argv.slice(2)){
 const r=JSON.parse(fs.readFileSync(new URL('../../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'));
 const out=renderLibraryReader(r);console.log(JSON.stringify({id,preserved:out.report.visible_content_preserved,counts:out.provisions.length,unmatched:out.report.unmatched_contents_numbers,provisions:out.provisions.filter(p=>p.scope==='main').map(({number,title,scope})=>({number,title,scope}))}));
}
