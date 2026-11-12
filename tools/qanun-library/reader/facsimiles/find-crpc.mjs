import fs from 'node:fs';
const folder=new URL('../../../../landing-pages/qanun-maps/laws/',import.meta.url);
for(const f of fs.readdirSync(folder).filter(f=>f.endsWith('.json'))){const r=JSON.parse(fs.readFileSync(new URL(f,folder),'utf8'));if(/criminal.*procedure/i.test(r.title))console.log(JSON.stringify({id:r.id,title:r.title}));}
