#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function createBridge({token, fetchImpl=fetch}) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token || '')) throw Error('Set QANUN_ACCESS_TOKEN or QANUN_TOKEN_FILE to an issued access key');
  let version='2025-06-18';
  return async message => {
    const response=await fetchImpl('https://www.jusnrem.legal/mcp',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
      headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token,'MCP-Protocol-Version':version},
      body:JSON.stringify(message)
    });
    if(response.status===202) return null;
    if(!response.ok) throw Error('Legis-Intel MCP connection failed (HTTP '+response.status+')');
    const body=await response.json();
    if(body.jsonrpc!=='2.0' || body.id!==message.id) throw Error('Invalid MCP response');
    if(message.method==='initialize' && body.result?.protocolVersion)version=body.result.protocolVersion;
    return body;
  };
}

export async function runBridge(input=process.stdin,output=process.stdout,send) {
  try {send??=createBridge({token:process.env.QANUN_ACCESS_TOKEN || (process.env.QANUN_TOKEN_FILE?fs.readFileSync(process.env.QANUN_TOKEN_FILE,'utf8').trim():'')});}
  catch {process.stderr.write('Legis-Intel MCP: a valid access key or readable token file is required.\n');process.exitCode=1;return;}
  let pending='';
  input.setEncoding('utf8');
  for await (const chunk of input) {
    pending+=chunk.toString('utf8');
    while(pending.includes('\n')) {
      const end=pending.indexOf('\n'),line=pending.slice(0,end);pending=pending.slice(end+1);
      if(Buffer.byteLength(line)>65536){process.stderr.write('Legis-Intel MCP: message too large.\n');process.exitCode=1;return;}
      if(!line.trim())continue;
      let message;
      try {message=JSON.parse(line);} catch {output.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}})+'\n');continue;}
      if(!message || Array.isArray(message) || message.jsonrpc!=='2.0' || typeof message.method!=='string') {output.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}})+'\n');continue;}
      try {const result=await send(message);if(result)output.write(JSON.stringify(result)+'\n');}
      catch {if(message && Object.hasOwn(message,'id'))output.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32603,message:'Legis-Intel MCP connection failed; check access key, network and client configuration'}})+'\n');}
    }
    if(Buffer.byteLength(pending)>65536){process.stderr.write('Legis-Intel MCP: message too large.\n');process.exitCode=1;return;}
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runBridge();
