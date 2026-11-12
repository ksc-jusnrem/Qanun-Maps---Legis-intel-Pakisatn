import crypto from 'node:crypto';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const reader = id => '/laws/' + encodeURIComponent(id);
const cpLength = value => Array.from(value).length;
const cpSlice = (value,start,end) => Array.from(value).slice(start,end).join('');
let cachedRecord = null, cachedCharacters = null, cachedSurrogatePairs = [];
const characterCache = new Map();
const CHARACTER_CACHE_LIMIT = 8;
function characters(record) {
  if (cachedRecord !== record) {
    let entry = characterCache.get(record);
    if (entry) characterCache.delete(record);
    else entry = {
      characters: Array.from(record.text ?? ''),
      surrogatePairs: [...(record.text??'').matchAll(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)].map(m=>m.index)
    };
    characterCache.set(record,entry);
    if (characterCache.size > CHARACTER_CACHE_LIMIT) characterCache.delete(characterCache.keys().next().value);
    cachedRecord = record; cachedCharacters = entry.characters; cachedSurrogatePairs = entry.surrogatePairs;
  }
  return cachedCharacters;
}
function offsetAt(record,utf16Index) {
  characters(record);
  let low=0,high=cachedSurrogatePairs.length;
  while(low<high){const middle=(low+high)>>>1;if(cachedSurrogatePairs[middle]<utf16Index)low=middle+1;else high=middle;}
  return utf16Index-low;
}

