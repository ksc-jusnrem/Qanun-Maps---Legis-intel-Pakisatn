'use strict';
(function(){
 const link=document.getElementById('catalogue-return');
 const requested=new URLSearchParams(location.search).get('return');
 if(requested){try{const u=new URL(requested,location.origin);const allowed=['q','jur','year','instrument','kind','shown','record'];if(u.origin===location.origin&&u.pathname==='/'&&[...u.searchParams.keys()].every(k=>allowed.includes(k))&&/^#(?:catalogue|[a-zA-Z0-9_-]+)$/.test(u.hash)){link.href=u.pathname+u.search+u.hash;link.textContent='Back to your search';}}catch{}}
})();
