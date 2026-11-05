import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBridge} from './bridge.mjs';
import {createHttpHandler,endpoint} from './http.mjs';
const token='b'.repeat(43);
test('bridge exchanges standard MCP messages with authenticated hosted handler',async()=>{
 const handle=createHttpHandler({getRegistry:()=>({grants:[{kind:'operator_pilot',active:true,subject:'bridge',audience:endpoint,expires_at:'2099-01-01',token_sha256:createHash('sha256').update(token).digest('hex'),tools:['find_legislation']}]}),getService:()=>({call:()=>({data:{matches:1}})})});
 const bridge=createBridge({token,fetchImpl:(url,options)=>{assert.equal(url,endpoint);assert.equal(options.redirect,'error');return handle(new Request(url,options));}});
 assert.equal((await bridge({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',clientInfo:{name:'bridge-test',version:'1'},capabilities:{}}})).result.serverInfo.name,'qanun-maps');
 assert.equal(await bridge({jsonrpc:'2.0',method:'notifications/initialized'}),null);
 assert.equal((await bridge({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools.length,1);
 assert.equal((await bridge({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'find_legislation',arguments:{query:'law'}}})).result.structuredContent.data.matches,1);
});
test('bridge rejects missing credentials, redirects, errors and mismatched response IDs without exposing keys',async()=>{
 assert.throws(()=>createBridge({token:''}));
 for(const response of [new Response('',{status:401}),Response.json({jsonrpc:'2.0',id:999,result:{}})]) {
 const bridge=createBridge({token,fetchImpl:async()=>response});await assert.rejects(bridge({jsonrpc:'2.0',id:1,method:'ping'}),e=>!e.message.includes(token));
 }
});
