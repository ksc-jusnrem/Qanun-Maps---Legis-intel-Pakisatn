import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {createDispatcher} from './mcp.mjs';import {authorise,tokenHash} from './entitlement.mjs';import {createService,toolDefinitions} from './service.mjs';
const token='test-only-noncredential-01234567890123456789';
const grant={token_sha256:tokenHash(token),subject:'fixture-user',plan:'individual_monthly',status:'active',expires_at:'2099-01-01T00:00:00Z',tools:toolDefinitions.map(t=>t.name),session_call_limit:10};
const init={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}};
const notification={jsonrpc:'2.0',method:'notifications/initialized'};
test('entitlement policy denies missing expired revoked disallowed and excess-seat grants',()=>{
 assert.throws(()=>authorise(null,null,'get_rule'));assert.equal(authorise({grants:[grant]},token,'get_rule').subject,'fixture-user');
 for(const change of [{status:'inactive'},{revoked_at:'2026-01-01'},{expires_at:'2000-01-01'},{tools:[]},{plan:'free'},{session_call_limit:0}])assert.throws(()=>authorise({grants:[{...grant,...change}]},token,'get_rule'));
 const g={...grant,plan:'institutional',institution_id:'i'},a={id:'i',status:'active',seat_limit:1,active_subjects:['fixture-user'],permitted_tools:['get_rule'],expires_at:'2099-01-01'};
 assert.equal(authorise({grants:[g],institutions:[a]},token,'get_rule').plan,'institutional');
 for(const change of [{active_subjects:['fixture-user','other']},{active_subjects:['other']},{status:'revoked'},{permitted_tools:[]}])assert.throws(()=>authorise({grants:[g],institutions:[{...a,...change}]},token,'get_rule'));
});
test('MCP lifecycle, real research call, live revocation and session limit',()=>{
 const service=createService('landing-pages/qanun-maps');let registry={grants:[{...grant,session_call_limit:1}]};const dispatch=createDispatcher(service,()=>registry,()=>token);
 const call={jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'coverage_gaps',arguments:{}}};
 assert.ok(dispatch(call).error);assert.equal(dispatch(init).result.protocolVersion,'2025-06-18');dispatch(notification);
 assert.equal(dispatch({jsonrpc:'2.0',id:2,method:'tools/list'}).result.tools.length,toolDefinitions.length);
 assert.equal(dispatch(call).result.isError,false);assert.equal(dispatch(call).result.isError,true);
 registry.grants[0].revoked_at='now';assert.match(dispatch(call).result.content[0].text,/Access denied/);
});
test('stdio process executes JSON-RPC and denies anonymous tool access',{timeout:30000},async()=>{
 const child=spawn(process.execPath,['tools/qanun-framework/mcp.mjs'],{env:{...process.env,QANUN_ACCESS_TOKEN:'',QANUN_ENTITLEMENTS_FILE:''},stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
 const closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code));});
 child.stdin.end([init,notification,{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'coverage_gaps',arguments:{}}}].map(JSON.stringify).join('\n')+'\n');
 assert.equal(await closed,0,err);const messages=out.trim().split('\n').map(JSON.parse);assert.equal(messages.length,3);assert.equal(messages[1].result.tools.length,toolDefinitions.length);assert.equal(messages[2].result.isError,true);
});
