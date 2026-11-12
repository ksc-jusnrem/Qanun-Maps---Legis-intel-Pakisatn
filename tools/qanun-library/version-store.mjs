import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export function createLawVersionStore(output){
 function validate(id,record,download){if(record.id!==id||typeof record.text!=='string'||sha(record.text)!==record.text_sha256||record.text_version_id!=='law:'+id+':sha256:'+record.text_sha256)throw Error('Source integrity mismatch');if(!fs.readFileSync(download).equals(Buffer.from(record.text,'utf8')))throw Error('Source download mismatch');return record;}
 function versions(id){if(typeof id!=='string'||!/^[-a-z0-9]+$/.test(id))throw Error('Invalid instrument ID');const raw=path.join(output,'laws',id+'.json');if(!fs.existsSync(raw))throw Error('Instrument not held');const legacy=validate(id,JSON.parse(fs.readFileSync(raw,'utf8')),path.join(output,'laws',id+'.txt'));const currentPath=path.join(output,'reading-records',id+'.json');const current=fs.existsSync(currentPath)?validate(id,JSON.parse(fs.readFileSync(currentPath,'utf8')),path.join(output,'laws',id+'.reader.txt')):legacy;return current.text_version_id===legacy.text_version_id?[legacy]:[current,legacy];}
 return {versions,read:(id,version)=>{const held=versions(id),record=version?held.find(r=>r.text_version_id===version):held[0];if(!record)throw Error('Requested version not held');return record;}};
}
