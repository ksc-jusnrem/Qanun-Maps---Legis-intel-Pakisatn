import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createReadingVersion} from './reading-versions.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ids=['pk-code-8ae4279f59fd214b','pk-code-d0aea4d6f80cd068','pk-code-f40603913b933194','pk-code-f448d81f65f37230'];
const target=new URL('./repaired-records/',import.meta.url);fs.mkdirSync(target,{recursive:true});
for(const id of ids){
 const legacy=JSON.parse(fs.readFileSync('landing-pages/qanun-maps/laws/'+id+'.json','utf8'));
 const audit=JSON.parse(fs.readFileSync(new URL('./sources/cache/results/'+id+'.json',import.meta.url),'utf8'));
 if(!audit.original?.identity_checked)throw Error('Original identity unresolved '+id);
 if(sha(fs.readFileSync(audit.original.path))!==audit.original.sha256)throw Error('Original PDF bytes changed '+id);
 // Python's cache writer uses Windows newline translation; its extraction hash is over logical LF text.
 const text=fs.readFileSync(audit.original.extracted_text_path,'utf8').replace(/\r\n/g,'\n');
 if(audit.original.extracted_text_sha256&&sha(text)!==audit.original.extracted_text_sha256)throw Error('Original extraction bytes changed '+id);
 if(text.length<100)throw Error('Empty original text layer '+id);
 const original={sha256:audit.original.sha256,url:audit.original.url,pages:audit.original.pages,retrieved_at:audit.original.retrieved_at,method:audit.original.extraction_method};
 const record=createReadingVersion(legacy,text,original);
 fs.writeFileSync(new URL(id+'.json',target),JSON.stringify(record));console.log(JSON.stringify({id,source_pages:original.pages,legacy_characters:legacy.text.length,restored_characters:text.length,text_sha256:record.text_sha256}));
}
