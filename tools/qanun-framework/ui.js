(() => {
  const cards=[...document.querySelectorAll('[data-rule]')];
  document.querySelector('#rule-controls').hidden=false;
  cards.forEach(c=>c.querySelector('.assessment').hidden=false);
  const search=document.querySelector('#rule-search');
  function filter(){const q=search.value.toLowerCase().trim();let count=0;cards.forEach(c=>{const r=ruleRecords.find(r=>r.id===c.dataset.rule);c.hidden=!`${r.instrument_title} ${r.provision} ${r.legal_effect.proposition}`.toLowerCase().includes(q);if(!c.hidden)count++;});document.querySelector('#rule-count').textContent=`${count} of ${cards.length} research propositions`;}
  search.addEventListener('input',filter);filter();
  document.querySelectorAll('[data-assess]').forEach(button=>button.addEventListener('click',()=>{
    const card=button.closest('[data-rule]'),rule=ruleRecords.find(r=>r.id===button.dataset.assess),facts={};
    rule.conditions.forEach(c=>{facts[c.id]={status:card.querySelector(`[data-condition="${c.id}"]`).value,evidence:card.querySelector(`[data-note="${c.id}"]`).value};});
    const result=assessRule(rule,facts),out=card.querySelector('[data-result]');out.replaceChildren();
    const title=document.createElement('h3');title.textContent='Legal outcome: undetermined';out.append(title);
    const counts=document.createElement('p');counts.textContent=`Missing evidence: ${result.missing.length}. Disputed: ${result.disputed.length}. Contradicted: ${result.contradicted.length}.`;out.append(counts);
    const list=document.createElement('ul');result.conditions.forEach(c=>{const li=document.createElement('li');li.textContent=`${c.label}: ${c.status}. ${c.reason}.`;list.append(li);});out.append(list);
    const note=document.createElement('p');note.textContent=result.reasons.join('. ')+'.';out.append(note);
  }));
  document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>{const card=b.closest('[data-rule]');card.querySelectorAll('select').forEach(s=>s.value='unknown');card.querySelectorAll('textarea').forEach(t=>t.value='');card.querySelector('[data-result]').replaceChildren();}));
  const section=document.querySelector('#rule-gaps');
  const finder=document.createElement('section');finder.id='section-finder';
  const heading=document.createElement('h3');heading.textContent='Search draft section headings';finder.append(heading);
  const label=document.createElement('label');label.htmlFor='section-query';label.textContent='Heading words, section number or instrument title';finder.append(label);
  const input=document.createElement('input');input.id='section-query';input.type='search';input.placeholder='commencement, evidence, police…';input.maxLength=200;finder.append(input);
  const button=document.createElement('button');button.type='button';button.textContent='Search draft headings';finder.append(button);
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');finder.append(status);
  const results=document.createElement('div');finder.append(results);section.append(finder);
  let sections;
  async function find(){
    const query=input.value.trim().toLowerCase();if(!query){status.textContent='Enter heading words or an instrument title.';results.replaceChildren();return;}
    button.disabled=true;status.textContent='Loading the draft inventory…';results.replaceChildren();
    try{
      if(!sections){const response=await fetch('/section-candidates.json');if(!response.ok)throw Error('Unavailable');const data=await response.json();if(!Array.isArray(data.records))throw Error('Invalid inventory');sections=data.records;}
      const terms=query.split(/\s+/);let total=0;
      for(const record of sections)for(const s of record.sections){if(!terms.every(t=>`${record.title} ${s.num} ${s.heading}`.toLowerCase().includes(t)))continue;total++;if(total>30)continue;
        const item=document.createElement('article');item.className='rule-card';const h=document.createElement('h4');h.textContent=`${s.num} — ${s.heading}`;item.append(h);
        const a=document.createElement('a');if(!/^[-a-z0-9]+$/.test(record.id))throw Error('Invalid identity');a.href='/laws/'+record.id;a.textContent=record.title;item.append(a);
        const p=document.createElement('p');p.textContent='Unsigned draft heading. Open the held text to check the provision; this is not a verified section link or legal effect.';item.append(p);results.append(item);
      }
      status.textContent=`${total.toLocaleString()} draft heading matches. Showing ${Math.min(total,30)}. Narrow your search for more specific results.`;
    }catch{status.textContent='The draft inventory could not be loaded. Please try again or use the download link.';}finally{button.disabled=false;}
  }
  button.addEventListener('click',find);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!button.disabled)find();}});
})();
