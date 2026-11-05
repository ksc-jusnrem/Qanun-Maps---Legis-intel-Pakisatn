/** On-demand, read-only research against the provider's public MCP endpoint. */
export const endpoint = 'https://pakistancaselaw.com/mcp';
export const actions = Object.freeze({search:'caselaw_search', questions:'caselaw_search_questions', citation:'caselaw_lookup_citation', case:'caselaw_get_case', citations:'caselaw_get_citations', cited_by:'caselaw_get_cited_by', landmarks:'caselaw_most_cited'});
export class ResearchError extends Error {
  constructor(message, status=502, retryAfter=null) { super(message); this.status=status; this.retryAfter=retryAfter; }
}
const fields = {
  search:['query','court','judge','author','journal','year_from','year_to','sort','offset'],
  questions:['query','court','judge','year_from','year_to','offset'],
  citation:['journal','year','page','offset'],
  case:['case_id','section','paras','find','start'],
  citations:['case_id','offset'], cited_by:['case_id','offset'], landmarks:['offset']
};
export function validate(input) {
  const bad=m=>{throw new ResearchError(m,400);};
  if(!input || typeof input!=='object' || Array.isArray(input) || !Object.hasOwn(actions,input.action)) bad('Choose a supported research action.');
  const args=input.arguments ?? {};
  if(!args || typeof args!=='object' || Array.isArray(args)) bad('Invalid search fields.');
  const clean={response_format:'json'};
  for(const [key,value] of Object.entries(args)) {
    if(!fields[input.action].includes(key)) bad('Unsupported search field: '+key);
    if(value===undefined || value===null || value==='') continue;
    if(['year','year_from','year_to','page','case_id','start','offset'].includes(key)) {
      if(typeof value!=='number' || !Number.isSafeInteger(value)) bad('Enter a whole number for '+key+'.');
      const range=key.startsWith('year')||key==='year'?[1900,new Date().getFullYear()+1]:key==='offset'?[0,200]:key==='start'?[0,2000000]:[1,10000000];
      if(value<range[0]||value>range[1]) bad(key+' is outside the supported range.');
      clean[key]=value;
    } else {
      if(typeof value!=='string' || value.length>(key==='query'?500:160) || /[\u0000-\u001f]/.test(value)) bad('Invalid '+key+'.');
      clean[key]=value.trim();
    }
  }
  if(clean.year_from && clean.year_to && clean.year_from>clean.year_to) bad('The starting year must not exceed the ending year.');
  if(clean.sort && !['relevance','newest','court','recently_added'].includes(clean.sort)) bad('Invalid sort order.');
  if(clean.section && !['summary','full','outline'].includes(clean.section)) bad('Invalid judgment view.');
  if(clean.paras && !/^(?:notes|(?:\d+:)?\d+(?:-\d+)?)$/.test(clean.paras)) bad('Use paragraph numbers such as 41-55 or 2:3-5.');
  if(['case','citations','cited_by'].includes(input.action) && !clean.case_id) bad('A judgment ID is required.');
  if(input.action==='questions' && !clean.query) bad('Enter a legal question.');
  if(input.action==='citation' && !clean.journal) bad('Enter a law-report citation.');
  if(input.action==='search' && !['query','court','judge','author','journal','year_from','year_to'].some(k=>clean[k]) && clean.sort!=='recently_added') bad('Enter keywords or choose a filter.');
  if(input.action!=='case') clean.limit=10;
  else clean.section ??= 'summary';
  return {action:input.action,name:actions[input.action],arguments:clean};
}
async function readMessage(response,id) {
  if(!response.ok) {
    const retry=response.headers.get('retry-after');
    const seconds=retry && (/^\d+$/.test(retry)?Number(retry):Math.ceil((Date.parse(retry)-Date.now())/1000));
    await response.body?.cancel();
    throw new ResearchError(response.status===429?'Pakistan Case Law has reached its request limit. Please try again later.':'Pakistan Case Law is temporarily unavailable.', response.status===429?429:502,Number.isFinite(seconds)&&seconds>0?seconds:null);
  }
  const sse=response.headers.get('content-type')?.includes('text/event-stream');
  const reader=response.body?.getReader();
  if(!reader) throw new ResearchError('The provider returned an empty response.');
  const decoder=new TextDecoder(); let text='',size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();
      if(done) {text+=decoder.decode();break;}
      size+=value.byteLength;
      if(size>2000000) throw new ResearchError('This response is too long. Open the source or request a paragraph range.');
      text+=decoder.decode(value,{stream:true});
      if(sse) {
        let match;
        while((match=/\r?\n\r?\n/.exec(text))) {
          const block=text.slice(0,match.index); text=text.slice(match.index+match[0].length);
          const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
          if(!data)continue;
          const message=JSON.parse(data);
          if(message.id===id)return message;
        }
      }
    }
    if(!sse) {const message=JSON.parse(text);if(message.id===id)return message;}
    throw new ResearchError('The provider did not return the requested result.');
  } finally {await reader.cancel().catch(()=>{});}
}
export function unpack(result) {
  if(result?.isError) throw new ResearchError('Pakistan Case Law could not complete this request. Try a narrower search or open the source.');
  let data=result?.structuredContent;
  if(data && typeof data.result==='string')data=JSON.parse(data.result);
  if(!data) {
    const text=result?.content?.find(c=>c.type==='text')?.text;
    if(!text)throw new ResearchError('No research data was returned.');
    data=JSON.parse(text);
  }
  if(!data || typeof data!=='object' || Array.isArray(data) || data.error)throw new ResearchError('The provider could not complete this search.');
  return data;
}
export async function callProvider(validated,{fetchImpl=fetch,timeout=25000}={}) {
  const signal=AbortSignal.timeout(timeout);let session,version='2025-03-26';
  const headers=()=>({'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':version,...(session?{'Mcp-Session-Id':session}:{})});
  const send=body=>fetchImpl(endpoint,{method:'POST',headers:headers(),body:JSON.stringify(body),signal,redirect:'error'});
  try {
    const response=await send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:version,capabilities:{},clientInfo:{name:'qanun-maps',version:'1.0.0'}}});
    session=response.headers.get('mcp-session-id');
    const init=await readMessage(response,1);
    if(init.error || !init.result?.protocolVersion) throw new ResearchError('The research connection could not be initialized.');
    version=init.result.protocolVersion;
    const notice=await send({jsonrpc:'2.0',method:'notifications/initialized'});
    if(!notice.ok) {await readMessage(notice,null);throw new ResearchError('The research connection could not be initialized.');}
    await notice.body?.cancel();
    const message=await readMessage(await send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:validated.name,arguments:validated.arguments}}),2);
    if(message.error)throw new ResearchError('The provider could not complete this research request.');
    return unpack(message.result);
  } catch(error) {
    if(error instanceof ResearchError)throw error;
    throw new ResearchError(signal.aborted?'The research request timed out. Please try again.':'Pakistan Case Law is temporarily unavailable.',signal.aborted?504:502);
  } finally {
    if(session)await fetchImpl(endpoint,{method:'DELETE',headers:headers(),signal:AbortSignal.timeout(1500),redirect:'error'}).then(r=>r.body?.cancel()).catch(()=>{});
  }
}
