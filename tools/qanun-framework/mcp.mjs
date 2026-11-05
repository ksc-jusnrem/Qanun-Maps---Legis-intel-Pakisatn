import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import {createService,toolDefinitions} from './service.mjs';
import {authorise} from './entitlement.mjs';

export function createDispatcher(service,getRegistry,getToken) {
  let state='new',calls=0;
  return message=>{
    const id=message?.id??null;
    const error=(code,text)=>({jsonrpc:'2.0',id,error:{code,message:text}});
    if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||(message.id!==undefined&&typeof message.id!=='string'&&typeof message.id!=='number'))return error(-32600,'Invalid request');
    if(message.method==='notifications/initialized'&&state==='initializing'){state='ready';return null;}
    if(message.id===undefined)return null;
    const result=data=>({jsonrpc:'2.0',id,result:data});
    if(message.method==='ping')return result({});
    if(message.method==='initialize'){
      if(state!=='new')return error(-32600,'Already initialized');
      if(!message.params?.protocolVersion||!message.params?.clientInfo||!message.params?.capabilities)return error(-32602,'Initialization parameters required');
      state='initializing';return result({protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'qanun-evidence-research',version:'1.0.0'},instructions:'Source-linked research only. Structured checklists are not complete legal tests. Respect each evidence and review limitation.'});
    }
    if(state!=='ready')return error(-32000,'Initialize the session first');
    if(message.method==='tools/list')return result({tools:toolDefinitions});
    if(message.method!=='tools/call')return error(-32601,'Method not found');
    const name=message.params?.name;
    if(!toolDefinitions.some(t=>t.name===name))return error(-32602,'Unknown tool');
    try {
      const grant=authorise(getRegistry(),getToken(),name);
      if(calls>=grant.session_call_limit)throw Error('Session call limit reached');
      calls++;
      const data=service.call(name,message.params.arguments??{});
      return result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false});
    }catch(e){return result({content:[{type:'text',text:e.message==='Session call limit reached'?e.message:e.message==='Access denied'?'Access denied':String(e.message).replace(/[\r\n]/g,' ').slice(0,200)}],isError:true});}
  };
}

export function startStdio() {
  const output=process.env.QANUN_PUBLIC_DIR||path.resolve('landing-pages/qanun-maps');
  const registry=process.env.QANUN_ENTITLEMENTS_FILE;
  // Do not create grants, write credentials or accept a registry in public assets.
  if(registry){const relative=path.relative(fs.realpathSync(output),fs.realpathSync(registry));if(relative===''||(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)))throw Error('Entitlement registry must be outside public output');}
  const dispatch=createDispatcher(createService(output),()=>{try{return registry?JSON.parse(fs.readFileSync(registry,'utf8')):null;}catch{return null;}},()=>process.env.QANUN_ACCESS_TOKEN);
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  lines.on('line',line=>{let response;try{if(Buffer.byteLength(line)>65536)throw Error('too large');response=dispatch(JSON.parse(line));}catch{response={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid or oversized JSON'}};}if(response)process.stdout.write(JSON.stringify(response)+'\n');});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{startStdio();}catch{process.stderr.write('Qanun MCP startup failed: check source integrity and private configuration.\n');process.exitCode=1;}}