export function titleKey(value) {
  return String(value).normalize('NFC').toLowerCase().replace(/\bthe\b/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

function titleAliases(record) {
  const title = String(record.title ?? '').trim();
  const aliases = new Set([titleKey(title)]);
  // Catalogue review annotations and parenthetical abbreviations are not words
  // in the instrument name. Substantive parentheticals remain in the title.
  const catalogueTitle=title.replace(/\s*\((?:under\s+review|repealed\b|repeal\s+by\b)[\s\S]*$/i,'').replace(/\s*\((?:CrPC|CPC|PPC|HEC)\)\s*/g,' ').trim();
  aliases.add(titleKey(catalogueTitle));
  // A trailing Act-number citation is metadata, not part of an instrument's name.
  const withoutCitation = catalogueTitle.replace(/\s*[([]\s*[IVXLCDM]+\s+of\s+\d{4}\s*[)\]]\s*$/i,'');
  const romanCitation=catalogueTitle.match(/^(.*?)\s*[([]\s*[IVXLCDM]+\s+of\s+(\d{4})\s*[)\]]\s*$/i);
  const namedTitle=romanCitation&&!/\b(?:17|18|19|20)\d{2}\b/.test(withoutCitation)?withoutCitation+' '+romanCitation[2]:withoutCitation;
  aliases.add(titleKey(namedTitle));
  // Source catalogues sometimes append the instrument class after its year.
  aliases.add(titleKey(namedTitle.replace(/(\b(?:17|18|19|20)\d{2})\s+(?:Act|Ordinance|Rules|Regulations|Order)\s*$/i,'$1')));
  aliases.add(titleKey(namedTitle.replace(/(\b(?:17|18|19|20)\d{2})\s*,\s*\1\s*$/,'$1')));
  return [...aliases].filter(key => key.split(' ').length >= 2);
}

function tokens(value) {
  const result = []; let previous = 0, offset = 0;
  for (const match of value.matchAll(/[\p{L}\p{N}]+/gu)) {
    offset += cpLength(value.slice(previous, match.index));
    const start = offset; offset += cpLength(match[0]); previous = match.index + match[0].length;
    const key = match[0].normalize('NFC').toLowerCase();
    if (key !== 'the') result.push({key,start,end:offset,utf16Start:match.index,utf16End:previous,raw:match[0]});
  }
  return result;
}

function makeIndex(records) {
  const root = new Map(), aliases = new Map();
  for (const record of records) for (const key of titleAliases(record)) {
    if (!aliases.has(key)) aliases.set(key,new Set());
    aliases.get(key).add(record.id);
  }
  for (const [key, ids] of aliases) {
    let node = root;
    for (const part of key.split(' ')) {
      if (!node.has(part)) node.set(part,new Map());
      node = node.get(part);
    }
    node.ids = [...ids].sort(compare); node.alias = key;
  }
  return {root,aliases};
}

function fragmentAt(record, offset) {
  return record.passages?.find(p => p.character_start <= offset && p.character_end > offset)?.reader_fragment ?? 'law-text';
}

function evidence(record, start, end, text = record.text ?? '') {
  const quote = characters(record).slice(start,end).join('');
  return {record_id:record.id,text_version_id:record.text_version_id ?? null,text_sha256:record.text_sha256 ?? sha(text),character_start:start,character_end:end,quote,quote_sha256:sha(quote),reader_fragment:fragmentAt(record,start),reader_url:reader(record.id)+'#'+fragmentAt(record,start),source_url:record.source_url ?? null};
}

function contextEvidence(record, start, end) {
  const chars = characters(record);
  const lower = Math.max(0,start-170), upper = Math.min(chars.length,end+230);
  let from = lower, to = upper;
  // Keep bounded context, preferring a nearby paragraph boundary.
  const before = chars.slice(lower,start).join('');
  const breakAt = before.lastIndexOf('\n\n');
  if (breakAt >= 0) from = lower+cpLength(before.slice(0,breakAt+2));
  const after = chars.slice(end,upper).join('');
  const afterBreak = after.indexOf('\n\n');
  if (afterBreak >= 0) to = end+cpLength(after.slice(0,afterBreak));
  return evidence(record,from,Math.max(end,to));
}

function shortContext(record,start,end) {
  const chars = characters(record);
  return chars.slice(Math.max(0,start-100),Math.min(chars.length,end+100)).join('').replace(/\s+/g,' ');
}

function citationRole(context) {
  // These labels identify citation context only. They do not assert legal effect.
  if (/\b(?:repeal(?:ed|s)?|repealing)\b/i.test(context)) return 'citation_in_repeal_context';
  if (/\b(?:amend(?:ed|ment|s)?|substitut(?:ed|ion)|insert(?:ed|ion))\b/i.test(context)) return 'citation_in_amendment_context';
  if (/\b(?:powers?\s+conferred|exercise\s+of\s+(?:the\s+)?powers?|made\s+under|in\s+pursuance)\b/i.test(context)) return 'citation_in_authority_context';
  return 'explicit_instrument_citation';
}

function matchedInstrumentReferences(record, index) {
  const ts = tokens(record.text ?? ''), matches = [];
  const titleConnectors=new Set(['of','and','for']);
  const boundaryWords=new Set(['under','by','see','read','vide','whereas','where','notwithstanding','including','includes','against','from','with','without','to','pursuant']);
  for (let i=0;i<ts.length;i++) {
    // Reject a held short title embedded in a longer unheld proper title.
    // Punctuation or ordinary prose gives a boundary; a preceding proper-name
    // word (possibly joined by "of/and/for") is part of the cited name.
    let previous=i-1,continuesName=false;
    while(previous>=0&&i-previous<7) {
      const gap=(record.text??'').slice(ts[previous].utf16End,ts[previous+1].utf16Start).replace(/\bthe\b/gi,'');
      if(/[^\s]/.test(gap))break;
      if(titleConnectors.has(ts[previous].key)){previous--;continue;}
      continuesName=/^\p{Lu}/u.test(ts[previous].raw)&&!boundaryWords.has(ts[previous].key);break;
    }
    if(continuesName)continue;
    let node=index.root, best=null;
    for (let j=i;j<Math.min(ts.length,i+45);j++) {
      const next=node.get(ts[j].key); if (!next) break; node=next;
      if (node.ids) best={start:ts[i].start,end:ts[j].end,ids:node.ids,alias:node.alias,last:j};
    }
    if (!best) continue;
    // Do not create links from an instrument's own title or signature block.
    const other = best.ids.filter(id=>id!==record.id);
    if (other.length && !best.ids.includes(record.id)) matches.push({...best,ids:other});
    i=best.last;
  }
  return matches;
}

function unheldInstrumentReferences(record, known) {
  const text=record.text ?? '', ts=tokens(text), results=[];
  const types=new Set(['act','ordinance','code','rules','regulations','order']);
  const connectors=new Set(['of','and','for','in','on','to','as','by','at','with','without','or']);
  const boundaries=new Set(['under','see','vide','whereas','where','notwithstanding','including','includes','pursuant','an','a']);
  for(let i=1;i<ts.length-1;i++) {
    if(!types.has(ts[i].key)||! /^(?:17|18|19|20)\d{2}$/.test(ts[i+1].key)) continue;
    let begin=i, walked=0;
    for(let j=i-1;j>=0&&walked<20;j--,walked++) {
      const gap=text.slice(ts[j].utf16End,ts[j+1].utf16Start);
      if(/[.;:!?()[\]]/.test(gap)) break;
      if(boundaries.has(ts[j].key))break;
      if(!/^\p{Lu}/u.test(ts[j].raw)&&!connectors.has(ts[j].key)) break;
      begin=j;
    }
    while(begin<i&&connectors.has(ts[begin].key)) begin++;
    if(begin===i) continue;
    const start=ts[begin].start,end=ts[i+1].end;
    if(known.some(m=>m.start>=start&&m.end<=end))continue;
    const quote=characters(record).slice(start,end).join('');
    if(titleAliases(record).includes(titleKey(quote)))continue;
    results.push({start,end,title:quote.replace(/\s+/g,' '),reason:'No unique full-title and year match in this library'});
    i++;
  }
  return results;
}

function operativeTargets(record) {
  const text=record.text ?? '', result=new Map();
  const re=/^[ \t]*(\d{1,3}(?:-?[A-Z])?)\.[ \t]*([^\r\n]{2,180}?)[.:][ \t]*[–—-]+[ \t]*(?=\(?[A-Za-z0-9])/gm;
  for(const m of text.matchAll(re)) {
    const number=m[1].replace('-',''), start=offsetAt(record,m.index);
    if(!result.has(number))result.set(number,[]);
    result.get(number).push({number,title:m[2].replace(/\s+/g,' ').trim(),start,end:start+cpLength(m[0]),raw:m[0],fragment:fragmentAt(record,start)});
  }
  return result;
}

function provisionKind(record) {
  const title=String(record.title??'');
  return /^\s*(?:the\s+)?constitution\s+of\b/i.test(title)?'article':(()=>{const token=[...title.matchAll(/\b(act|ordinance|code|rules|regulations)\b/gi)].at(-1)?.[1].toLowerCase();return token==='rules'?'rule':token==='regulations'?'regulation':token?'section':null;})();
}

function internalReferences(record,targetIndex=operativeTargets(record)) {
  const text=record.text ?? '', result=[];
  const title=String(record.title??''),kind=provisionKind(record);
  const amendingInstrument=/\b(?:amendment|repealing)\b/i.test(title)&&/\b(?:act|ordinance)\b/i.test(title);
  const re=/\b(section|article|rule|regulation)\s+(\d{1,3}(?:-?[A-Z])?)(\s*\([^\r\n)]{1,15}\))?/gi;
  for(const m of text.matchAll(re)) {
    if(kind&&m[1].toLowerCase()!==kind)continue;
    const after=text.slice(m.index+m[0].length,m.index+m[0].length+180);
    // Amending instruments quote inserted/replacement provisions of another
    // instrument. Their numbers are not local provisions of the amending Act.
    if(amendingInstrument&&!/^\s*(?:\([^\r\n)]{1,30}\)\s*)*,?\s*of\s+this\s+(?:Act|Ordinance)\b/i.test(after))continue;
    // "Section N of the X Act" is an external citation, never a local link.
    if(/^\s*(?:\([^\r\n)]{1,30}\)\s*)*,?\s*of\s+(?!this\b|these\b)/i.test(after))continue;
    const number=m[2].toUpperCase().replace('-',''), choices=targetIndex.get(number) ?? [];
    const start=offsetAt(record,m.index),end=start+cpLength(m[0]);
    const targets=choices.length===1?choices:[];
    result.push({start,end,kind:m[1].toLowerCase(),number,qualifier:m[3]?.trim()??null,target:targets[0]??null,resolution:choices.length===1?'matched_operative_heading':choices.length>1?'ambiguous_operative_headings':'operative_heading_not_identified'});
  }
  return result;
}

function explicitExternalQualifier(record,citationStart,citationEnd) {
  const from=Math.max(0,citationStart-180),prefix=characters(record).slice(from,citationStart).join('');
  const m=prefix.match(/\b(section|article|rule|regulation)\s+(\d{1,3}(?:-?[A-Z])?)((?:\s*\([^\r\n)]{1,15}\))*)\s+of\s+(?:the\s+)?$/i);
  if(!m)return null;
  return {kind:m[1].toLowerCase(),number:m[2].toUpperCase().replace('-',''),qualifier:m[3].replace(/\s+/g,'')||null,start:from+cpLength(prefix.slice(0,m.index)),end:citationEnd};
}

