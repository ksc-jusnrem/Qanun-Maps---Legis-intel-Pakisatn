(()=>{
const form=document.querySelector('#research-search');if(!form)return;
const q=form.querySelector('input'),court=form.querySelector('[name=court]'),topic=form.querySelector('[name=topic]'),scope=form.querySelector('[name=scope]');
const cards=[...document.querySelectorAll('[data-research-card]')],more=document.querySelector('#research-more'),status=document.querySelector('#research-status');
const params=new URLSearchParams(location.search);let limit=30;
let law=params.get('law')||'';const lawName=document.querySelector('#law-filter');
if(lawName&&law){lawName.hidden=false;lawName.querySelector('span').textContent='Showing research leads for the selected legislation.';}
if(params.get('q'))q.value=params.get('q');
if(params.has('scope')&&[...scope.options].some(o=>o.value===params.get('scope')))scope.value=params.get('scope');
function restore(){const p=new URLSearchParams(location.search);q.value=p.get('q')||'';for(const [key,field] of [['court',court],['topic',topic],['scope',scope]])if(field){const value=p.get(key);field.value=value!==null&&[...field.options].some(o=>o.value===value)?value:field.querySelector('option[selected]')?.value||field.options[0].value;}law=p.get('law')||'';const shown=Number(p.get('shown'));limit=Number.isSafeInteger(shown)&&shown>=30?Math.min(shown,cards.length):30;}
function save(){const p=new URLSearchParams();for(const [key,value] of [['q',q.value],['court',court?.value],['topic',topic?.value],['scope',scope?.value],['law',law]])if(value||key==='scope')p.set(key,value);if(limit>30)p.set('shown',limit);const search=p.toString();history.replaceState(null,'',location.pathname+(search?'?'+search:'')+location.hash);}
function render(){const words=q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let matches=0;
for(const c of cards){const hit=(!scope.value||c.dataset.scope===scope.value)&&words.every(w=>c.dataset.search.includes(w))&&(!court?.value||c.dataset.court===court.value)&&(!topic?.value||JSON.parse(c.dataset.topics||'[]').includes(topic.value))&&(!law||JSON.parse(c.dataset.laws||'[]').includes(law));c.hidden=!hit||matches>=limit;if(hit)matches++;}
status.textContent=`${matches.toLocaleString()} matching records · ${Math.min(limit,matches)} shown`+(matches?'':' · Try fewer words or clear the filters.');more.hidden=matches<=limit;if(lawName)lawName.hidden=!law;
}
form.addEventListener('submit',e=>{e.preventDefault();limit=30;render();save();});q.addEventListener('input',()=>{limit=30;render();save();});
for(const s of [court,topic,scope])s?.addEventListener('change',()=>{limit=30;render();save();});
form.addEventListener('reset',()=>{queueMicrotask(()=>{q.value='';court.value='';topic.value='';law='';limit=30;render();save();});});
more.addEventListener('click',()=>{limit+=30;render();save();});
function reveal(){if(!location.hash.startsWith('#case-'))return;const c=document.getElementById(location.hash.slice(1));if(c){q.value='';court.value='';topic.value='';scope.value='';render();c.hidden=false;c.querySelector('details').open=true;c.scrollIntoView();}}
restore();render();reveal();addEventListener('hashchange',reveal);addEventListener('popstate',()=>{restore();render();reveal();});
})();
