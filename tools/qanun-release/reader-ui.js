'use strict';
(function(){
 let lastPassageBlock;
 function highlightSourcePassage(){
  if(lastPassageBlock)lastPassageBlock.classList.remove('source-passage-target');
  const fragment=location.hash?.slice(1);if(!fragment)return;
  const anchor=document.getElementById(fragment);if(!anchor)return;
  let ancestor=anchor.parentElement;while(ancestor){if(ancestor.tagName==='DETAILS')ancestor.open=true;ancestor=ancestor.parentElement;}
  if(!anchor.classList?.contains('passage-anchor'))return;
  let block=anchor.nextElementSibling;while(block?.classList?.contains('passage-anchor')||block?.classList?.contains('provision-anchor'))block=block.nextElementSibling;
  if(block){block.classList.add('source-passage-target');lastPassageBlock=block;}
 }
 globalThis.addEventListener?.('hashchange',highlightSourcePassage);highlightSourcePassage();
 const link=document.getElementById('catalogue-return');
 const requested=new URLSearchParams(location.search).get('return');
 if(requested){try{const u=new URL(requested,location.origin);const allowed=['q','jur','year','instrument','kind','shown','record'];if(u.origin===location.origin&&['/','/legislation'].includes(u.pathname)&&[...u.searchParams.keys()].every(k=>allowed.includes(k))&&/^#(?:catalogue|[a-zA-Z0-9_-]+)$/.test(u.hash)){link.href=u.pathname+u.search+u.hash;link.textContent='Back to your search';}}catch{}}
 const form=document.getElementById('reader-search');
 if(!form)return;
 const format=document.getElementById('reader-format'),text=document.getElementById('law-text');
 if(format&&text){format.hidden=false;if(text.tagName==='PRE'){format.addEventListener('click',()=>{const show=text.classList.toggle('show-extraction');format.setAttribute('aria-pressed',String(show));format.textContent=show?'Use reading view':'Show extraction spacing';});}else{format.textContent=text.getAttribute('data-reader-kind')==='original-facsimile'?'View archived transcription':'View source transcription';format.addEventListener('click',()=>{const raw=document.getElementById('reading-source-transcription')||document.getElementById('source-transcription');if(!raw)return;let parent=raw.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}raw.scrollIntoView({block:'start'});});}}
 const query=document.getElementById('reader-query'),status=document.getElementById('reader-search-status'),results=document.getElementById('reader-search-results');
 const normalize=s=>s.replace(/\s+/g,' ').trim();
 const headings=Array.from(document.querySelectorAll('nav[aria-label="Identified provisions"] a')).map(a=>({label:a.textContent,href:a.getAttribute('href'),text:normalize(a.textContent).toLowerCase(),kind:'Identified heading'}));
 const passages=Array.from(document.querySelectorAll('#law-text span[id^="p-"]')).map(p=>{const text=normalize(p.dataset?.passageText??p.textContent);return{label:text,href:'#'+p.id,text:text.toLowerCase(),kind:'Stored passage'};});
 const more=document.createElement('button');more.type='button';more.id='reader-search-more';more.textContent='Show more matches';more.hidden=true;form.append(more);
 let matches=[],shown=0,currentWords=[];
 function render(start=0){
  if(!start)results.replaceChildren();
  let firstNewLink;
  status.textContent=matches.length+' matching headings or passages · '+Math.min(matches.length,shown)+' shown. Matches locate stored text; they do not establish legal applicability.';
  for(const match of matches.slice(start,shown)){
   const item=document.createElement('li'),a=document.createElement('a'),note=document.createElement('small');
   a.href=match.href;if(!firstNewLink)firstNewLink=a;
   const at=Math.max(0,match.text.indexOf(currentWords[0])-60);
   a.textContent=match.kind==='Identified heading'?match.label:(at?'…':'')+match.label.slice(at,at+240)+(match.label.length>at+240?'…':'');
   note.textContent=match.kind;item.append(a,note);results.append(item);
  }
  more.hidden=shown>=matches.length;
  if(start)firstNewLink?.focus();
 }
 function search(event){
  event?.preventDefault();results.replaceChildren();more.hidden=true;matches=[];shown=20;
  const q=normalize(query.value).toLowerCase();
  currentWords=q.split(' ').filter(Boolean);
  if(!currentWords.length){status.textContent='Enter a provision number, heading or words from this text.';return;}
  // A numbered provision is an identifier, not a substring (42 is not 142 or 420).
  const reference=q.match(/^(section|article|rule|regulation)\s+(\d+[a-z]?)(?=$|\s|[.,:])/);
  const numbered=reference?new RegExp('\\b'+reference[1]+'\\s+'+reference[2]+'(?![a-z0-9])','i'):null;
  matches=[...headings,...passages].filter(p=>currentWords.every(w=>p.text.includes(w))&&(!numbered||numbered.test(p.text)));
  render();
 }
 more.addEventListener('click',()=>{const start=shown;shown+=20;render(start);});
 form.hidden=false;form.addEventListener('submit',search);
 document.getElementById('reader-search-clear').addEventListener('click',()=>{query.value='';search();query.focus();});
})();
