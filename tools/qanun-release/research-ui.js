(()=>{
const form=document.querySelector('#research-search');if(!form)return;
const q=form.querySelector('input'),court=form.querySelector('[name=court]'),topic=form.querySelector('[name=topic]');
const cards=[...document.querySelectorAll('[data-research-card]')],more=document.querySelector('#research-more'),status=document.querySelector('#research-status');
const params=new URLSearchParams(location.search);let limit=30;
const law=params.get('law')||'';const lawName=document.querySelector('#law-filter');
if(lawName&&law){lawName.hidden=false;lawName.querySelector('span').textContent='Showing research leads for the selected legislation.';}
if(params.get('q'))q.value=params.get('q');
function render(){const words=q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let matches=0;
for(const c of cards){const hit=words.every(w=>c.textContent.toLowerCase().includes(w))&&(!court?.value||c.dataset.court===court.value)&&(!topic?.value||JSON.parse(c.dataset.topics||'[]').includes(topic.value))&&(!law||JSON.parse(c.dataset.laws||'[]').includes(law));c.hidden=!hit||matches>=limit;if(hit)matches++;}
status.textContent=`${matches.toLocaleString()} matching records · ${Math.min(limit,matches)} shown`;more.hidden=matches<=limit;
}
form.addEventListener('submit',e=>{e.preventDefault();limit=30;render();});q.addEventListener('input',()=>{limit=30;render();});
for(const s of [court,topic])s?.addEventListener('change',()=>{limit=30;render();});
form.addEventListener('reset',()=>{queueMicrotask(()=>{limit=30;render();});});
more.addEventListener('click',()=>{limit+=30;render();});
function reveal(){if(!location.hash.startsWith('#case-'))return;const c=document.getElementById(location.hash.slice(1));if(c){c.hidden=false;c.querySelector('details').open=true;c.scrollIntoView();}}
render();reveal();addEventListener('hashchange',reveal);
})();
