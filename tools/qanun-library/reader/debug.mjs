import fs from 'node:fs';
import {readerInternals} from './reader.mjs';
for(const id of process.argv.slice(2)){
 const r=JSON.parse(fs.readFileSync(new URL('../../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'));
 const lines=r.text.split(/\r?\n/);console.log(id);
 for(let i=0;i<lines.length;i++)if(/Right to speak|Restriction on discussion|Omitted.*71|71.*Omitted/.test(lines[i]))console.log(i+1,JSON.stringify(lines.slice(Math.max(0,i-1),i+4)));
 const detail=readerInternals.linesOf(r.text);for(let i=0;i<detail.length;i++)if(/^57\./.test(detail[i].text)){const toc=new Map([['57',['Right to speak in Majlis-e-Shoora (Parliament)']]]);const rest=detail[i].text.replace(/^57\.\s*/,'');const used=readerInternals.matchTitlePrefix(rest,'Right to speak in Majlis-e-Shoora (Parliament)');console.log('NUMBERED',readerInternals.numbered(detail[i]));console.log('PREFIX57',used,JSON.stringify(rest.slice(used)),/^\s*[.:](?:\s*[—–_-])?(?=\s|[—–_(-])/u.test(rest.slice(used)));console.log('CANDIDATE57',readerInternals.headingCandidate(detail,i,toc));}
}
