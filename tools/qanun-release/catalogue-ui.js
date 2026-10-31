'use strict';
function qanunMatch(record, filters) {
 const words=String(filters.q||'').normalize('NFKC').toLocaleLowerCase('en').trim().split(/\s+/u).filter(Boolean);
 const title=record.title.normalize('NFKC').toLocaleLowerCase('en');
 return words.every(word=>title.includes(word)) && (!filters.jur || (filters.jur==='ICT'?record.ict:record.collection===filters.jur)) && (!filters.year || (filters.year==='unknown'?!record.year:record.year===filters.year)) && (!filters.instrument || record.type===filters.instrument) && (!filters.kind || record.kind===filters.kind);
}
if(typeof module!=='undefined'&&module.exports) module.exports={qanunMatch};
if(typeof document!=='undefined') {
 const form=document.getElementById('searchform');const ids=['q','jur','year','instrument','kind'];
 const cards=new Map(QANUN_RECORDS.map(r=>[r.id,document.getElementById(r.id)]));
 const count=document.getElementById('resultcount'),empty=document.getElementById('empty'),more=document.getElementById('more');
 let visibleLimit=40;let matches=[];
 function apply(reset=true){if(reset)visibleLimit=40;const filters=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));matches=QANUN_RECORDS.filter(r=>qanunMatch(r,filters));const shown=new Set(matches.slice(0,visibleLimit).map(r=>r.id));for(const [id,card] of cards)card.hidden=!shown.has(id);count.textContent=matches.length.toLocaleString('en')+' matching reader record'+(matches.length===1?'':'s')+' · '+Math.min(visibleLimit,matches.length).toLocaleString('en')+' shown';empty.hidden=matches.length!==0;more.hidden=matches.length<=visibleLimit;}
 form.addEventListener('submit',e=>{e.preventDefault();apply();});
 form.addEventListener('reset',()=>{setTimeout(()=>apply(),0);});
 for(const id of ids.slice(1))document.getElementById(id).addEventListener('change',()=>apply());
 more.addEventListener('click',()=>{visibleLimit+=40;apply(false);});
 function revealAnchor(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(cards.has(id)){for(const key of ids)document.getElementById(key).value='';const index=QANUN_RECORDS.findIndex(r=>r.id===id);visibleLimit=Math.max(40,index+1);apply(false);requestAnimationFrame(()=>cards.get(id).scrollIntoView({block:'start'}));}}
 window.addEventListener('hashchange',revealAnchor);apply();if(location.hash)revealAnchor();
}
