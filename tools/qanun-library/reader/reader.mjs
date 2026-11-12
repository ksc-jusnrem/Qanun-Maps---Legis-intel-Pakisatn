import crypto from 'node:crypto';

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const squash = value => value.replace(/\s+/gu, ' ').trim();
const key = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const headingKey=value=>key(value.replace(/\d+(?=\[)/gu,'').replace(/\bthe\b/giu,''));

function matchTitlePrefix(value,title){
 const ignored=new Set();for(const m of value.matchAll(/\d+(?=\[)|\bthe\b/giu))for(let i=m.index;i<m.index+m[0].length;i++)ignored.add(i);
 let compact='',positions=[];for(let i=0;i<value.length;i++){if(ignored.has(i))continue;const ch=value[i];if(/[\p{L}\p{N}]/u.test(ch)){compact+=ch.toLowerCase();positions.push(i+1);}}
 const target=headingKey(title);if(target.length<3||!compact.startsWith(target))return null;let end=positions[target.length-1];while(/[)\]"'’”]/u.test(value[end]||' '))end++;return end;
}

function exactPrefixLength(value,expected){let a=0,b=0;while(b<expected.length){while(a<value.length&&/\s/u.test(value[a]))a++;while(b<expected.length&&/\s/u.test(expected[b]))b++;if(b>=expected.length)break;if(value[a]!==expected[b])return -1;a++;b++;}return a;}
function sourcePrefixLength(source,expected){let a=0,b=0;const target=Array.from(expected);while(b<target.length){while(a<source.length&&/\s/u.test(source[a]))a++;while(b<target.length&&/\s/u.test(target[b]))b++;if(b>=target.length)break;if(source[a]!==target[b])return -1;a++;b++;}while(a<source.length&&/\s/u.test(source[a]))a++;return a;}

function correctedLines(text,corrections,sourceLayoutText){
 const originals=linesOf(text);if(!corrections?.length&&sourceLayoutText===undefined)return {lines:originals,originals,corrections:[],sourceLayoutApplied:false};const cp=Array.from(text);const sorted=[...(corrections||[])].sort((a,b)=>a.character_start-b.character_start);let end=-1;
 for(const c of sorted){if(!Number.isInteger(c.character_start)||!Number.isInteger(c.character_end)||c.character_start<0||c.character_end<=c.character_start||c.character_end>cp.length||c.character_start<end||c.replacement&&c.replacement!==''||!/^\s+$/u.test(cp.slice(c.character_start,c.character_end).join('')))throw new Error('Invalid original-offset whitespace correction');end=c.character_end;}
 const display=[],origins=[];
 if(sourceLayoutText!==undefined){
  if(typeof sourceLayoutText!=='string')throw new Error('Source layout text must be a string');
  const nonspace=[];for(let i=0;i<cp.length;i++)if(!/\s/u.test(cp[i]))nonspace.push(i);
  const layout=Array.from(sourceLayoutText);let next=0,last=-1;
  for(const ch of layout){if(/\s/u.test(ch)){display.push(ch);origins.push(Math.min(last+1,nonspace[next]??cp.length));continue;}const original=nonspace[next++];if(original===undefined||cp[original]!==ch)throw new Error('Original-source layout changes the full non-whitespace character stream');display.push(ch);origins.push(original);last=original;}
  if(next!==nonspace.length)throw new Error('Original-source layout omits source characters');
 }else{let correction=0;for(let i=0;i<cp.length;i++){while(correction<sorted.length&&i>=sorted[correction].character_end)correction++;if(correction<sorted.length&&i>=sorted[correction].character_start&&i<sorted[correction].character_end)continue;display.push(cp[i]);origins.push(i);}}
 const lines=linesOf(display.join('')).map(line=>{let first=line.character_start,last=line.character_end;while(first<last&&/\s/u.test(display[first]))first++;while(last>first&&/\s/u.test(display[last-1]))last--;return {...line,character_start:origins[first]??cp.length,character_end:last>first?(origins[last-1]??cp.length-1)+1:origins[first]??cp.length};});
 return {lines,originals,corrections:sorted,sourceLayoutApplied:sourceLayoutText!==undefined};
}

function retainedSourceCharacters(characters,ranges){const ordered=ranges.filter(r=>r.character_end>r.character_start).sort((a,b)=>a.character_start-b.character_start);const chunks=[];let cursor=0;for(const r of ordered){if(r.character_start>cursor)chunks.push(characters.slice(cursor,r.character_start).join(''));cursor=Math.max(cursor,r.character_end);}chunks.push(characters.slice(cursor).join(''));return chunks.join('');}
const PAGE = /^(?:Page\s+\d+(?:\s+of\s+\d+)?|\d+\s*\|\s*P\s*a\s*g\s*e|={3,}\s*PDF PAGE\s+\d+\s*={3,})$/i;
const CONTENTS = /^(?:contents|tableofcontents|arrangementofsections|arrangementofrules|listofcontents)$/;
const DIVISION = /^(?:(?:PART|CHAPTER)\s+[A-Z\d]+(?:[.\s:—–-].*)?|(?:(?:\d{1,3})?\[\s*)?(?:(?:THE|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH|EIGHTEENTH|NINETEENTH|TWENTIETH)\s+)?SCHEDULE(?:\s+[IVXLCDM\d]+)?(?:\s*[-—–:.(].*)?|ANNEX(?:URE)?(?:\s+[A-ZIVX\d]+)?(?:\s*[-—–:.(].*)?)$/;
const PREAMBLE = /^(?:PREAMBLE\b|WHEREAS\b|In the name of Allah\b|An\s+(?:Act|Ordinance)\b|It is hereby\b|In exercise\b|In pursuance\b)/i;
const FOOTNOTE = /^(?:\d{1,3}\s*)?(?:Subs(?:tituted)?\.?\s|Ins(?:erted)?\.?\s|Omitted\s+(?:by|vide)|Added\s+(?:by|vide)|This\s+(?:Act|Ordinance|Order)\s+(?:was|has)|For\s+(?:Statement of Objects|the Statement of Objects)|See\s+(?:Gazette|section|notification)|Amended\s+(?:by|vide))/i;

function linesOf(text) {
  let u16 = 0, cp = 0;
  return text.match(/[^\r\n\f]*(?:\r\n|\r|\n|\f|$)/gu).filter(Boolean).map(raw => {
    const body = raw.replace(/[\r\n\f]+$/u, '');
    const line = {raw:body, text:body.trim(), start:u16, end:u16 + body.length, character_start:cp, character_end:cp + Array.from(body).length};
    u16 += raw.length; cp += Array.from(raw).length;
    return line;
  });
}

function instrumentKind(record) {
  if (/constitution\s+of\s+(?:the\s+)?islamic\s+republic/i.test(record.title)) return 'Article';
  const types = [...record.title.matchAll(/\b(act|ordinance|code|rules|regulations|order)\b/gi)];
  const last = types.at(-1)?.[1].toLowerCase();
  return last === 'rules' ? 'Rule' : last === 'regulations' ? 'Regulation' : last === 'order' ? 'Paragraph' : 'Section';
}

function numbered(line) {
  // Superscript amendment markers sometimes precede an opening square bracket.
  const m = line.text.match(/^(?:(\d{1,3})\s*\[\s*|\[\s*)?(\d{1,3}(?:\s*[-]?\s*[A-Z]{1,3})?)\s*\.\s*(.*)$/u)||line.text.match(/^(?:(\d{1,3})\s*\[\s*|\[\s*)?(\d{1,3}[A-Z]{1,2})[ \t]+([A-Z].*)$/u);
  if (!m || /^\d{2,4}\b/.test(m[3])) return null;
  const titleMarker=m[3].match(/^(\d{1,3})(?=[A-Z])/u)?.[1]||'';
  return {number:m[2].replace(/\s|-/g, ''),printed_number:m[2].replace(/\s|-/g,''),rest:m[3].slice(titleMarker.length),marker:(m[1]||'')+titleMarker||null,title_marker:titleMarker,source_number_prefix:(m[1]||'')+m[2].replace(/\s|-/g,'')+titleMarker};
}

function contentsTitle(rest) {
  return squash(rest.replace(/\s*[.…_]{2,}[\s\S]*$/u, '').replace(/\s+\d+(?:\s*[-–]\s*\d+)?\s*$/u, '').replace(/[.\s]+$/u, ''));
}

function headingCandidate(lines, index, toc, allowAnonymous=false) {
  const first = numbered(lines[index]);
  if (!first) return null;
  if(/^(?:\d+)?\[?\s*(?:Omitted|Repealed|Deleted|Declared Void)\b/i.test(first.rest)||/\]\s*Omitted\b/i.test(first.rest))return {...first,title:squash(first.rest),nav_title:toc.get(first.number)?.[0]||squash(first.rest),source_title:squash(first.rest),index,end_index:index,separator:false,body_tail:'',status_heading:true};
  let joined = first.rest, last = index;
  for (let n = index; n < Math.min(lines.length, index + 4); n++) {
    if (n > index) {
      if (!lines[n].text && !joined)continue;
      if (!lines[n].text || numbered(lines[n]) || DIVISION.test(lines[n].text) || PAGE.test(lines[n].text)) break;
      joined += ' ' + lines[n].text; last = n;
    }
    for(const tocTitle of toc.get(first.number)||[]){const used=matchTitlePrefix(joined,tocTitle);if(used===null)continue;const tail=joined.slice(used);if(/^\s*[.:](?:\s*[—–_-])?(?=\s|[—–_(-])/u.test(tail))return {...first,title:squash(joined.slice(0,used)),nav_title:tocTitle,source_title:squash(joined.slice(0,used)),index,end_index:last,separator:false,body_tail:tail};}
    const sep = joined.match(/^(.{2,230}?)(?:\.\s*[—–−_-]+|[—–−]\s*|:\s*[-—–−_]+)([\s\S]*)$/u);
    if (sep && !/[;{}]|[.…]{2,}/u.test(sep[1]) && !/\b(?:subs|inserted|omitted vide|gazette|page)\b/i.test(sep[1])) {
      let title = squash(sep[1]).replace(/[.\s]+$/u, '');
      if (/^[\d([]/.test(title) || title.split(' ').length > 30) return null;
      let number=first.number, marker=first.marker;
      let tocTitle = toc.get(number)?.find(t => headingKey(t) === headingKey(title));
      if(!tocTitle && toc.size){const matching=[...toc.entries()].filter(([,titles])=>titles.some(t=>headingKey(t)===headingKey(title)));if(matching.length===1&&number.endsWith(matching[0][0])){const real=matching[0][0];marker=(marker||'')+number.slice(0,-real.length);number=real;tocTitle=matching[0][1].find(t=>headingKey(t)===headingKey(title));}}
      return {...first,number,marker,title,nav_title:tocTitle||title,source_title:title,index,end_index:last,separator:true,body_tail:sep[2]};
    }
    const possible = toc.get(first.number) || [];
    for (const title of possible) {
      const used=matchTitlePrefix(joined,title);if(used===null)continue;
      // The title must be followed by punctuation or body prose, not a contents row.
      const tail = joined.slice(used);
      if (/^\s*[.:[—–-]/u.test(tail) || /^\s+\(?\d+\)\s/u.test(tail)) return {...first,title:squash(joined.slice(0,used)),nav_title:title,source_title:squash(joined.slice(0,used)),index,end_index:last,separator:false,body_tail:tail};
    }
    if(possible.length===1&&/^(?:\(?\d+\)\s|(?:\d+\[)?(?:This|These|In this|A|An|Any|Every|All|No|There|The|Subject|Notwithstanding)\b|[\d\s[\]*.\-]+$)/u.test(joined))return {...first,title:possible[0],nav_title:possible[0],source_title:'',title_from_contents:true,index,end_index:last,separator:false,body_tail:joined};
    const generic=joined.match(/^((?:Short title|Title and extent|Title, extent|Definitions|Repeal|Savings?|Commencement|Extent)\b.{0,180}?)\.\s+((?:\(?\d+\)\s*)?(?:This|These|In this|There|The|No|A|An|All|Any|Every|Subject|Notwithstanding)\b[\s\S]*)$/i);
    if(generic)return {...first,title:squash(generic[1]),source_title:squash(generic[1]),index,end_index:last,separator:false,body_tail:generic[2]};
    if(possible.length){const plain=joined.match(/^(.{2,230}?)\.\s+((?:\(?\d+\)\s*)?(?:This|These|In|There|The|No|A|An|All|Any|Every|So|Such|For|Where|When|Whoever|Subject|Notwithstanding)\b[\s\S]*)$/u);if(plain)return {...first,title:squash(plain[1]),source_title:squash(plain[1]),index,end_index:last,separator:false,body_tail:plain[2]};}
    if(allowAnonymous&&/^(?:[—–−_-]+\s*\(?\d+\)|(?:In\s+this\s+Order|Where|This\s+Order|There|All|The|Any|For|No|A|An)\b)/u.test(joined))return {...first,title:'',source_title:'',anonymous_provision:true,index,end_index:last,separator:false,body_tail:joined};
    if (joined.length > 260 || /[;{}]/.test(joined)) break;
  }
  return null;
}

function findStructure(record, lines) {
  const kind = instrumentKind(record), toc = new Map();
  const contentsAt = lines.findIndex(l => CONTENTS.test(key(l.text)));
  const explicitText=contentsAt>=0?lines.findIndex((l,i)=>i>contentsAt&&l.text==='TEXT'):-1;
  const recital=contentsAt>=0?lines.findIndex((l,i)=>i>contentsAt&&(/^(?:WHEREAS\b|It is hereby\b|NOW,? THEREFORE\b|In exercise\b|In pursuance\b|An\s+(?:Act|Ordinance)\b|Preamble[.\s:—–−_-]+(?:WHEREAS|For\s|It\s|To\s))/i.test(squash(l.text))||/^AN$/i.test(l.text)&&/^(?:ACT|ORDINANCE)$/i.test(lines[i+1]?.text||''))):-1;
  let boundary=explicitText>=0?explicitText:recital;
  let boundaryEvidence=explicitText>=0?'explicit_source_TEXT_marker':recital>=0?'operative_legal_recital':null;
  if(recital>=0&&(boundary<0||recital<boundary)){boundary=recital;boundaryEvidence='operative_legal_recital';}
  if(contentsAt>=0){for(let i=contentsAt+1;i<lines.length;i++){const n=numbered(lines[i]);if(n&&/^1$/.test(n.number)&&/\b(?:This\s*(?:Act|Ordinance|Order|Code)|These\s*(?:Rules|Regulations))/i.test(n.rest)){if(boundary<0||i<boundary){boundary=i;boundaryEvidence='first_numbered_operative_self_identification';}break;}}}
  const prefixEnd=boundary>=0?boundary:0;
  const tocIndices = [];
  if (contentsAt >= 0 && contentsAt < prefixEnd) {
    for (let i = contentsAt + 1; i < prefixEnd; i++) {
      const n = numbered(lines[i]);
      if (!n) continue;
      let rest=n.rest;
      let next=i+1;
      if(!rest){while(next<prefixEnd&&!lines[next].text)next++;if(next<prefixEnd&&!numbered(lines[next])&&!DIVISION.test(lines[next].text))rest=lines[next++].text;}
      while(next<prefixEnd&&lines[next].text&&!numbered(lines[next])&&!DIVISION.test(lines[next].text)&&!PAGE.test(lines[next].text)&&!PREAMBLE.test(lines[next].text)&&rest.length<230){rest+=' '+lines[next++].text;}
      const title = contentsTitle(rest);
      if (title.length < 3 || title.length > 180 || /[;{}]/.test(title) || /\b(?:shall|means|hereby)\b/i.test(title)) continue;
      if (!toc.has(n.number)) toc.set(n.number, []);
      if (!toc.get(n.number).some(t => key(t) === key(title))) toc.get(n.number).push(title);
      tocIndices.push(i);
    }
  }
  let firstStrong=-1;
  const scanFrom=boundary>=0?boundary:0;
  for(let i=scanFrom;i<lines.length;i++){const c=headingCandidate(lines,i,toc,kind==='Paragraph');if(c&&(toc.size||/\p{L}/u.test(c.body_tail))){firstStrong=i;break;}}
  const excluded = [];
  if (contentsAt >= 0 && boundary > contentsAt && tocIndices.length >= 1) {
    const lastToc = tocIndices.at(-1);
    let end=lastToc+1;
    // A final contents entry can wrap, but a blank line or title/recital ends it.
    while(end<boundary&&lines[end].text&&!PAGE.test(lines[end].text)&&!DIVISION.test(lines[end].text)&&!PREAMBLE.test(lines[end].text)&&key(lines[end].text)!==key(record.title))end++;
    excluded.push({from:contentsAt,to:end,reason:'source_print_contents',boundary_evidence:boundaryEvidence,character_start:lines[contentsAt].character_start,character_end:lines[end]?.character_start ?? Array.from(record.text).length});
  }
  const entries = [], divisions = [], problems = [];
  const maxToc=Math.max(0,...[...toc.keys()].map(n=>parseInt(n,10)));
  let scope = 'main', schedule = 0, previous = 0, lastMain = 0;
  const used = new Set();
  for (let i = scanFrom; i < lines.length; i++) {
    if (excluded.some(e => i >= e.from && i < e.to)) continue;
    if (DIVISION.test(lines[i].text)) {
      const title = squash(lines[i].text);
      const isSchedule = /SCHEDULE|ANNEX/.test(title);
      if (isSchedule) { scope = 'schedule-' + (++schedule); previous = 0; }
      divisions.push({title,index:i,scope,character_start:lines[i].character_start,anchor:'division-'+lines[i].character_start,kind:isSchedule?'Schedule':'Division'});
      continue;
    }
    const c = headingCandidate(lines, i, toc,kind==='Paragraph');
    if (!c) continue;
    const printedTitles=toc.get(c.number)||[];const titleAgrees=printedTitles.some(title=>headingKey(title)===headingKey(c.source_title||c.title));
    if(scope==='main'&&printedTitles.length&&!titleAgrees&&!c.status_heading&&!c.title_from_contents&&/(?:following[\s\S]{0,120}(?:section|provision)[\s\S]{0,120}(?:substitut|insert)|(?:substitut|insert)[\s\S]{0,120}following[\s\S]{0,120}(?:section|provision))/i.test(lines.slice(Math.max(scanFrom,i-8),i).map(l=>l.text).join(' '))){problems.push({line:i+1,number:c.number,reason:'quoted_or_inserted_heading_kept_as_source_text'});continue;}
    if(scope!=='main'&&c.source_title&&(toc.get(c.number)||[]).some(title=>headingKey(title)===headingKey(c.source_title))&&!used.has('main:'+c.number)){scope='main';previous=lastMain;}
    if(c.number.match(/^\d+[A-Z]+$/)&&parseInt(c.number,10)>maxToc&&maxToc>0){const suffix=String(previous)+c.number.match(/[A-Z]+$/)[0];if(c.number.endsWith(suffix)&&c.number!==suffix){c.marker=(c.marker||'')+c.number.slice(0,-suffix.length);c.number=suffix;}}
    const numeric = parseInt(c.number,10);
    const id = scope + ':' + c.number;
    if (used.has(id) || (!toc.size && numeric < previous)) {
      problems.push({line:i+1,number:c.number,reason:'repeated_or_nonsequential_heading_preserved_in_body'});
      continue;
    }
    used.add(id); previous = numeric;if(scope==='main')lastMain=numeric;
    const start = lines[i].character_start;
    entries.push({...c,kind:scope === 'main' ? kind : 'Paragraph',scope,anchor:'provision-'+c.number.toLowerCase()+'-'+start,character_start:start,character_end:0,label:(scope === 'main'?kind:'Schedule paragraph')+' '+c.number+((c.nav_title||c.title)?' — '+(c.nav_title||c.title):'')});
    i = c.end_index;
  }
  for (let i = 0; i < entries.length; i++) entries[i].character_end = entries[i+1]?.character_start ?? Array.from(record.text || '').length;
  for(const entry of entries){if(entry.scope!=='main')continue;const schedule=divisions.find(d=>d.kind==='Schedule'&&d.character_start>entry.character_start&&d.character_start<entry.character_end);if(schedule)entry.character_end=schedule.character_start;}
  const mainNumbers = new Set(entries.filter(e=>e.scope==='main').map(e=>e.number));
  const unmatched = [...toc.keys()].filter(n=>!mainNumbers.has(n));
  return {kind,entries,divisions,excluded,problems,contents_numbers:[...toc.keys()],unmatched_contents_numbers:unmatched,firstStrong,boundary,boundaryEvidence};
}

function safeText(line) { return line.raw.replace(/\t/g,'    ').trim(); }
export const readerInternals={linesOf,numbered,headingCandidate,findStructure,matchTitlePrefix};

export const readerCss = `
.structured-law{font:21px/1.72 Georgia,'Times New Roman',serif;white-space:normal;max-width:78ch;color:var(--ink,#152c3c)}
.structured-law p{margin:.75em 0;overflow-wrap:break-word}.structured-law .law-heading{font:700 1.12em/1.4 Georgia,serif;margin:1.8em 0 .8em;color:inherit;scroll-margin-top:30px}
.structured-law .law-division{font:700 1.3em/1.4 Georgia,serif;margin:2.2em 0 1em;text-align:center;scroll-margin-top:30px}.structured-law .law-list-item{padding-left:2em;text-indent:-1.5em}
.structured-law .law-proviso{padding-left:1.2em}.structured-law .law-source-note{font-size:.82em;line-height:1.6;border-left:2px solid #bbc8cd;padding:.4em 1em;color:var(--muted,#455963)}
.structured-law .law-layout{white-space:pre-wrap;overflow-x:auto;font:15px/1.55 monospace;border:1px solid #d4dde0;padding:1em;max-width:100%;tab-size:4}
.structured-law .passage-anchor,.structured-law .provision-anchor{scroll-margin-top:30px}.structured-law :target{background:#fff2bd;outline:2px solid #c29c34;outline-offset:4px}
.original-transcription{margin:2em 0;border-top:1px solid #cad3d8;padding-top:1em}.original-transcription summary{cursor:pointer;font-weight:bold}.original-transcription pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 monospace;max-height:70vh;overflow:auto;padding:1em;background:#f1f4f5}
.source-frontmatter{margin:1em 0}.source-frontmatter summary{cursor:pointer;font-size:.85em}.source-frontmatter pre{white-space:pre-wrap;font:14px/1.5 monospace;max-height:40vh;overflow:auto}
.law-navigation a{display:block;padding:8px 12px}.law-navigation .division-link{font-weight:bold}.law-navigation .schedule-link{padding-left:22px}.reader-quality-note{font:14px/1.6 Arial,sans-serif;background:#f1f5f6;padding:12px 16px;border-left:3px solid #879ba5}
@media(max-width:760px){.structured-law{font-size:19px;line-height:1.7;max-width:100%}.structured-law .law-layout{font-size:13px}.structured-law .law-list-item{padding-left:1.4em;text-indent:-1.1em}}
@media print{.structured-law{font-size:11pt;line-height:1.5}.original-transcription,.source-frontmatter,.reader-quality-note{display:none}.structured-law .law-heading{break-after:avoid}}
`;

export function renderLibraryReader(record, {sourceVerification, displayCorrections, sourceLayoutText,sourceArtifacts=[]} = {}) {
  const text = record.text || '';const cpText=Array.from(text);const corrected=correctedLines(text,displayCorrections,sourceLayoutText);const lines=corrected.lines,structure = findStructure(record, lines);
  const actualHash = hash(Buffer.from(text,'utf8'));
  if (record.text_sha256 && actualHash !== record.text_sha256) throw new Error('Reader input hash mismatch '+record.id);
  const excluded = [...structure.excluded];
  const headingAt = new Map(structure.entries.map(e=>[e.index,e]));
  const divisionAt = new Map(structure.divisions.map(e=>[e.index,e]));
  const titleKey = key(record.title || '');
  const pageArtifacts = [];
  if(!Array.isArray(sourceArtifacts))throw new Error('Source artifacts must be an array');let artifactEnd=-1;
  for(const a of [...sourceArtifacts].sort((x,y)=>x.character_start-y.character_start)){
    const slice=cpText.slice(a.character_start,a.character_end).join('');const originalLine=corrected.originals.find(l=>l.character_start<=a.character_start&&l.character_end>=a.character_end);
    if(!Number.isInteger(a.character_start)||!Number.isInteger(a.character_end)||a.character_start<0||a.character_end<=a.character_start||a.character_end>cpText.length||a.character_start<artifactEnd||typeof a.text!=='string'||!/^\d+$/u.test(a.text)||slice!==a.text||originalLine?.text!==a.text||a.input_text_sha256!==actualHash||!/^[a-f0-9]{64}$/i.test(a.source_pdf_sha256||'')||!Number.isInteger(a.source_page)||a.source_page<1||a.reason!=='page_footer_confirmed_in_original')throw new Error('Invalid original-source pagination artifact');
    const index=lines.findIndex(l=>l.character_start<=a.character_start&&l.character_end>=a.character_end&&l.text===a.text);if(index<0)throw new Error('Confirmed page footer is not an isolated logical line in the reading layout');
    pageArtifacts.push({...a,index});artifactEnd=a.character_end;
  }
  for (let i=0;i<lines.length;i++) {
    const line=lines[i];
    if (PAGE.test(line.text)) pageArtifacts.push({index:i,reason:'explicit_page_marker',character_start:line.character_start,character_end:line.character_end});
    else if (titleKey && key(line.text)===titleKey && i>4 && lines.slice(Math.max(0,i-4),i).some(l=>PAGE.test(l.text))) pageArtifacts.push({index:i,reason:'running_title_after_page_marker',character_start:line.character_start,character_end:line.character_end});
  }
  const skip = new Set(pageArtifacts.map(p=>p.index));
  for (const e of excluded) for(let i=e.from;i<e.to;i++)skip.add(i);
  const blocks = []; let current=[];
  const flush = () => {if(!current.length)return;const first=current[0],last=current.at(-1);let value=current.map(safeText).join(' ').replace(/\s+/gu,' ').trim();if(value)blocks.push({tag:'p',className:FOOTNOTE.test(first.text)?'law-source-note':/^\(?[a-zivxlcdm\d]+[).]\s/i.test(first.text)?'law-list-item':/^Provided\b/i.test(first.text)?'law-proviso':'',text:value,coverageText:value,character_start:first.character_start,character_end:last.character_end});current=[];};
  for(let i=0;i<lines.length;i++){
    const l=lines[i];if(skip.has(i)){flush();continue;}
    const h=headingAt.get(i),d=divisionAt.get(i);
    if(h){flush();const headingBlock={tag:'h2',className:'law-heading',text:(h.marker?'['+h.marker+'] ':'')+h.kind+' '+h.number+'. '+h.title,coverageText:h.source_number_prefix+'. '+(h.title_from_contents?'':h.title),character_start:h.character_start,character_end:lines[h.end_index].character_end,anchor:h.anchor};blocks.push(headingBlock);
      // Split the title from its body by using the identified separator/title only.
      const rawJoined=lines.slice(i,h.end_index+1).map(x=>x.text).join(' ');const numberedPrefix=rawJoined.match(/^(?:\d{1,3}\s*\[\s*|\[\s*)?\d{1,3}(?:\s*[-]?\s*[A-Z]{1,3})?\s*\.?\s*/u)?.[0]||'';
      const prefix=rawJoined.slice(0,numberedPrefix.length+h.title_marker.length);const rest=rawJoined.slice(prefix.length);let cut=h.source_title?exactPrefixLength(rest,h.source_title):0;
      if(cut<0){structure.problems.push({line:i+1,number:h.number,reason:'heading_prefix_character_mismatch'});cut=0;}
      const separator=rest.slice(cut).match(/^\s*(?:[.:]\s*)?(?:[—–−_-]+\s*)?/u)?.[0]||'';
      headingBlock.punctuationCoverage=prefix+rest.slice(0,cut)+separator;
      const body=rest.slice(cut+separator.length);if(body){const consumed=sourcePrefixLength(cpText.slice(h.character_start,lines[h.end_index].character_end),headingBlock.punctuationCoverage);const bodyStart=consumed<0?h.character_start:h.character_start+consumed;if(consumed<0)structure.problems.push({line:i+1,number:h.number,reason:'heading_body_offset_alignment_unresolved'});else headingBlock.character_end=bodyStart;current.push({raw:body,text:body,character_start:bodyStart,character_end:lines[h.end_index].character_end});}i=h.end_index;continue;}
    if(d){flush();blocks.push({tag:'h2',className:'law-division',text:d.title,coverageText:d.title,character_start:d.character_start,character_end:l.character_end,anchor:d.anchor});continue;}
    if(!l.text){flush();continue;}
    const listStart=/^\s*(?:\([a-zivxlcdm\d]+\)|[a-zivxlcdm\d]{1,5}[.)])\s+/i.test(l.raw);
    const noteStart=FOOTNOTE.test(l.text);
    if(listStart||noteStart||/^Provided\b/i.test(l.text))flush();
    // Keep apparent tabular/form layouts intact rather than inventing cell boundaries.
    if(/\t|\S {4,}\S/.test(l.raw)&&!listStart&&l.text.length>5){
      let j=i;const rows=[];while(j<lines.length&&!skip.has(j)&&lines[j].text&&!headingAt.has(j)&&!divisionAt.has(j)&&(/\t|\S {4,}\S/.test(lines[j].raw)||rows.length>0&&/^[-=_ ]+$/.test(lines[j].raw))){rows.push(lines[j]);j++;}
      if(rows.length>=2){flush();blocks.push({tag:'pre',className:'law-layout',text:rows.map(x=>x.raw).join('\n'),character_start:l.character_start,character_end:rows.at(-1).character_end});i=j-1;continue;}
    }
    current.push(l);
    if(current.length&&FOOTNOTE.test(current[0].text)&&/[.]\s*$/.test(l.text))flush();
    if(/[;:!?]\s*$/.test(l.text)&&l.text.length<40&&!listStart)flush();
  }
  flush();
  const passages = (record.passages || []).map(p=>({...p,searchText:squash(cpText.slice(p.character_start,p.character_end).join(''))}));
  // Anchors belong beside the first retained block crossing the source position.
  const blockAt=position=>{let low=0,high=blocks.length;while(low<high){const middle=(low+high)>>>1;if(blocks[middle].character_end<position)low=middle+1;else high=middle;}return Math.min(low,Math.max(0,blocks.length-1));};
  const placed = new Map();for(const p of passages){const index=blockAt(p.character_start);if(!placed.has(index))placed.set(index,[]);placed.get(index).push(p);}
  // The old generator's anchors used the printed line number and original line offset.
  // Retain all such positions, even when a former heading is no longer a navigation entry.
  const legacy=[];for(const line of corrected.originals){const n=numbered(line);if(!n)continue;const variants=new Set([n.number,n.printed_number]);if(n.marker)variants.add(n.marker+n.printed_number);for(const number of variants)legacy.push({anchor:'provision-'+number.toLowerCase()+'-'+line.character_start,character_start:line.character_start});}
  const existingIds=new Set(blocks.map(b=>b.anchor).filter(Boolean));
  const legacyAt=new Map();for(const entry of legacy){if(existingIds.has(entry.anchor))continue;const index=blockAt(entry.character_start);if(!legacyAt.has(index))legacyAt.set(index,[]);legacyAt.get(index).push(entry);existingIds.add(entry.anchor);}
  const visible = blocks.map((b,i)=>(placed.get(i)||[]).map(p=>'<span id="'+escape(p.reader_fragment)+'" class="passage-anchor" data-passage-text="'+escape(p.searchText)+'" data-source-start="'+p.character_start+'" data-source-end="'+p.character_end+'"></span>').join('')+(legacyAt.get(i)||[]).map(e=>'<span id="'+escape(e.anchor)+'" class="provision-anchor" data-source-start="'+e.character_start+'"></span>').join('')+'<'+b.tag+(b.anchor?' id="'+escape(b.anchor)+'"':'')+' class="'+b.className+'" data-source-start="'+b.character_start+'" data-source-end="'+b.character_end+'">'+escape(b.text)+'</'+b.tag+'>').join('\n');
  const sourceContents=excluded.map(e=>'<details class="source-frontmatter"><summary>Print contents from the source</summary><pre>'+escape(cpText.slice(e.character_start,e.character_end).join(''))+'</pre></details>').join('');
  const notice=record.content_kind==='source_notice'?'<p class="reader-quality-note">This record contains a source notice. The legislation text is not available in this record.</p>':structure.entries.length?'<p class="reader-quality-note">Reading layout follows the stored source. Open the original transcription below to compare wording and extraction details.</p>':'<p class="reader-quality-note">The source has no reliably identified numbered headings. Its full text is retained below in paragraphs; use Search this legislation to locate a phrase.</p>';
  const html='<div id="law-text" class="reader-text structured-law" tabindex="-1" data-text-sha256="'+actualHash+'">'+notice+visible+sourceContents+'</div><details class="original-transcription" id="original-transcription"><summary>Compare the original stored transcription</summary><p>Exact source transcription retained, including print layout and extraction artifacts. Text SHA-256: <code>'+actualHash+'</code>.</p><pre id="source-transcription">'+escape(text)+'</pre></details>';
  const navigation=[...structure.entries,...structure.divisions].sort((a,b)=>a.character_start-b.character_start);
  const nav='<details open><summary>Contents of this legislation</summary><nav aria-label="Identified provisions" class="law-navigation" style="display:block">'+(navigation.length?navigation.map(e=>'<a class="'+(e.scope?.startsWith('schedule')?'schedule-link':e.kind==='Division'||e.kind==='Schedule'?'division-link':'')+'" href="#'+escape(e.anchor)+'">'+escape(e.label||e.title)+'</a>').join(''):'<a href="#law-text">Read the text</a>')+'</nav>'+(structure.unmatched_contents_numbers.length?'<p class="data-note">'+structure.unmatched_contents_numbers.length+' source contents entries have not been matched to an operative heading. The full wording remains in the reading text and original transcription.</p>':'')+'</details>';
  const retained=retainedSourceCharacters(cpText,[...excluded,...pageArtifacts]);
  const renderedCanonical=key(blocks.map(b=>b.coverageText??b.text).join(' '));const retainedCanonical=key(retained);
  const visibleContentPreserved=renderedCanonical===retainedCanonical;
  const retainedPunctuation=retained.replace(/\s/gu,'');const renderedPunctuation=blocks.map(b=>b.punctuationCoverage??b.text).join('').replace(/\s/gu,'');
  return {html,nav,css:readerCss,provisions:structure.entries.map(({index,end_index,body_tail,separator,marker,...e})=>e),report:{id:record.id,input_sha256:actualHash,source_characters:cpText.length,source_text_preserved:true,visible_content_preserved:visibleContentPreserved,visible_punctuation_preserved:retainedPunctuation===renderedPunctuation,retained_content_sha256:hash(retainedCanonical),rendered_content_sha256:hash(renderedCanonical),retained_punctuation_sha256:hash(retainedPunctuation),rendered_punctuation_sha256:hash(renderedPunctuation),provision_count:structure.entries.length,division_count:structure.divisions.length,paragraph_count:blocks.filter(b=>b.tag==='p').length,layout_blocks:blocks.filter(b=>b.tag==='pre').length,legacy_passage_anchors:passages.length,legacy_provision_anchors:legacy.length,contents_numbers_observed:structure.contents_numbers,unmatched_contents_numbers:structure.unmatched_contents_numbers,source_print_contents:excluded.map(({from,to,...e})=>e),contents_boundary:structure.boundary>=0?{character_start:lines[structure.boundary].character_start,evidence:structure.boundaryEvidence}:null,source_contents_heading_labels:structure.entries.filter(e=>e.title_from_contents).length,page_artifacts:pageArtifacts.map(({index,...p})=>p),structural_ambiguities:structure.problems,status:record.content_kind==='source_notice'?'source_notice':structure.entries.length?'structured_source_transcription':'paragraph_source_transcription',source_comparison_status:sourceVerification?.status??'separately_recorded',display_corrections_applied:corrected.corrections.length,original_source_layout_applied:corrected.sourceLayoutApplied,source_layout_sha256:corrected.sourceLayoutApplied?hash(Buffer.from(sourceLayoutText,'utf8')):null,verification_scope:'Layout transformation of stored transcription; original-source comparison is separately recorded.'}};
}
