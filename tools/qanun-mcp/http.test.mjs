import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHttpHandler,endpoint,authenticate} from './http.mjs';
import {createService,toolDefinitions} from '../qanun-framework/service.mjs';
const token='a'.repeat(43), now=Date.parse('2026-11-05');
const grant={token_sha256:createHash('sha256').update(token).digest('hex'),kind:'operator_pilot',active:true,subject:'test',audience:endpoint,expires_at:'2026-12-01',tools:toolDefinitions.map(t=>t.name)};
let service;
const handler=createHttpHandler({getService:()=>service??=createService('landing-pages/qanun-maps'),getRegistry:()=>({grants:[grant]}),now:()=>now});
const msg=(method,params={},id=1)=>({jsonrpc:'2.0',id,method,params});
function request(message=msg('ping'),headers={},method='POST',url=endpoint) {
 return new Request(url,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json, text/event-stream',...headers},...(method==='POST'?{body:typeof message==='string'?message:JSON.stringify(message)}:{})});
}
test('authentication fails closed for expired, revoked, wrong audience, paid and invalid-scope grants',()=>{
 assert.ok(authenticate('Bearer '+token,{grants:[grant]},now));
 for(const patch of [{expires_at:'2020-01-01'},{expires_at:'invalid'},{active:false},{revoked:true},{audience:'https://other.example/mcp'},{kind:'individual_monthly'},{tools:['unknown']},{token_sha256:'bad'}])assert.equal(authenticate('Bearer '+token,{grants:[{...grant,...patch}]},now),null);
});
test('unauthenticated requests cannot list or execute tools',async()=>{
 for(const authorization of ['', 'Bearer wrong', 'Bearer '+'b'.repeat(43)]) {
 const response=await handler(request(msg('tools/list'),{authorization}));assert.equal(response.status,401);assert.match(response.headers.get('www-authenticate'),/Bearer/);
 assert.equal((await response.json()).result,undefined);
 }
});
test('origin, transport and size checks reject malformed requests',async()=>{
 for(const [message,headers,method,url,status] of [
 [msg('ping'),{origin:'https://evil.example'},'POST',endpoint,403],
 [msg('ping'),{},'POST','https://evil.example/mcp',403],
 [msg('ping'),{},'GET',endpoint,405],
 [msg('ping'),{'content-type':'text/plain'},'POST',endpoint,415],
 [msg('ping'),{accept:'text/html'},'POST',endpoint,406],
 [msg('ping'),{'mcp-protocol-version':'bad'},'POST',endpoint,400],
 ['{bad',{},'POST',endpoint,400], [[],{},'POST',endpoint,400],
 ['x'.repeat(65537),{},'POST',endpoint,413],
 [msg('ping'),{},'POST',endpoint+'?token=unsafe',400]
 ])assert.equal((await handler(request(message,headers,method,url))).status,status);
});
test('initialization negotiates protocol, notifications have no body and tools declare read-only behavior',async()=>{
 const init=await (await handler(request(msg('initialize',{protocolVersion:'future',capabilities:{},clientInfo:{name:'test',version:'1'}})))).json();assert.equal(init.result.protocolVersion,'2025-06-18');
 const notification=await handler(request({jsonrpc:'2.0',method:'notifications/initialized'}));assert.equal(notification.status,202);assert.equal(await notification.text(),'');
 const listed=await (await handler(request(msg('tools/list')))).json();assert.equal(listed.result.tools.length,9);assert.ok(listed.result.tools.every(t=>t.annotations.readOnlyHint));
});
test('per-client tool scopes restrict both discovery and execution',async()=>{
 const restricted=createHttpHandler({getService:()=>{throw Error('must not execute');},getRegistry:()=>({grants:[{...grant,tools:['find_legislation']}]}),now:()=>now});
 assert.equal((await (await restricted(request(msg('tools/list')))).json()).result.tools.length,1);
 assert.equal((await (await restricted(request(msg('tools/call',{name:'coverage_gaps'})))).json()).error.code,-32003);
});
test('real held corpus returns citations and safely refuses unheld versions and paths',async()=>{
 const call=async(name,args)=> (await (await handler(request(msg('tools/call',{name,arguments:args})))).json()).result;
 const found=await call('find_legislation',{query:'Health Care Commission'});assert.equal(found.isError,false);assert.ok(found.structuredContent.data.matches>=2);
 const result=found.structuredContent.data.results[0];assert.match(result.source_url,/^https:/);assert.equal(result.current_force,null);
 assert.equal((await call('get_provision',{instrument_id:'../../secret',version_id:'x',fragment:'p1'})).isError,true);
 assert.equal((await call('get_provision',{instrument_id:result.id,version_id:'unheld',fragment:'p1'})).isError,true);
 const rule=service.model.rules[0];
 assert.equal((await call('assess_rule',{rule_id:rule.id,facts:{}})).structuredContent.data.outcome,'UNDETERMINED');
});
