import {createHash, timingSafeEqual} from 'node:crypto';
import {toolDefinitions} from '../qanun-framework/service.mjs';

export const endpoint = 'https://www.jusnrem.legal/mcp';
export const versions = ['2025-06-18', '2025-03-26', '2024-11-05'];
const maxBytes = 65536;
const json = (status, body, extra = {}) => new Response(body === null ? null : JSON.stringify(body), {
  status, headers: {'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extra}
});
const error = (status, id, code, message, extra) => json(status, {jsonrpc:'2.0',id,error:{code,message}},extra);

// Operator-issued pilot access is deliberately separate from subscription entitlements.
// Store only token hashes on the host. Removing a grant and redeploying revokes it.
export function authenticate(header, registry, now = Date.now()) {
  const token = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(header || '')?.[1];
  if (!token || !Array.isArray(registry?.grants)) return null;
  const hash = createHash('sha256').update(token).digest();
  return registry.grants.find(g => {
    if (!/^[a-f0-9]{64}$/.test(g.token_sha256 || '')) return false;
    return timingSafeEqual(hash, Buffer.from(g.token_sha256,'hex')) &&
      g.kind === 'operator_pilot' && g.active === true && !g.revoked &&
      typeof g.subject === 'string' && g.subject.length > 0 && g.audience === endpoint &&
      Number.isFinite(Date.parse(g.expires_at)) && Date.parse(g.expires_at) > now &&
      Array.isArray(g.tools) && g.tools.length > 0 && g.tools.every(n => toolDefinitions.some(t => t.name === n));
  }) || null;
}

export function createHttpHandler({getService, getRegistry, now = Date.now, allowedHosts = ['www.jusnrem.legal','jusnrem.legal']}) {
  return async request => {
    const url = new URL(request.url);
    if (!allowedHosts.includes(url.host)) return error(403,null,-32600,'Host not permitted');
    if (url.search) return error(400,null,-32600,'Query parameters are not accepted');
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(endpoint).origin) return error(403,null,-32600,'Origin not permitted');
    let registry;
    try { registry = getRegistry(); } catch { return error(503,null,-32603,'Access configuration unavailable'); }
    const grant = authenticate(request.headers.get('authorization'),registry,now());
    if (!grant) return error(401,null,-32001,'Valid Qanun Maps access key required',{'WWW-Authenticate':'Bearer realm="qanun-maps"'});
    if (request.method !== 'POST') return error(405,null,-32600,'Use POST for MCP messages',{'Allow':'POST'});
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error(415,null,-32600,'Content-Type must be application/json');
    const accept = request.headers.get('accept') || '';
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) return error(406,null,-32600,'Accept must include application/json and text/event-stream');
    const protocol = request.headers.get('mcp-protocol-version');
    if (protocol && !versions.includes(protocol)) return error(400,null,-32600,'Unsupported MCP protocol version');
    if (Number(request.headers.get('content-length')) > maxBytes) return error(413,null,-32600,'Message too large');
    let message;
    try {
      const reader = request.body?.getReader();
      if (!reader) return error(400,null,-32700,'JSON body required');
      const chunks=[]; let size=0;
      for (;;) {const {done,value}=await reader.read(); if(done)break; size+=value.byteLength;
        if(size>maxBytes){await reader.cancel();return error(413,null,-32600,'Message too large');} chunks.push(Buffer.from(value));}
      message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return error(400,null,-32700,'Invalid JSON'); }
    const id = message?.id ?? null;
    if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
        (Object.hasOwn(message,'id') && !(typeof id==='string' || Number.isSafeInteger(id))) ||
        (message.params !== undefined && (!message.params || Array.isArray(message.params) || typeof message.params !== 'object')))
      return error(400,null,-32600,'Invalid JSON-RPC request');
    if (!Object.hasOwn(message,'id')) return json(202,null);
    const params = message.params || {};
    let result;
    if (message.method === 'initialize') {
      if (typeof params.protocolVersion !== 'string' || !params.clientInfo?.name || !params.clientInfo?.version || !params.capabilities || typeof params.capabilities !== 'object')
        return error(200,id,-32602,'protocolVersion, clientInfo and capabilities are required');
      result={protocolVersion:versions.includes(params.protocolVersion)?params.protocolVersion:versions[0],capabilities:{tools:{listChanged:false}},
        serverInfo:{name:'qanun-maps',version:'1.0.0'},instructions:'Source-linked Pakistan legal research. Preserve citations and limitations. Current legal applicability is not established. Assessments are editorial research checklists, never legal determinations.'};
    } else if (message.method === 'ping') result={};
    else if (message.method === 'tools/list') {
      if (params.cursor) return error(200,id,-32602,'No pagination cursor is supported');
      result={tools:toolDefinitions.filter(t=>grant.tools.includes(t.name))};
    } else if (message.method === 'tools/call') {
      if (!toolDefinitions.some(t=>t.name===params.name)) return error(200,id,-32602,'Unknown tool');
      if (!grant.tools.includes(params.name)) return error(200,id,-32003,'Tool not permitted by this access key');
      try {
        const data=getService().call(params.name,params.arguments ?? {});
        const encoded=JSON.stringify(data);
        if (Buffer.byteLength(encoded)>900000) throw Error('Result exceeds the response limit; narrow the request');
        result={content:[{type:'text',text:encoded}],structuredContent:data,isError:false};
      } catch {
        result={content:[{type:'text',text:'Request could not be completed. Check the tool arguments and held source identifiers. No legal conclusion is inferred.'}],isError:true};
      }
    } else return error(200,id,-32601,'Method not found');
    return json(200,{jsonrpc:'2.0',id,result});
  };
}
