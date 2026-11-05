(() => {
  // Preserve links to the catalogue that used to live on the homepage.
  const params=new URLSearchParams(location.search);
  const keys=['q','jur','year','instrument','kind','shown','record'];
  const legacyHash=location.hash==='#catalogue'||/^#(?:pk|punjab|kp|balochistan)-code-[a-z0-9-]+$/.test(location.hash);
  if(legacyHash||keys.some(key=>params.has(key))){
    const safe=new URLSearchParams();for(const key of keys)if(params.has(key))safe.set(key,params.get(key));
    location.replace('/legislation'+(safe.size?'?'+safe.toString():'')+(legacyHash?location.hash:'#catalogue'));
  }
})();
