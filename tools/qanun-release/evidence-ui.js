(() => {
  'use strict';
  const root=document.getElementById('evidence-inspector');
  if(!root) return;
  const controls=document.getElementById('evidence-controls'),rail=document.getElementById('evidence-rail');
  const query=document.getElementById('evidence-query'),kind=document.getElementById('evidence-kind');
  const status=document.getElementById('evidence-status'),warning=document.getElementById('evidence-route-warning');
  const panels=Array.from(root.querySelectorAll('[data-evidence-detail]'));
  const buttons=Array.from(root.querySelectorAll('[data-evidence-select]'));
  let selected='',routeBlocked=false;
  function choose(id,push=false) {
    selected=id;
    for(const panel of panels) panel.hidden=panel.dataset.evidenceDetail!==id;
    for(const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.evidenceSelect===id));
    if(push) {
      const url=new URL(location.href);
      url.searchParams.set('relationship',id); url.searchParams.set('map',root.dataset.modelId);url.hash='evidence-inspector';
      history.pushState(null,'',url.pathname+url.search+url.hash);
    }
  }
  function filter(push=false) {
    if(routeBlocked) return;
    const terms=query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches=panels.filter(p=>(!kind.value||p.dataset.kind===kind.value)&&terms.every(t=>p.dataset.search.includes(t)));
    for(const button of buttons) button.hidden=!matches.some(p=>p.dataset.evidenceDetail===button.dataset.evidenceSelect);
    const next=matches.some(p=>p.dataset.evidenceDetail===selected)?selected:matches[0]?.dataset.evidenceDetail||'';
    choose(next,push && next!==selected);
    status.textContent=matches.length?`${matches.length} connections found. Select one to inspect its evidence.`:'No connections match. Try another term or clear the filters.';
  }
  function route() {
    const params=new URL(location.href).searchParams,id=params.get('relationship'),edition=params.get('map');
    routeBlocked=Boolean((edition&&edition!==root.dataset.modelId)||(id&&!panels.some(p=>p.dataset.evidenceDetail===id)));
    warning.hidden=!routeBlocked;
    controls.hidden=routeBlocked;rail.hidden=routeBlocked;
    if(routeBlocked) {
      choose('');warning.textContent=edition&&edition!==root.dataset.modelId?'This link refers to a different map edition. Its evidence has not been replaced with this edition.':'This relationship is not available in this map edition.';
      const current=document.createElement('a');current.href='/mappings#evidence-inspector';current.textContent=' Open the available map.';warning.append(current);return;
    }
    query.value='';kind.value='';selected=id||'';filter();
  }
  for(const button of buttons) button.addEventListener('click',()=>choose(button.dataset.evidenceSelect,true));
  query.addEventListener('input',()=>filter(true));kind.addEventListener('change',()=>filter(true));
  document.getElementById('evidence-clear').addEventListener('click',()=>{query.value='';kind.value='';filter(true);query.focus();});
  addEventListener('popstate',route);
  route();
})();
