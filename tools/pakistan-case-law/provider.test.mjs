import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,callProvider,ResearchError,endpoint} from './provider.mjs';
import {createHandler} from './http.mjs';
const response=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const req=(body,extra={})=>new Request('https://jusnrem.legal/api/case-law',{method:'POST',headers:{origin:'https://jusnrem.legal','content-type':'application/json',...extra},body:JSON.stringify(body)});
test('allowlist, bounds and incompatible filters reject invalid requests',()=>{
  for(const input of [{action:'__proto__'},{action:'delete'}, {action:'case',arguments:{case_id:-1}},{action:'search',arguments:{query:'tax',offset:201}},{action:'search',arguments:{query:'tax',url:'https://evil.example'}},{action:'search',arguments:{query:'tax',year_from:2025,year_to:2020}},{action:'case',arguments:{case_id:1,paras:'<script>'}},{action:'questions',arguments:{query:''}},{action:'citation',arguments:{page:12}}])assert.throws(()=>validate(input),e=>e.status===400);
  assert.equal(validate({action:'search',arguments:{query:'tax'}}).arguments.limit,10);
  assert.equal(validate({action:'case',arguments:{case_id:1,paras:'2:3-5'}}).arguments.paras,'2:3-5');
  assert.equal(validate({action:'citation',arguments:{journal:'2024 SCMR 117'}}).name,'caselaw_lookup_citation');
});
test('MCP handshake, fragmented SSE, fixed destination and session cleanup',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});assert.equal(url,endpoint);
    if(options.method==='DELETE')return new Response(null,{status:204});
    const m=JSON.parse(options.body);
    if(m.method==='initialize')return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-03-26'}}),{headers:{'content-type':'application/json','mcp-session-id':'test-session'}});
    assert.equal(options.headers['Mcp-Session-Id'],'test-session');
    if(m.method==='notifications/initialized')return new Response(null,{status:202});
    assert.equal(m.params.name,'caselaw_search');
    const s=': keepalive\r\n\r\nevent: message\r\ndata: '+JSON.stringify({jsonrpc:'2.0',id:2,result:{structuredContent:{result:JSON.stringify({total:1,items:[{id:1,title:'A < B'}]})},isError:false}})+'\r\n\r\n';
    return new Response(new ReadableStream({start(c){for(let i=0;i<s.length;i+=7)c.enqueue(new TextEncoder().encode(s.slice(i,i+7)));c.close();}}),{headers:{'content-type':'text/event-stream'}});
  };
  const data=await callProvider(validate({action:'search',arguments:{query:'tax'}}),{fetchImpl});
  assert.equal(data.items[0].title,'A < B');assert.equal(calls.length,4);assert.equal(calls.at(-1).options.method,'DELETE');
});
test('upstream 429 is preserved with retry guidance and never retried',async()=>{
  let count=0;await assert.rejects(callProvider(validate({action:'landmarks'}),{fetchImpl:async()=>{count++;return new Response('limited',{status:429,headers:{'Retry-After':'60'}});}}),e=>e.status===429&&e.retryAfter===60);assert.equal(count,1);
});
test('HTTP errors, origin checks and unknown actions never become empty successes',async()=>{
  let calls=0;const handle=createHandler({provider:async()=>{calls++;return {items:[],total:0};}});
  assert.equal((await handle(req({action:'search',arguments:{query:'tax'}},{origin:'https://evil.example'}))).status,403);
  assert.equal((await handle(req({action:'invalid'}))).status,400);
  assert.equal((await handle(req({action:'search',arguments:{query:'a'.repeat(9000)}}))).status,413);
  assert.equal(calls,0);
  const good=await handle(req({action:'search',arguments:{query:'tax'}}));assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'private, no-store');assert.equal((await good.json()).data.total,0);
  const failed=createHandler({provider:async()=>{throw new ResearchError('Provider unavailable',502);}});
  const bad=await failed(req({action:'landmarks'}));assert.equal(bad.status,502);assert.equal((await bad.json()).data,undefined);
});
test('local burst limit and provider cooldown do not call upstream again',async()=>{
  let calls=0,time=1000;const handle=createHandler({now:()=>time,provider:async()=>{calls++;throw new ResearchError('Limited',429,60);}});
  assert.equal((await handle(req({action:'landmarks'}))).status,429);
  assert.equal((await handle(req({action:'landmarks'}))).status,429);assert.equal(calls,1);
  time=62000;await handle(req({action:'landmarks'}));assert.equal(calls,2);
  const ok=createHandler({provider:async()=>({items:[]})});for(let i=0;i<30;i++)assert.equal((await ok(req({action:'landmarks'}))).status,200);
  assert.equal((await ok(req({action:'landmarks'}))).status,429);
});
