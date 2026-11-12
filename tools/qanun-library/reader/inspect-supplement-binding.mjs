import fs from 'node:fs';import crypto from 'node:crypto';
const id='pk-code-f40603913b933194';const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const r=read('../../../landing-pages/qanun-maps/laws/'+id+'.json'),a=read('../sources/source-verification.json').records[id],i=read('../sources/source-supplement-inventory.json').records.find(r=>r.id===id);
console.log(JSON.stringify({record:{text_sha256:r.text_sha256,actual:crypto.createHash('sha256').update(r.text).digest('hex')},audit:a,inventory:i},null,2));
const u=new URL('./supplement-assets/manifest.json',import.meta.url),m=read('./supplement-assets/manifest.json');if(m.records.length!==read('../sources/source-supplement-inventory.json').records.length){m.status='rendering';fs.writeFileSync(u,JSON.stringify(m,null,2));}
