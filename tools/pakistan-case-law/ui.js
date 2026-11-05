(()=>{
  'use strict';
  const $=id=>document.getElementById(id),form=$('pcl-search');
  let busy=false,selected=null;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const field=name=>form.elements.namedItem(name);
  const button=(label,fn)=>{const b=node('button',label,'secondary');b.type='button';b.addEventListener('click',fn);return b;};
  const sourceLink=(id,label='Open judgment source ↗')=>{const a=node('a',label);a.href='https://pakistancaselaw.com/case/'+id;a.target='_blank';a.rel='noopener noreferrer';return a;};
  const isId=id=>/^[1-9]\d{0,7}$/.test(String(id));
  function modeChanged(){
    const mode=field('mode').value,citation=mode==='citation',landmark=mode==='landmarks';
    field('query').disabled=landmark||busy;field('query').required=mode==='questions'||citation;
    field('query').maxLength=citation?160:500;
    $('pcl-query-label').textContent=citation?'Complete citation':mode==='questions'?'Legal question':'Keywords';
    field('query').placeholder=citation?'e.g. 2024 SCMR 117':mode==='questions'?'e.g. territorial jurisdiction provincial sales tax':'e.g. Punjab sales tax services jurisdiction';
    $('pcl-filters').hidden=citation||landmark;
    for(const name of ['court','judge','year_from','year_to','author','journal','sort'])field(name).disabled=busy||citation||landmark||(mode==='questions'&&['author','journal','sort'].includes(name));
    $('pcl-mode-note').textContent=mode==='questions'?'Question search covers only judgments with prepared questions. If it finds nothing, try Words in judgments.':citation?'Use the reported year, journal, court (where needed) and page number.':landmark?'Ranked by citations within the provider’s corpus. Citation frequency does not establish current legal authority.':'Combine the legal point with the statute, institution or facts. Refine and rephrase to find other relevant decisions.';
  }
  function setBusy(value){busy=value;for(const b of document.querySelectorAll('.pcl-page button,.pcl-page select'))b.disabled=value;modeChanged();}
  async function request(action,args,status){
    if(busy)return null;
    status.dataset.error='false';status.textContent='Searching Pakistan Case Law…';setBusy(true);
    try{
      const response=await fetch('/api/case-law',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,arguments:args}),signal:AbortSignal.timeout(35000),cache:'no-store',credentials:'same-origin'});
      let body;try{body=await response.json();}catch{throw Error('The research service returned an unreadable response. Please try again.');}
      if(!response.ok){const retry=Number(response.headers.get('retry-after'));throw Error((body.error||'Research is temporarily unavailable.')+(Number.isFinite(retry)&&retry>0?' Retry after '+retry+' seconds.':''));}
      if(!body.data || typeof body.data!=='object')throw Error('No research data was returned.');
      status.textContent='Retrieved from Pakistan Case Law · '+new Date(body.retrieved_at).toLocaleString();
      return body.data;
    }catch(error){status.dataset.error='true';status.textContent=(error.name==='TimeoutError'?'The request timed out. Please try again.':error.message)+' Any earlier results remain from the previous successful request.';return null;}
    finally{setBusy(false);}
  }
  function searchArgs(){
    const mode=field('mode').value,args={};
    if(mode==='citation')args.journal=field('query').value.trim();
    else if(mode!=='landmarks'){
      for(const name of ['query','court','judge','author','journal','year_from','year_to','sort']){
        const el=field(name);if(el.disabled||!el.value.trim())continue;
        args[name]=name.startsWith('year')?Number(el.value):el.value.trim();
      }
    }
    return {action:mode,args};
  }
  function cards(data,target){
    const items=Array.isArray(data.items)?data.items:[];
    for(const c of items){
      if(!isId(c.id))continue;
      const article=node('article',null,'pcl-card');
      article.append(node('div',c.citation||'Citation not supplied','pcl-badge'),node('h3',c.title||'Judgment '+c.id));
      article.append(node('p',[c.court,c.year,c.author?'Author: '+c.author:null,c.bench_size?'Bench: '+c.bench_size:null].filter(Boolean).join(' · '),'pcl-meta'));
      article.append(node('p','Outcome: '+(c.result||'Not supplied by the provider'),'pcl-meta'));
      if(c.snippet)article.append(node('blockquote',c.snippet));
      if(c.question)article.append(node('p',c.question,'pcl-copy'));
      if(Array.isArray(c.questions))for(const q of c.questions)article.append(node('p',q,'pcl-copy'));
      const actions=node('div',null,'pcl-actions');actions.append(button('Read judgment',()=>selectCase(c)),sourceLink(c.id));article.append(actions);target.append(article);
    }
    return items.length;
  }
  function pages(data,args,target,run){
    target.replaceChildren();const offset=args.offset||0;
    if(offset>0)target.append(button('Previous results',()=>run({...args,offset:Math.max(0,offset-10)})));
    if(data.has_more){const next=Number(data.next_offset);if(Number.isInteger(next)&&next>offset&&next<=200)target.append(button('Next results',()=>run({...args,offset:next})));else target.append(node('p','Refine your search to explore further results.','pcl-small'));}
  }
  async function search(action,args){
    const data=await request(action,args,$('pcl-status'));if(!data)return;
    $('pcl-results').replaceChildren();$('pcl-coverage').hidden=!data.coverage_note;
    $('pcl-coverage').textContent=data.coverage_note||'';
    const count=cards(data,$('pcl-results'));
    if(count){const line=node('p',Number.isFinite(data.total)?data.total.toLocaleString()+' matching records · showing '+((args.offset||0)+1)+'–'+((args.offset||0)+count):count+' records returned','pcl-meta');$('pcl-results').prepend(line);}
    else{$('pcl-results').append(node('p',action==='questions'?'No prepared questions matched. Relevant judgments may still exist.':'No judgments matched this request. Try fewer words, another citation or broader filters.','pcl-notice'));if(action==='questions')$('pcl-results').append(button('Search words in judgments',()=>{field('mode').value='search';modeChanged();const next={...args};delete next.offset;search('search',next);}));}
    pages(data,args,$('pcl-pages'),next=>search(action,next));
  }
  function valueBlock(value,target,depth=0){
    if(value===null||value===undefined||depth>8)return;
    if(typeof value==='string'||typeof value==='number'||typeof value==='boolean'){target.append(node('p',value,'pcl-copy'));return;}
    if(Array.isArray(value)){const list=node('ul');for(const item of value){const li=node('li');valueBlock(item,li,depth+1);list.append(li);}target.append(list);return;}
    if(typeof value==='object')for(const [key,v] of Object.entries(value)){target.append(node('h4',key.replaceAll('_',' ')));valueBlock(v,target,depth+1);}
  }
  function renderReading(data,target){
    const omit=new Set(['id','title','citation','court','year','url','result','author','judges','date','case_no','body_chars_total','body_truncated','next_start']);
    if(data.headnote){target.append(node('h3','Provider headnote'),node('p','A research aid prepared from the judgment; verify against the court’s text.','pcl-small'));valueBlock(data.headnote,target);}
    else if(!data.body_text&&!data.text&&!data.judgment&&!data.paragraphs&&!data.outline&&!data.matches)target.append(node('p','A headnote may not be available for this judgment. Use Judgment text or open the source.','pcl-small'));
    for(const [key,value] of Object.entries(data))if(!omit.has(key)&&key!=='headnote'){target.append(node('h4',key==='body_text'?'Judgment text':key.replaceAll('_',' ')));valueBlock(value,target);}
    if(data.body_truncated)target.append(node('p','More text follows. Continue from the character position supplied below, use the paragraph controls, or open the complete source.','pcl-notice'));
    if(Number.isSafeInteger(data.next_start)&&data.next_start>0)target.append(button('Read next part',()=>readCase('full',{start:data.next_start})));
  }
  function detailControls(){
    const controls=$('pcl-detail-controls');controls.replaceChildren();
    const row=node('div',null,'pcl-actions');
    row.append(button('Headnote',()=>readCase('summary')),button('Judgment text',()=>readCase('full')),button('Paragraph outline',()=>readCase('outline')),button('Authorities cited',()=>graph('citations',{})),button('Later citing cases',()=>graph('cited_by',{})));controls.append(row);
    const f=node('form');const wrap=node('div',null,'pcl-grid');
    const pl=node('label','Paragraphs');const p=node('input');p.name='paras';p.placeholder='41-55, 2:3-5 or notes';p.maxLength=160;pl.append(p);
    const fl=node('label','Words within this judgment');const find=node('input');find.name='find';find.placeholder='e.g. jurisdiction';find.maxLength=160;fl.append(find);
    const sl=node('label','Continue from character');const start=node('input');start.name='start';start.type='number';start.min=0;start.max=2000000;start.placeholder='Position supplied by provider';sl.append(start);
    wrap.append(pl,fl,sl);f.append(wrap);const go=node('button','Read selected passage','secondary');go.type='submit';const actions=node('div',null,'pcl-actions');actions.append(go);f.append(actions);
    f.addEventListener('submit',event=>{event.preventDefault();if(busy)return;const args={};if(p.value.trim())args.paras=p.value.trim();else if(find.value.trim())args.find=find.value.trim();else if(start.value!=='')args.start=Number(start.value);else{$('pcl-detail-status').textContent='Enter a paragraph range, words to find, or a character position.';return;}readCase('full',args);});controls.append(f);
  }
  async function selectCase(c){
    if(busy)return;selected=c;$('pcl-detail').hidden=false;
    const heading=$('pcl-detail-heading');heading.replaceChildren(node('div',c.citation||'Citation not supplied','pcl-badge'),node('h2',c.title||'Judgment '+c.id),node('p',[c.court,c.year].filter(Boolean).join(' · '),'pcl-meta'),node('p','Outcome: '+(c.result||'Not supplied by the provider'),'pcl-meta'),sourceLink(c.id));
    $('pcl-detail-body').replaceChildren();$('pcl-detail-pages').replaceChildren();detailControls();$('pcl-detail').focus();await readCase('summary');
  }
  async function readCase(section,extra={}){
    if(!selected)return;const id=Number(selected.id);const data=await request('case',{case_id:id,section,...extra},$('pcl-detail-status'));if(!data)return;
    $('pcl-detail-body').replaceChildren();$('pcl-detail-pages').replaceChildren();renderReading(data,$('pcl-detail-body'));
  }
  async function graph(action,args){
    if(!selected)return;const base={case_id:Number(selected.id),...args};const data=await request(action,base,$('pcl-detail-status'));if(!data)return;
    const area=$('pcl-detail-body');area.replaceChildren(node('h3',action==='citations'?'Authorities cited by this judgment':'Later cases citing this judgment'));
    if(!cards(data,area))area.append(node('p','No linked cases were returned from this corpus. This does not establish that none exist.','pcl-notice'));
    pages(data,base,$('pcl-detail-pages'),next=>graph(action,next));
  }
  field('mode').addEventListener('change',modeChanged);
  form.addEventListener('submit',event=>{event.preventDefault();if(busy)return;const {action,args}=searchArgs();const params=new URLSearchParams(location.search);if(field('query').value.trim())params.set('q',field('query').value.trim());else params.delete('q');history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));search(action,args);});
  form.addEventListener('reset',()=>{if(busy)return;queueMicrotask(()=>{$('pcl-results').replaceChildren();$('pcl-pages').replaceChildren();$('pcl-detail').hidden=true;$('pcl-coverage').hidden=true;$('pcl-status').textContent='Enter a search to begin.';$('pcl-status').dataset.error='false';modeChanged();});});
  const params=new URLSearchParams(location.search);field('query').value=(params.get('q')||'').slice(0,500);
  const law=params.get('law');if(law&&/^[a-z0-9-]{1,100}$/.test(law)){const c=$('pcl-context');c.hidden=false;c.append(node('span','Research starting point: '+field('query').value+'. '));const a=node('a','Return to this legislation');a.href='/laws/'+law;c.append(a,node('span','. A title search identifies possible connections; confirm the exact provision and version in the judgment.'));}
  modeChanged();
})();