function headingEvidence(record,heading) {
  const quote=heading.raw;
  return {record_id:record.id,text_version_id:record.text_version_id??null,text_sha256:record.text_sha256??sha(record.text??''),character_start:heading.start,character_end:heading.end,quote,quote_sha256:sha(quote),reader_fragment:heading.fragment,reader_url:reader(record.id)+'#'+heading.fragment,source_url:record.source_url??null};
}

export function buildLibraryGraph(records, options={}) {
  const ordered=[...records].sort((a,b)=>compare(a.id,b.id)), index=makeIndex(ordered);
  const byId=new Map(ordered.map(r=>[r.id,r]));
  const graph={schema_version:'legis-intel-library-graph/1',scope:'Exact citations in preserved source editions; no certification of current force or legal effect.',nodes:[],citations:[],internal_references:[],external_references:[],unresolved:[],reviewed_statute_relationships:options.reviewedStatutes?.edges??[],reviewed_judicial_relationships:options.reviewedCases?.links??[],coverage:{}};
  const targetIndexes=new Map(),pendingExternal=[];
  let processed=0;
  for(const record of ordered) {
    if(!record.id||!/^[-a-zA-Z0-9_]+$/.test(record.id))throw Error('Unsafe or missing law record id');
    if(record.text_sha256&&typeof record.text==='string'&&sha(record.text)!==record.text_sha256)throw Error('Raw record hash mismatch '+record.id);
    graph.nodes.push({id:record.id,title:record.title,source_collection:record.source_collection,source_url:record.source_url??null,text_version_id:record.text_version_id??null,text_sha256:record.text_sha256??null,content_kind:record.content_kind,reader_url:reader(record.id)});
    const coverage={record_id:record.id,outbound:[],inbound:[],internal:[],external_outgoing:[],external_incoming:[],unresolved:[],status:record.content_kind==='source_notice'?'source_text_unavailable':'source_citations_examined'};
    graph.coverage[record.id]=coverage;
    if(record.content_kind==='source_notice'||!record.text){options.onProgress?.({processed:++processed,total:ordered.length,record_id:record.id});continue;}
    const matches=matchedInstrumentReferences(record,index);
    for(const m of matches) {
      const target=m.ids.length===1?m.ids[0]:null, context=shortContext(record,m.start,m.end);
      const item={id:'citation-'+sha(record.id+':'+m.start+':'+m.end+':'+m.ids.join(',')).slice(0,20),source:record.id,target,target_candidates:m.ids,resolution:target?'exact_title_match':'ambiguous_source_editions',relation:citationRole(context),evidence:evidence(record,m.start,m.end),context_evidence:contextEvidence(record,m.start,m.end)};
      graph.citations.push(item);coverage.outbound.push(item.id);
      if(!target)coverage.unresolved.push(item.id);
      const qualifier=explicitExternalQualifier(record,m.start,m.end);
      if(qualifier)pendingExternal.push({id:'external-'+sha(record.id+':'+qualifier.start+':'+qualifier.end).slice(0,20),source:record.id,target,target_candidates:m.ids,citation_id:item.id,provision_kind:qualifier.kind,provision_number:qualifier.number,qualifier:qualifier.qualifier,instrument_title:item.evidence.quote,evidence:evidence(record,qualifier.start,qualifier.end),instrument_evidence:item.evidence,context_evidence:contextEvidence(record,qualifier.start,qualifier.end)});
    }
    for(const m of unheldInstrumentReferences(record,matches)) {
      const item={id:'unresolved-'+sha(record.id+':'+m.start+':'+m.end).slice(0,20),source:record.id,title:m.title,reason:m.reason,evidence:evidence(record,m.start,m.end),context_evidence:contextEvidence(record,m.start,m.end)};
      graph.unresolved.push(item);coverage.unresolved.push(item.id);
      const qualifier=explicitExternalQualifier(record,m.start,m.end);
      if(qualifier)pendingExternal.push({id:'external-'+sha(record.id+':'+qualifier.start+':'+qualifier.end).slice(0,20),source:record.id,target:null,target_candidates:[],unheld_citation_id:item.id,provision_kind:qualifier.kind,provision_number:qualifier.number,qualifier:qualifier.qualifier,instrument_title:m.title,evidence:evidence(record,qualifier.start,qualifier.end),instrument_evidence:item.evidence,context_evidence:contextEvidence(record,qualifier.start,qualifier.end)});
    }
    const targetIndex=operativeTargets(record);targetIndexes.set(record.id,targetIndex);
    for(const m of internalReferences(record,targetIndex)) {
      const item={id:'internal-'+sha(record.id+':'+m.start+':'+m.end).slice(0,20),source:record.id,target:record.id,provision_kind:m.kind,provision_number:m.number,qualifier:m.qualifier,resolution:m.resolution,target_evidence:m.target?evidence(record,m.target.start,m.target.end):null,target_fragment:m.target?.fragment??null,evidence:evidence(record,m.start,m.end),context_evidence:contextEvidence(record,m.start,m.end)};
      graph.internal_references.push(item);coverage.internal.push(item.id);
      if(!m.target)coverage.unresolved.push(item.id);
    }
    options.onProgress?.({processed:++processed,total:ordered.length,record_id:record.id});
  }
  for(const ref of pendingExternal) {
    const target=byId.get(ref.target),choices=targetIndexes.get(ref.target)?.get(ref.provision_number)??[];
    let resolution=!target?(ref.target_candidates.length?'ambiguous_source_editions':'instrument_not_held'):provisionKind(target)!==ref.provision_kind?'target_provision_kind_not_matched':choices.length===1?'matched_operative_heading':choices.length>1?'ambiguous_operative_headings':'operative_heading_not_identified';
    // A quoted inserted section of an amending instrument is not its own section.
    if(target&&/\b(?:amendment|repealing)\b/i.test(target.title)&&resolution==='matched_operative_heading')resolution='amending_instrument_target_requires_review';
    const heading=resolution==='matched_operative_heading'?choices[0]:null;
    Object.assign(ref,{resolution,resolution_scope:'numbered_heading_only',subprovision_status:ref.qualifier?'not_independently_matched':'not_applicable',target_evidence:heading?headingEvidence(target,heading):null,target_fragment:heading?.fragment??null});
    graph.external_references.push(ref);graph.coverage[ref.source].external_outgoing.push(ref.id);
    if(ref.target)graph.coverage[ref.target].external_incoming.push(ref.id);
    if(!heading)graph.coverage[ref.source].unresolved.push(ref.id);
  }
  for(const citation of graph.citations) if(citation.target)graph.coverage[citation.target].inbound.push(citation.id);
  const resolvedCitations=new Set(graph.citations.filter(x=>x.target).map(x=>x.id));
  const resolvedInternal=new Set(graph.internal_references.filter(x=>x.target_fragment).map(x=>x.id));
  for(const [id,c] of Object.entries(graph.coverage)) {
    if(!byId.has(id))throw Error('Coverage record absent');
    c.resolved_outbound=c.outbound.filter(key=>resolvedCitations.has(key)).length;
    c.resolved_internal=c.internal.filter(key=>resolvedInternal.has(key)).length;
  }
  graph.statistics={records:graph.nodes.length,records_with_source_text:ordered.filter(r=>r.content_kind!=='source_notice'&&r.text).length,instrument_citation_occurrences:graph.citations.length,resolved_instrument_citations:graph.citations.filter(x=>x.target).length,ambiguous_instrument_citations:graph.citations.filter(x=>!x.target).length,internal_reference_occurrences:graph.internal_references.length,resolved_internal_references:graph.internal_references.filter(x=>x.target_fragment).length,external_reference_occurrences:graph.external_references.length,resolved_external_provision_headings:graph.external_references.filter(x=>x.target_fragment).length,unresolved_external_references:graph.external_references.filter(x=>!x.target_fragment).length,unheld_title_citations:graph.unresolved.length,records_with_outbound_citations:Object.values(graph.coverage).filter(c=>c.outbound.length).length,records_with_inbound_citations:Object.values(graph.coverage).filter(c=>c.inbound.length).length,reviewed_statute_relationships:graph.reviewed_statute_relationships.length,reviewed_judicial_relationships:graph.reviewed_judicial_relationships.length};
  return graph;
}

