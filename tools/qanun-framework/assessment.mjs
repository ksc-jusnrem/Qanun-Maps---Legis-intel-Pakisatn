// Shared by browser and connector; deliberately cannot turn checkboxes into a legal verdict.
export function assessRule(rule, facts={}) {
  if(!rule || !Array.isArray(rule.conditions))throw Error('Unknown rule');
  if(!facts || typeof facts!=='object' || Array.isArray(facts))throw Error('Facts must be an object');
  const ids=new Set(rule.conditions.map(c=>c.id));
  for(const id of Object.keys(facts))if(!ids.has(id))throw Error('Unknown condition: '+id);
  const conditions=rule.conditions.map(c=>{
    const fact=facts[c.id];
    if(fact!==undefined && (!fact || typeof fact!=='object' || !['supported','contradicted','disputed','unknown'].includes(fact.status)))throw Error('Invalid fact status');
    if(fact && (Array.isArray(fact)||Object.keys(fact).some(k=>!['status','evidence'].includes(k))||(fact.evidence!==undefined&&typeof fact.evidence!=='string')))throw Error('Invalid fact evidence');
    const supplied=fact?.status||'unknown';
    const evidence=typeof fact?.evidence==='string'?fact.evidence.trim():'';
    if(evidence.length>2000)throw Error('Evidence note too long');
    const status=['supported','contradicted'].includes(supplied)&&!evidence?'unknown':supplied;
    return {id:c.id,label:c.label,status,evidence,verification:'user-supplied; not independently checked',reason:status==='unknown'?'Evidence is missing or insufficiently identified':status==='disputed'?'Factual dispute requires review':'Evidence reference recorded; substance not verified'};
  });
  return {rule_id:rule.id,version_id:rule.version_id,outcome:'UNDETERMINED',conditions,
    missing:conditions.filter(c=>c.status==='unknown').map(c=>c.id),
    disputed:conditions.filter(c=>c.status==='disputed').map(c=>c.id),
    contradicted:conditions.filter(c=>c.status==='contradicted').map(c=>c.id),
    reasons:['This checklist is not a complete encoded legal test','Jurisdiction, applicable dates, exceptions and subsequent judicial treatment require review','Recorded factual support does not establish a legal outcome'],evidence_ids:rule.evidence_ids};
}
