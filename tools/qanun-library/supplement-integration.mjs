import fs from 'node:fs';
import path from 'node:path';
import {renderSourceSupplements} from './reader/supplements.mjs';
export function appendSourceSupplements({output,records,sourceRecords,report}){
 let total=0,count=0;
 for(const record of records){
  const part=renderSourceSupplements(record,{output,sourceStatus:sourceRecords[record.id]});if(!part)continue;
  const file=path.join(output,'laws',record.id+'.html');let html=fs.readFileSync(file,'utf8');
  if(html.includes('id="source-image-supplements"'))throw Error('Supplement already integrated '+record.id);
  if(!html.includes('<section id="library-relationships"'))throw Error('No mapping insertion boundary '+record.id);
  html=html.replace('<section id="library-relationships"',part.html+'<section id="library-relationships"');
  html=html.replace(/(<aside class="contents"[^>]*>[\s\S]*?)(<\/aside>)/,(all,body,end)=>body+part.nav+end);
  html=html.replace('</head>','<style>'+part.css+'</style></head>');
  html=html.replace('<h2>Original-source comparison</h2>','<h2>Original-source comparison</h2><p><a href="#source-image-supplements">Read the original graphic and form pages retained with this law.</a> Their visual content is separate from the text comparison below.</p>');
  fs.writeFileSync(file,html);
  Object.assign(report.readers.find(r=>r.id===record.id),part.report);
  sourceRecords[record.id].original_graphic_supplements={...part.report};
  total+=part.report.source_image_supplement_pages;count++;
 }
 report.source_graphic_supplement_records=count;report.source_graphic_supplement_pages=total;
 return {records:count,pages:total};
}
