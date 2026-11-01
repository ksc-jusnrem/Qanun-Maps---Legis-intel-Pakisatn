import crypto from 'node:crypto';
import {parseSections} from './section-navigation.mjs';
export const PILOT_IDS=new Set(['kp-code-a6074824f081e544','pk-code-30ecabb4a7ed433a','pk-code-6c462b7d924dbbe3','kp-code-215827543b1e2c76','kp-code-4eed2df483c9a23d','kp-code-698a1a46ca512f96']);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const decode=s=>s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,x)=>x[0]==='#'?String.fromCodePoint(parseInt(x.slice(x[1]==='x'?2:1),x[1]==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x]));
export function applyReaderLayout(record,html){
 if(!PILOT_IDS.has(record.id))return {html,report:{status:'outside_six_reader_pilot'}};
 const parsed=parseSections(record);const match=html.match(/<pre id="law-text"[^>]*>([\s\S]*?)<\/pre>/);if(!match)throw Error('Missing original text block');
 // Stable passage IDs remain at the same text offsets as empty anchors. This
 // prevents presentation spans crossing the original passage wrapper boundaries.
 const stack=[]; const sourceMarkup=match[1].replace(/<span\b[^>]*>|<\/span>/g,tag=>{
  if(tag.startsWith('</')){const passage=stack.pop();return passage?'':tag;}
  const passage=/\bid="p-\d+-\d+-[a-f0-9]+"/.test(tag);stack.push(passage);
  return passage?tag.replace(/>$/, ' class="passage-anchor">')+'</span>':tag;
 }); if(stack.length)throw Error('Unbalanced source span markup');
 const tokens=[...sourceMarkup.matchAll(/<[^>]*>|&(?:#x[\da-f]+|#\d+|[a-z]+);|[\s\S]/giu)].map(x=>x[0]);const text=tokens.filter(x=>!x.startsWith('<')).map(decode).join('');if(text!==record.text||hash(text)!==record.text_sha256)throw Error('Source mismatch');
 const opens=new Map(),closes=new Map();const add=(map,n,s)=>map.set(n,(map.get(n)||'')+s);const headings=[];
 for(const e of parsed.entries){const tail=Array.from(text).slice(e.character_start).join('');const pattern=Array.from(e.title).map(c=>/\s/.test(c)?'\\s+':/[-–—]/.test(c)?'\\s*[-–—]\\s*':/[’']/.test(c)?"[’']":c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');const m=tail.match(new RegExp('^[ \\t]*(?:\\d{1,2}\\[?)?'+e.number+'\\.[ \\t\\r\\n]*(?:\\d{1,2})?'+pattern+'\\s*[.:](?:[ \\t]*[-–—_]{1,4})?','i'));if(!m)continue;const end=e.character_start+Array.from(m[0]).length;headings.push({start:e.character_start,end});add(opens,e.character_start,'<span class="display-heading" role="heading" aria-level="2">');add(closes,end,'</span>');}
 if(parsed.entries.length){add(opens,0,'<span class="display-opening">');add(closes,parsed.entries[0].character_start,'</span>');}
 let prose=0;const bodyIndex=Array.from(text).slice(0,parsed.entries[0]?.character_start??0).join('').length;
 const scheduleMatches=[...text.matchAll(/^[ \t]*(?:(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH)\s+)?SCHEDULE\b[^\r\n]*\r?$/gm)];const schedule=scheduleMatches.find(m=>m.index>bodyIndex)?.index??-1;const bodyStart=parsed.entries[0]?.character_start??Infinity;
 for(const m of text.matchAll(/^[ \t]*\S[^\r\n]*(?:\r?\n[ \t]*\S[^\r\n]*)*/gm)){
  let start=Array.from(text.slice(0,m.index)).length;const end=start+Array.from(m[0]).length;if(start<bodyStart||(schedule>=0&&m.index>=schedule))continue;
  const overlap=headings.filter(h=>start<h.end&&end>h.start);if(overlap.length===1&&overlap[0].start===start)start=overlap[0].end;else if(overlap.length)continue;
  const fragment=Array.from(text).slice(start,end).join(''),lines=fragment.split(/\r?\n/).map(x=>x.trim());
  if(lines.length<2||lines.some(x=>x.split(/\s+/).length<4)||/[\t]|\S {3,}\S|[|]/.test(fragment)||lines.slice(1).some(x=>/^(?:\(?[a-z0-9ivx]+[).]|CHAPTER|PART|SCHEDULE|\d{4})\s/i.test(x)))continue;
  add(opens,start,'<span class="display-prose">');add(closes,end,'</span>');prose++;
 }
 let pos=0,result='';for(const token of tokens){if(!token.startsWith('<')){if(closes.has(pos)){result+=closes.get(pos);closes.delete(pos);}if(opens.has(pos)){result+=opens.get(pos);opens.delete(pos);}pos+=Array.from(decode(token)).length;}result+=token;}if(closes.has(pos)){result+=closes.get(pos);closes.delete(pos);}if(opens.size||closes.size)throw Error('Unresolved presentation offset');
 const css=`\n.reader-text.display-text{white-space:pre-wrap;overflow-wrap:break-word;font-size:20px;line-height:1.6}.display-prose{white-space:normal}.display-heading{white-space:normal;display:block;font-weight:600;color:var(--green);font-size:1.15em;line-height:1.35;margin:1.65em 0 .65em;scroll-margin-top:75px}.display-opening{white-space:pre-wrap;display:block}.readtabs{position:sticky;top:0;background:white;z-index:5;padding:8px 0;border-bottom:1px solid var(--silver)}.reader-text span.provision-anchor{scroll-margin-top:85px}.contents#legislation-contents{scroll-margin-top:75px}.contents details:not([open])>nav,.contents details:not([open])>.data-note{display:none!important}.contents summary{font-size:14px}.contents a{font-size:13px}.display-text .page-artifact{display:none}.display-text .passage-anchor:target{display:inline-block;width:0;height:1em;border-left:3px solid var(--green);margin-left:-3px;vertical-align:text-bottom;scroll-margin-top:85px}@media(max-width:760px){.contents details{max-height:40vh}.contents{margin-bottom:16px}.display-text{font-size:19px!important}.readtabs{gap:14px;font-size:13px}.reading h1{font-size:32px}.display-heading{margin-top:1.3em}}@media print{.readtabs{display:none}.display-text{font-size:12pt!important}.display-heading{break-after:avoid}}\n`;
 let updated=html.replace(match[0],'<div id="law-text" class="reader-text display-text" tabindex="-1">'+result+'</div>').replace('</style>',css+'</style>');updated=updated.replace('<aside class="contents" aria-label="Legislation contents"><details open>','<aside id="legislation-contents" class="contents" aria-label="Legislation contents"><details>');updated=updated.replace('<div class="readtabs">','<div class="readtabs"><a href="#legislation-contents">Contents</a>');return{html:updated,report:{headings:headings.length,prose_blocks:prose,parsed_heading_count:parsed.entries.length,source_sha256:hash(text)}};
}
