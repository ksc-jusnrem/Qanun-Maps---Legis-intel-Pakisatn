// Local operator utility. Never run during a public build.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {endpoint} from './http.mjs';
import {toolDefinitions} from '../qanun-framework/service.mjs';
const dir=path.resolve(process.argv[2] || '');
if(!process.argv[2] || !path.relative(process.cwd(),dir).startsWith('..') || fs.existsSync(dir))throw Error('Choose a new private directory outside the repository');
fs.mkdirSync(dir,{recursive:true,mode:0o700});
const expires_at=new Date(Date.now()+30*86400000).toISOString();
const grants=['claude-code','claude-api','grok-api','vscode','other-client'].map(client=>{
 const token=randomBytes(32).toString('base64url');
 fs.writeFileSync(path.join(dir,client+'.token'),token+'\n',{mode:0o600,flag:'wx'});
 return {id:'owner-'+client,subject:'qanun-owner:'+client,kind:'operator_pilot',active:true,audience:endpoint,expires_at,tools:toolDefinitions.map(t=>t.name),token_sha256:createHash('sha256').update(token).digest('hex')};
});
fs.writeFileSync(path.join(dir,'registry.json'),JSON.stringify({grants},null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({clients:grants.map(g=>g.id),expires_at,secret_values_printed:false}));
