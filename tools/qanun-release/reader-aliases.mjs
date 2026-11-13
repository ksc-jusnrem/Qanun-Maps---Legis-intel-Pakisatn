import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createReaderRoutes,canonicalReaderLinks} from './canonical-readers.mjs';
import {readerRoutes} from './reader-routes.mjs';
import {displayRecordTitle} from '../qanun-library/record-display.mjs';

export function materializeReaderAliases(output,records,{routes=readerRoutes}={}) {
 assert.deepEqual(createReaderRoutes(records.map(record=>({...record,title:displayRecordTitle(record)}))),routes,'Reader-route manifest differs from held corpus; review and regenerate it deliberately');
 // Only HTML hrefs change. Raw JSON/TXT, source registers, model IDs and tool output are untouched.
 for(const name of fs.readdirSync(output).filter(n=>n.endsWith('.html'))){const file=path.join(output,name);fs.writeFileSync(file,canonicalReaderLinks(fs.readFileSync(file,'utf8'),routes));}
 for(const record of records){
  const original=path.join(output,'laws',record.id+'.html');const html=canonicalReaderLinks(fs.readFileSync(original,'utf8'),routes);fs.writeFileSync(original,html);
  const alias=path.join(output,routes[record.id].slice(1)+'.html');
  // A hard link is a regular file, not a symlink; avoids duplicating a large corpus on build disk.
  try{fs.linkSync(original,alias);}catch(error){if(!['EXDEV','EPERM','ENOTSUP'].includes(error.code))throw error;fs.copyFileSync(original,alias);}
 }
 fs.writeFileSync(path.join(output,'data','reader-routes.json'),JSON.stringify({schema_version:'legis-intel-reader-routes/1',records:records.length,routes}));
 return {canonical_readers:records.length,legacy_reader_status:301,downloads_and_record_ids_unchanged:true};
}
