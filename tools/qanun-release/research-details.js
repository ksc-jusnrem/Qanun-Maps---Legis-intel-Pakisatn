(() => {
  function revealResearchAnchor(){
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const target=document.getElementById(id);if(!target)return;
    let parent=target.closest('details.research-drawer');
    while(parent){parent.open=true;parent=parent.parentElement?.closest('details.research-drawer');}
  }
  addEventListener('hashchange',revealResearchAnchor);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',revealResearchAnchor,{once:true});
  else revealResearchAnchor();
})();
