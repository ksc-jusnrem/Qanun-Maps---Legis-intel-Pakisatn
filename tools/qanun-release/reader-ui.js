'use strict';
(function(){
 const link=document.getElementById('catalogue-return');
 const requested=new URLSearchParams(location.search).get('return');
 if(requested){try{const u=new URL(requested,location.origin);const allowed=['q','jur','year','instrument','kind','shown','record'];if(u.origin===location.origin&&['/','/legislation'].includes(u.pathname)&&[...u.searchParams.keys()].every(k=>allowed.includes(k))&&/^#(?:catalogue|[a-zA-Z0-9_-]+)$/.test(u.hash)){link.href=u.pathname+u.search+u.hash;link.textContent='Back to your search';}}catch{}}
 const form=document.getElementById('reader-search');
 if(!form)return;
 const query=document.getElementById('reader-query'),status=document.getElementById('reader-search-status'),results=document.getElementById('reader-search-results');
 const normalize=s=>s.replace(/\s+/g,' ').trim();
 const headings=Array.from(document.querySelectorAll('nav[aria-label="Identified provisions"] a')).map(a=>({label:a.textContent,href:a.getAttribute('href'),text:normalize(a.textContent).toLowerCase(),kind:'Identified heading'}));
 const passages=Array.from(document.querySelectorAll('#law-text span[id^="p-"]')).map(p=>({label:normalize(p.textContent),href:'#'+p.id,text:normalize(p.textContent).toLowerCase(),kind:'Stored passage'}));
 function search(event){
  event?.preventDefault();results.replaceChildren();
  const words=normalize(query.value).toLowerCase().split(' ').filter(Boolean);
  if(!words.length){status.textContent='Enter a provision number, heading or words from this text.';return;}
  const matches=[...headings,...passages].filter(p=>words.every(w=>p.text.includes(w)));
  status.textContent=matches.length+' matching headings or passages · '+Math.min(matches.length,20)+' shown. Matches locate stored text; they do not establish legal applicability.';
  for(const match of matches.slice(0,20)){
   const item=document.createElement('li'),a=document.createElement('a'),note=document.createElement('small');
   a.href=match.href;
   const at=Math.max(0,match.text.indexOf(words[0])-60);
   a.textContent=match.kind==='Identified heading'?match.label:(at?'…':'')+match.label.slice(at,at+240)+(match.label.length>at+240?'…':'');
   note.textContent=match.kind;item.append(a,note);results.append(item);
  }
 }
 form.hidden=false;form.addEventListener('submit',search);
 document.getElementById('reader-search-clear').addEventListener('click',()=>{query.value='';search();query.focus();});
})();