const roleLabels={explicit_instrument_citation:'Cites this instrument',citation_in_repeal_context:'Citation near repeal wording',citation_in_amendment_context:'Citation near amendment wording',citation_in_authority_context:'Citation near authority wording'};
const sourceLink=e=>`<a href="${esc(e.reader_url)}">Read the source passage</a>`;
const excerpt=e=>`<blockquote>${esc(e.quote).replace(/\s+/g,' ')}</blockquote><p class="library-evidence">${sourceLink(e)}</p>`;
const heading=(title,count)=>`<summary>${esc(title)} <span>${count}</span></summary>`;

export function renderLawRelationships(record, graph) {
  const c=graph.coverage[record.id];if(!c)throw Error('Missing library mapping coverage '+record.id);
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  const out=graph.citations.filter(x=>x.source===record.id),incoming=graph.citations.filter(x=>x.target===record.id),internal=graph.internal_references.filter(x=>x.source===record.id),unheld=graph.unresolved.filter(x=>x.source===record.id);
  const externalOut=(graph.external_references??[]).filter(x=>x.source===record.id),externalIn=(graph.external_references??[]).filter(x=>x.target===record.id);
  const groups=new Map();for(const x of out){const key=x.target??x.target_candidates.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
  const parts=[`<section id="library-relationships" class="library-relationships" aria-labelledby="library-relationships-title"><div class="eyebrow">LAW LIBRARY MAP</div><h2 id="library-relationships-title">This law in the library</h2><p>Follow the instruments and provisions named in this source edition, and the laws that cite it. Citation links identify the text being referred to; legal effect and current force require separate examination.</p><div class="library-map-counts"><span><strong>${out.length}</strong> citations to other instruments</span><span><strong>${incoming.length}</strong> citations from other laws</span><span><strong>${internal.length}</strong> internal provision references</span><span><strong>${externalOut.length}</strong> explicit external provision references</span></div>`];
  if(record.content_kind==='source_notice')parts.push('<p class="notice">The legislation text is unavailable in this record. Relationships cannot be extracted from a source notice.</p>');
  else if(!out.length&&!incoming.length&&!internal.length&&!unheld.length)parts.push('<p>No explicit instrument or numbered provision reference was identified by this extraction. This finding does not establish that the law has no legal relationships.</p>');
  if(groups.size){parts.push(`<details open>${heading('Instruments cited by this law',groups.size)}<div class="library-related-list">`);for(const xs of groups.values()){const x=xs[0],node=nodes.get(x.target);parts.push(`<article id="${esc(x.id)}"><h3>${node?`<a href="${esc(node.reader_url)}">${esc(node.title)}</a>`:'Edition needs identification'}</h3><p>${esc(roleLabels[x.relation])} · ${xs.length} occurrence${xs.length===1?'':'s'}</p>`);if(!node)parts.push(`<p>The title matches more than one source record; no edition is selected:</p><ul>${x.target_candidates.map(id=>`<li><a href="${esc(nodes.get(id).reader_url)}">${esc(nodes.get(id).title)}</a> · ${esc(nodes.get(id).source_collection)}</li>`).join('')}</ul>`);parts.push(`<details>${heading('Inspect citation evidence',xs.length)}${xs.map(v=>`<div id="${esc(v.id)}-evidence">${excerpt(v.context_evidence)}</div>`).join('')}</details></article>`);}parts.push('</div></details>');}
  if(incoming.length){const groupsIn=new Map();for(const x of incoming){if(!groupsIn.has(x.source))groupsIn.set(x.source,[]);groupsIn.get(x.source).push(x);}parts.push(`<details>${heading('Laws that cite this instrument',groupsIn.size)}<div class="library-related-list">${[...groupsIn].map(([id,xs])=>`<article><h3><a href="${esc(reader(id))}#library-relationships">${esc(nodes.get(id).title)}</a></h3><p>${xs.length} citation occurrence${xs.length===1?'':'s'}</p><details>${heading('Read the citing passages',xs.length)}${xs.map(x=>excerpt(x.context_evidence)).join('')}</details></article>`).join('')}</div></details>`);}
  if(internal.length) {
    const rows=internal.map(x=>{
      const label=x.provision_kind[0].toUpperCase()+x.provision_kind.slice(1)+' '+x.provision_number+(x.qualifier??'');
      const destination=x.target_fragment
        ? `<p><a href="${esc(reader(record.id)+'#'+x.target_fragment)}">Open the identified operative provision</a></p>`
        : `<p class="library-unresolved">${x.resolution==='ambiguous_operative_headings'?'More than one operative heading has this number.':'An operative target heading has not been identified.'} ${sourceLink(x.evidence)}</p>`;
      return `<article id="${esc(x.id)}"><h3>${esc(label)}</h3>${destination}<details><summary>Read reference in context</summary>${excerpt(x.context_evidence)}</details></article>`;
    }).join('');
    parts.push(`<details>${heading('References to provisions in this text',internal.length)}<div class="library-reference-list">${rows}</div></details>`);
  }
  const externalReasons={ambiguous_source_editions:'The named instrument matches multiple source editions; no edition is selected.',instrument_not_held:'The named instrument has not been matched in this library.',target_provision_kind_not_matched:'The cited provision kind differs from the numbered headings identified for this instrument.',operative_heading_not_identified:'A matching operative heading has not been identified.',ambiguous_operative_headings:'More than one operative heading has this number; no target is selected.',amending_instrument_target_requires_review:'The target is an amending instrument; quoted inserted provisions require separate identification.'};
  const externalCard=x=>{
    const target=nodes.get(x.target),source=nodes.get(x.source),label=x.provision_kind[0].toUpperCase()+x.provision_kind.slice(1)+' '+x.provision_number+(x.qualifier??'');
    const destination=x.target_fragment?`<p><a href="${esc(reader(x.target)+'#'+x.target_fragment)}">Open the target ${esc(x.provision_kind)} ${esc(x.provision_number)}</a></p>`:`<p class="library-unresolved">${esc(externalReasons[x.resolution]??'Target identification remains unresolved.')}</p>`;
    const candidates=!target&&x.target_candidates.length?`<ul>${x.target_candidates.map(id=>`<li><a href="${esc(reader(id))}">${esc(nodes.get(id).title)}</a> · ${esc(nodes.get(id).source_collection)}</li>`).join('')}</ul>`:'';
    const qualifier=x.qualifier?`<p class="library-evidence">The source cites ${esc(x.qualifier)}. The target link identifies the numbered heading; this subparagraph chain has not been independently matched.</p>`:'';
    const targetProof=x.target_evidence?`<h4>Target heading · ${esc(target.title)}</h4>${excerpt(x.target_evidence)}`:'';
    return `<article id="${esc(x.id)}"><h3>${esc(label)} of ${target?`<a href="${esc(target.reader_url)}">${esc(target.title)}</a>`:esc(x.instrument_title)}</h3><p>Cited by <a href="${esc(reader(x.source))}#library-relationships">${esc(source.title)}</a></p>${destination}${candidates}${qualifier}<details><summary>Read source and target evidence</summary><h4>Explicit source reference</h4>${excerpt(x.context_evidence)}${targetProof}</details></article>`;
  };
  if(externalOut.length)parts.push(`<details open>${heading('Provisions explicitly cited in other instruments',externalOut.length)}<div class="library-reference-list">${externalOut.map(externalCard).join('')}</div></details>`);
  if(externalIn.length)parts.push(`<details>${heading('Other laws referring to provisions of this instrument',externalIn.length)}<div class="library-reference-list">${externalIn.map(externalCard).join('')}</div></details>`);
  if(unheld.length)parts.push(`<details>${heading('Cited instruments not matched in this library',unheld.length)}<div class="library-related-list">${unheld.map(x=>`<article id="${esc(x.id)}"><h3>${esc(x.title)}</h3><p>${esc(x.reason)}. This may be missing coverage or a title/edition difference.</p>${excerpt(x.context_evidence)}</article>`).join('')}</div></details>`);
  const statute=graph.reviewed_statute_relationships.filter(x=>x.source===record.id||x.target===record.id),judicial=graph.reviewed_judicial_relationships.filter(x=>x.law_evidence?.law_id===record.id);
  if(statute.length||judicial.length)parts.push(`<details open>${heading('Separately reviewed relationships',statute.length+judicial.length)}<ul>${statute.map(x=>`<li><a href="/mappings?relationship=${encodeURIComponent(x.id)}#evidence-inspector">${esc(String(x.relation).replace(/_/g,' '))}</a> — inspect the reviewed source evidence and limits.</li>`).join('')}${judicial.map(x=>`<li><a href="/mappings#rule-case-${esc(x.id)}">${esc(x.provision)} — judicial interpretation</a></li>`).join('')}</ul></details>`);
  parts.push(`<p class="library-evidence"><a href="/library-map?law=${encodeURIComponent(record.id)}#library-map">Explore this law in the whole-library map</a> · <a href="/law-maps/${encodeURIComponent(record.id)}.json" download>Download this law’s relationship evidence</a> · <a href="${esc(reader(record.id))}.json" download>Download preserved source record</a></p></section>`);
  return parts.join('\n');
}

export function renderLibraryMap(graph) {
  const s=graph.statistics;
  const nodes=[...graph.nodes].sort((a,b)=>compare(titleKey(a.title),titleKey(b.title))||compare(a.id,b.id));
  const counts=[
    [s.records,'source records'],
    [s.resolved_instrument_citations,'matched citation occurrences'],
    [s.internal_reference_occurrences,'internal provision references'],
    [s.external_reference_occurrences??0,'explicit external provision references'],
    [s.resolved_external_provision_headings??0,'external target headings located'],
    [s.unheld_title_citations,'unmatched title occurrences']
  ].map(([count,label])=>`<span><strong>${count}</strong> ${label}</span>`).join('');
  const cards=nodes.map(n=>{
    const c=graph.coverage[n.id];
    return `<article id="map-${esc(n.id)}" data-map-law="${esc(n.id)}" data-map-search="${esc((n.title+' '+n.source_collection).toLowerCase())}"><h2><a href="${esc(n.reader_url)}#library-relationships">${esc(n.title)}</a></h2><p>${esc(n.source_collection)} · ${c.outbound.length} instrument citations · ${c.inbound.length} incoming citations · ${c.internal.length} internal provision references · ${c.external_outgoing?.length??0} external provision references</p><p>${c.status==='source_text_unavailable'?'Source text unavailable':c.unresolved.length?c.unresolved.length+' references need target identification':'Citation extraction examined; legal effect requires review'}</p><a href="${esc(n.reader_url)}">Read the legislation</a> · <a href="${esc(n.reader_url)}#library-relationships">Inspect its relationships</a></article>`;
  }).join('');
  return `<section id="library-map" class="library-map-page"><div class="eyebrow">LEGIS-INTEL PAKISTAN · LAW LIBRARY MAP</div><h1>Explore the law in context</h1><p>Start with an instrument to follow its cited laws, provision references and incoming citations. Exact source passages accompany the connections. Separately reviewed authority, repeal and judicial relationships retain their own evidence.</p><div class="library-map-counts">${counts}</div><form id="library-map-filter" role="search"><label for="library-map-query">Find a law or source collection</label><div><input id="library-map-query" type="search" name="q" placeholder="For example: Companies Act, university, Punjab"><button type="submit">Search</button><button type="button" id="library-map-clear">Show all</button></div><p id="library-map-status" role="status">${s.records} records. Open any record to inspect its connections.</p></form><div class="library-map-records">${cards}</div><noscript><p>All records are shown without JavaScript. Use your browser’s Find command to locate an instrument.</p></noscript><p class="library-evidence">This map concerns explicit references in the held source editions. It does not establish a complete amendment history, current legal force, or the absence of relationships not expressed as named citations.</p></section>`;
}

export const mappingScript=`(()=>{const form=document.getElementById('library-map-filter');if(!form)return;const input=document.getElementById('library-map-query'),status=document.getElementById('library-map-status'),cards=[...document.querySelectorAll('[data-map-law]')];let selected=new URLSearchParams(location.search).get('law');function update(){const words=input.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);let count=0;for(const card of cards){const ok=(!selected||card.dataset.mapLaw===selected)&&words.every(word=>card.dataset.mapSearch.includes(word));card.hidden=!ok;if(ok)count++;}status.textContent=count+' of '+cards.length+' records shown.';}input.value=new URLSearchParams(location.search).get('q')||'';form.addEventListener('submit',event=>{event.preventDefault();selected=null;update();});input.addEventListener('input',()=>{selected=null;update();});document.getElementById('library-map-clear').addEventListener('click',()=>{input.value='';selected=null;update();input.focus();});update();})();`;

export const mappingCss=`.library-relationships{margin:42px 0;padding:28px;border:1px solid #bfcbd3;border-top:4px solid #165b45;background:#f4f7f7}.library-relationships h2,.library-map-page h1{margin-top:0}.library-relationships>details{border-top:1px solid #ccd5dc;margin:18px 0;padding-top:16px}.library-relationships summary{cursor:pointer;font-weight:600;line-height:1.5}.library-relationships summary span{display:inline-block;margin-left:8px;font-size:.85em;font-weight:400}.library-map-counts{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.library-map-counts>span{padding:12px 16px;background:#fff;border:1px solid #d2dce2;font:14px/1.5 Arial,sans-serif}.library-map-counts strong{display:block;font-size:24px;color:#165b45}.library-related-list>article,.library-reference-list>article{padding:18px 0;border-bottom:1px solid #d5dde3}.library-related-list h3,.library-reference-list h3{font-size:21px;margin:0 0 8px}.library-relationships blockquote{margin:12px 0;padding:12px 16px;border-left:3px solid #a4b9b0;white-space:normal;font:17px/1.65 Georgia,serif;background:white}.library-evidence,.library-unresolved{font:13px/1.6 Arial,sans-serif;overflow-wrap:anywhere}.library-map-page{max-width:1080px;margin:42px auto;padding:0 24px}.library-map-page>p{max-width:850px;line-height:1.7}.library-map-page form{background:#eff4f4;border:1px solid #bccbd2;padding:22px;margin:30px 0}.library-map-page label{display:block;font-weight:bold;margin-bottom:12px}.library-map-page form>div{display:flex;gap:12px;flex-wrap:wrap}.library-map-page input{flex:1;min-width:180px;padding:12px;font:inherit}.library-map-page button{padding:12px 18px;font:inherit}.library-map-records{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.library-map-records>article{border:1px solid #c4d0d8;padding:22px;min-width:0}.library-map-records>article[hidden]{display:none}.library-map-records h2{font-size:24px;margin:0 0 12px;overflow-wrap:anywhere}.library-map-records p{font:14px/1.6 Arial,sans-serif}.library-map-records a{overflow-wrap:anywhere}@media(max-width:700px){.library-relationships{padding:20px 16px}.library-map-records{grid-template-columns:1fr}.library-map-page{padding:0 16px}.library-map-page form>div{flex-direction:column}.library-map-counts>span{flex:1;min-width:120px}}@media print{.library-relationships{background:white}.library-map-page form{display:none}.library-map-records{display:block}}`;

export function verifyLibraryGraph(records, graph) {
  const recordsById=new Map(records.map(r=>[r.id,r])),ids=new Set();
  if(graph.nodes.length!==records.length||Object.keys(graph.coverage).length!==records.length)throw Error('Incomplete graph coverage');
  const nodeIds=new Set();
  for(const node of graph.nodes){const record=recordsById.get(node.id);if(!record||nodeIds.has(node.id)||node.title!==record.title||node.text_sha256!==(record.text_sha256??null)||node.text_version_id!==(record.text_version_id??null))throw Error('Graph node identity mismatch');nodeIds.add(node.id);}
  for(const record of records)if(record.text_sha256&&typeof record.text==='string'&&sha(record.text)!==record.text_sha256)throw Error('Raw record hash mismatch '+record.id);
  for(const item of [...graph.citations,...graph.internal_references,...graph.unresolved]) {
    if(ids.has(item.id))throw Error('Duplicate graph relationship id');ids.add(item.id);
    const record=recordsById.get(item.source);if(!record)throw Error('Unknown source');
    for(const e of [item.evidence,item.context_evidence,item.target_evidence].filter(Boolean)) {
      if(e.record_id!==record.id||e.text_version_id!==(record.text_version_id??null)||e.text_sha256!==(record.text_sha256??sha(record.text??''))||characters(record).slice(e.character_start,e.character_end).join('')!==e.quote||sha(e.quote)!==e.quote_sha256)throw Error('Graph evidence mismatch '+item.id);
      if(e.reader_fragment!=='law-text'&&!record.passages?.some(p=>p.reader_fragment===e.reader_fragment))throw Error('Unknown source passage anchor');
    }
    if(item.target&&!recordsById.has(item.target))throw Error('Unknown graph target');
    if(item.target_candidates?.some(id=>!recordsById.has(id)))throw Error('Unknown candidate target');
    if(item.resolution==='ambiguous_source_editions'&&item.target!==null)throw Error('Ambiguous target selected');
  }
  for(const x of graph.citations)if(x.target&&!graph.coverage[x.target].inbound.includes(x.id))throw Error('Missing inverse relationship');
  for(const ref of graph.external_references??[]) {
    if(ids.has(ref.id))throw Error('Duplicate graph relationship id');ids.add(ref.id);
    const source=recordsById.get(ref.source);if(!source)throw Error('Unknown external source');
    const validate=(e,record)=>{
      if(!e||!record||e.record_id!==record.id||e.text_version_id!==(record.text_version_id??null)||e.text_sha256!==(record.text_sha256??sha(record.text??''))||characters(record).slice(e.character_start,e.character_end).join('')!==e.quote||sha(e.quote)!==e.quote_sha256)throw Error('External provision evidence mismatch '+ref.id);
      if(e.reader_fragment!=='law-text'&&!record.passages?.some(p=>p.reader_fragment===e.reader_fragment))throw Error('Unknown external provision passage anchor');
    };
    for(const e of [ref.evidence,ref.context_evidence,ref.instrument_evidence])validate(e,source);
    if(ref.target_evidence)validate(ref.target_evidence,recordsById.get(ref.target));
    if(ref.target_candidates.some(id=>!recordsById.has(id)))throw Error('Unknown external target candidate');
    if(ref.target&&!recordsById.has(ref.target))throw Error('Unknown external target');
    if(ref.target_fragment&&!ref.target_evidence)throw Error('External target fragment lacks evidence');
    if(ref.resolution==='matched_operative_heading'&&(!ref.target_fragment||!ref.target_evidence))throw Error('External resolved heading lacks target evidence');
    if(!graph.coverage[ref.source].external_outgoing.includes(ref.id))throw Error('Missing external outgoing reference');
    if(ref.target&&!graph.coverage[ref.target].external_incoming.includes(ref.id))throw Error('Missing external inverse reference');
  }
  return graph.statistics;
}
