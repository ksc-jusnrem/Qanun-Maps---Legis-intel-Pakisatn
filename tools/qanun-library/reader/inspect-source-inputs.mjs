import fs from 'node:fs';
for(const f of ['../sources/source-verification.json','../source-pagination.json']){const d=JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));console.log(f,JSON.stringify({keys:Object.keys(d),sample:Object.entries(d.records||{}).slice(0,1),pension:d.records?.['pk-code-4fd8caf7b4384576']},null,2));}
