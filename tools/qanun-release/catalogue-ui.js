'use strict';
function qanunWords(value) {return String(value||'').normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/u).filter(Boolean);}
function qanunMatch(record, filters) {
 const words=qanunWords(filters.q),title=qanunWords(record.title).join(' ');
 return words.every(word=>title.includes(word)) && (!filters.jur || (filters.jur==='ICT'?record.ict:record.collection===filters.jur)) && (!filters.year || (filters.year==='unknown'?!record.year:record.year===filters.year)) && (!filters.instrument || record.type===filters.instrument) && (!filters.kind || record.kind===filters.kind);
}
if(typeof module!=='undefined'&&module.exports) module.exports={qanunMatch,qanunWords};
if(typeof document!=='undefined') {
 const form=document.getElementById('searchform'),ids=['q','jur','year','instrument','kind'];
 const cards=new Map(QANUN_RECORDS.map(r=>[r.id,document.getElementById(r.id)]));
 const count=document.getElementById('resultcount'),empty=document.getElementById('empty'),emptyText=document.getElementById('empty-text'),more=document.getElementById('more');
 let visibleLimit=40,matches=[],directRecord='';
 function readState(){const params=new URLSearchParams(location.search);for(const id of ids)document.getElementById(id).value=params.get(id)||'';const n=Number(params.get('shown'));visibleLimit=Number.isInteger(n)&&n>=40?Math.min(n,QANUN_RECORDS.length):40;directRecord=cards.has(params.get('record'))?params.get('record'):'';}
 function stateUrl(anchor='catalogue'){const p=new URLSearchParams();for(const id of ids){const v=document.getElementById(id).value;if(v)p.set(id,v);}if(visibleLimit>40)p.set('shown',String(visibleLimit));if(directRecord)p.set('record',directRecord);return '/legislation'+(p.size?'?'+p.toString():'')+'#'+anchor;}
 function apply(reset=true,save=true){
  if(reset){visibleLimit=40;directRecord='';}
  const filters=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));
  matches=QANUN_RECORDS.filter(r=>(!directRecord||r.id===directRecord)&&qanunMatch(r,filters));
  const shown=new Set(matches.slice(0,visibleLimit).map(r=>r.id));
  for(const [id,card] of cards){card.hidden=!shown.has(id);if(!card.hidden){for(const link of card.querySelectorAll('a[data-reader]'))link.href='/laws/'+id+'?return='+encodeURIComponent(stateUrl(id));}}
  count.textContent=matches.length.toLocaleString('en')+' matching reader record'+(matches.length===1?'':'s')+' · '+Math.min(visibleLimit,matches.length).toLocaleString('en')+' shown';
  empty.hidden=matches.length!==0;
  emptyText.textContent=filters.jur==='Sindh'?'Sindh texts are not yet available in this published collection. Clear the collection filter to explore other legislation.': 'No titles match these filters. Try fewer words or clear the filters. A missing result does not establish that no applicable law exists.';
  more.hidden=matches.length<=visibleLimit;
  if(save)history.replaceState(null,'',stateUrl());
 }
 function clear(){form.reset();}
 form.addEventListener('submit',e=>{e.preventDefault();apply();});
 form.addEventListener('reset',()=>setTimeout(()=>{directRecord='';apply();},0));
 document.getElementById('empty-reset').addEventListener('click',clear);
 for(const id of ids.slice(1))document.getElementById(id).addEventListener('change',()=>apply());
 more.addEventListener('click',()=>{visibleLimit+=40;apply(false);});
 function revealAnchor(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!cards.has(id))return;
  if(!matches.some(r=>r.id===id)){for(const key of ids)document.getElementById(key).value='';directRecord=id;visibleLimit=40;apply(false,false);}
  else if(cards.get(id).hidden){directRecord=id;visibleLimit=40;apply(false,false);}
  requestAnimationFrame(()=>cards.get(id).scrollIntoView({block:'start'}));
 }
 function restore(){readState();apply(false,false);revealAnchor();}
 window.addEventListener('hashchange',()=>{if(location.hash==='#catalogue'&&!location.search){for(const key of ids)document.getElementById(key).value='';directRecord='';visibleLimit=40;apply(false,false);}else revealAnchor();});window.addEventListener('popstate',restore);restore();
}
