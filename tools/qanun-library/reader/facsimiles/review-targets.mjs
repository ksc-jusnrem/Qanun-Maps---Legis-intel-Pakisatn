import fs from 'node:fs';
import crypto from 'node:crypto';
import {renderLibraryReader} from '../reader.mjs';
const rows=[];
for(const [id,number] of [['pk-code-30ecabb4a7ed433a','89'],['pk-code-bd227b13c09b48ba','21'],['pk-code-03404b539b9d2a9b','32']]){
 const r=JSON.parse(fs.readFileSync(new URL('../../../../landing-pages/qanun-maps/laws/'+id+'.json',import.meta.url),'utf8'));
 const p=renderLibraryReader(r).provisions.find(p=>p.scope==='main'&&p.number===number);if(!p)throw Error('Target provision not identified');
 const chars=Array.from(r.text);const end=Math.min(p.character_end,p.character_start+1000);const quote=chars.slice(p.character_start,end).join('');
 rows.push({record_id:id,title:r.title,source_url:r.source_url,text_sha256:r.text_sha256,text_version_id:r.text_version_id,provision_number:number,provision_title:p.title,reader_anchor:p.anchor,character_start:p.character_start,character_end:end,quote,quote_sha256:crypto.createHash('sha256').update(quote).digest('hex'),review_scope:'Held target provision opening read; original source verification belongs to separate source audit; current force and later changes not checked.'});
}
fs.writeFileSync(new URL('./reviewed-target-passages.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
