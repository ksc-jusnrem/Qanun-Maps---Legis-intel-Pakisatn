// URL identity is presentation metadata. Corpus IDs, versions and download names remain unchanged.
export const legacyReaderPattern = /^\/laws\/((?:pk-code|punjab-code|kp-code|balochistan-code)-[a-f0-9]{16})(?:\.html)?\/?$/;

export function titleSlug(title) {
  const words=String(title??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
    .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  let slug=(words.length>150?words.slice(0,150).replace(/-+[^-]*$/,''):words) || words.slice(0,150) || 'legislation';
  // A long title can lose its trailing year during truncation; retain the year stated in the title.
  const titleYear=String(title??'').match(/\b(?:17|18|19|20)\d{2}\b/g)?.at(-1);
  if(titleYear&&!new RegExp('(?:^|-)'+titleYear+'(?:-|$)').test(slug))slug+='-'+titleYear;
  return slug;
}

export function createReaderRoutes(records) {
  const groups=new Map(),ids=new Set();
  for(const record of records){
    if(!/^(?:pk-code|punjab-code|kp-code|balochistan-code)-[a-f0-9]{16}$/.test(record.id)||ids.has(record.id))throw Error('Invalid or duplicate reader identity');
    ids.add(record.id);const slug=titleSlug(record.title);if(!groups.has(slug))groups.set(slug,[]);groups.get(slug).push(record);
  }
  const routes={};const paths=new Set();
  for(const [slug,group] of [...groups].sort(([a],[b])=>a<b?-1:a>b?1:0)){
    for(const record of [...group].sort((a,b)=>a.id<b.id?-1:1)){
      // Every member of a collision group receives its full stable ID: no order-dependent winner.
      const route='/laws/'+slug+(group.length>1?'--'+record.id:'');
      if(paths.has(route)||legacyReaderPattern.test(route))throw Error('Reader URL collision');
      paths.add(route);routes[record.id]=route;
    }
  }
  return Object.fromEntries(Object.entries(routes).sort(([a],[b])=>a<b?-1:1));
}

export function legacyReaderDestination(input,routes) {
  const url=new URL(input);const match=legacyReaderPattern.exec(url.pathname);
  if(!match)return null; // Downloads, canonical slugs and unrelated routes do not redirect.
  if(!Object.hasOwn(routes,match[1]))return {record_id:match[1],unknown:true};
  url.pathname=routes[match[1]];
  // Changing only pathname retains the exact search string and any supplied fragment.
  // HTTP does not transmit fragments; a Location without one inherits the browser's fragment.
  return {record_id:match[1],url:url.href,status:301};
}

export function canonicalReaderLinks(html,routes) {
  return html.replace(/\bhref=(['"])\/laws\/((?:pk-code|punjab-code|kp-code|balochistan-code)-[a-f0-9]{16})(?:\.html)?([?#][^'"<>]*)?\1/g,
    (whole,quote,id,suffix='')=>Object.hasOwn(routes,id)?'href='+quote+routes[id]+suffix+quote:whole);
}
