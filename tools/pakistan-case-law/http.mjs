import {validate,callProvider,ResearchError} from './provider.mjs';
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extra}});
// A bounded per-instance burst guard. The provider also enforces its own limits.
export function createHandler({provider=callProvider,now=Date.now,allowedHosts=['jusnrem.legal','www.jusnrem.legal',process.env.VERCEL_URL].filter(Boolean)}={}) {
  const buckets=new Map(); let providerRetryAt=0;
  return async request=>{
    const url=new URL(request.url);
    if(!allowedHosts.includes(url.host))return json(403,{error:'Host not permitted.'});
    if(request.method!=='POST')return json(405,{error:'Submit a research search using POST.'},{Allow:'POST'});
    if(request.headers.get('origin')!==url.origin || request.headers.get('sec-fetch-site')==='cross-site')return json(403,{error:'Submit the search from Qanun Maps.'});
    if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json(415,{error:'A JSON request is required.'});
    let body;
    try {
      const reader=request.body?.getReader();if(!reader)throw Error();
      let size=0;const chunks=[];
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return json(413,{error:'Search request is too large.'});}chunks.push(Buffer.from(value));}
      body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }catch{return json(400,{error:'Invalid search request.'});}
    try {
      const args=validate(body),time=now();
      if(providerRetryAt>time)return json(429,{error:'Pakistan Case Law has reached its request limit. Please try again later.'},{'Retry-After':String(Math.ceil((providerRetryAt-time)/1000))});
      const ip=(request.headers.get('x-forwarded-for')||'local').split(',')[0].trim().slice(0,128);
      const bucket=buckets.get(ip);const current=bucket && bucket.until>time?bucket:{count:0,until:time+60000};
      if(current.count>=30)return json(429,{error:'Please wait a moment before searching again.'},{'Retry-After':String(Math.ceil((current.until-time)/1000))});
      if(buckets.size>=5000){for(const [key,b] of buckets)if(b.until<=time)buckets.delete(key);if(buckets.size>=5000)return json(503,{error:'Research is busy. Please try again shortly.'});}
      current.count++;buckets.set(ip,current);
      const data=await provider(args);
      return json(200,{provider:'Pakistan Case Law',source:'https://pakistancaselaw.com',retrieved_at:new Date(time).toISOString(),action:args.action,data});
    } catch(error) {
      if(error instanceof ResearchError){if(error.retryAfter)providerRetryAt=now()+error.retryAfter*1000;return json(error.status,{error:error.message},error.retryAfter?{'Retry-After':String(error.retryAfter)}:{});}
      return json(502,{error:'Research is temporarily unavailable. Please try again.'});
    }
  };
}
