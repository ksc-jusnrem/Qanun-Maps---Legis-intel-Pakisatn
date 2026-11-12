import fs from 'node:fs';
import {readerInternals,renderLibraryReader} from '../reader.mjs';
const id=process.argv[2];const r=JSON.parse(fs.readFileSync(new URL('../../../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'));const text=fs.readFileSync(new URL('./candidates/'+id+'/fitz-original.txt',import.meta.url),'utf8');const lines=readerInternals.linesOf(text);const s=readerInternals.findStructure({...r,text},lines);
console.log('STRUCTURE',JSON.stringify({first:s.firstStrong,boundary:s.boundary,evidence:s.boundaryEvidence,contents:s.contents_numbers,entries:s.entries.map(e=>({number:e.number,title:e.title}))}));
for(let i=Math.max(0,s.boundary);i<lines.length;i++){const n=readerInternals.numbered(lines[i]);if(n){console.log(i,JSON.stringify(n),'DIRECT',JSON.stringify(readerInternals.headingCandidate(lines,i,new Map([['1',['Short title, extent and commencement']],['2',['Abolition of land revenue']],['3',['Saving']]]))));}}
console.log('VIEW',renderLibraryReader(r,{sourceLayoutText:text}).html.slice(0,1600));
