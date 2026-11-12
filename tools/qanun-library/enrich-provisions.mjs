import crypto from 'node:crypto';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const key=s=>String(s).toLowerCase().replace(/s$/,'');
export function enrichProvisionTargets(graph,records,provisionsByRecord){
 const byId=new Map(records.map(r=>[r.id,r]));let internal=0,external=0;
 const pointCache=new Map();
 const characters=record=>{if(pointCache.has(record.id))return pointCache.get(record.id);const points=Array.from(record.text);if(pointCache.size>=8)pointCache.delete(pointCache.keys().next().value);pointCache.set(record.id,points);return points;};
 const attach=ref=>{
  if(ref.resolution!=='operative_heading_not_identified'||!ref.target)return false;
  const record=byId.get(ref.target);if(!record||/\b(?:amendment|repealing)\b/i.test(record.title))return false;
  const candidates=(provisionsByRecord.get(record.id)||[]).filter(p=>p.scope==='main'&&key(p.kind)===key(ref.provision_kind)&&p.number===ref.provision_number);
  if(candidates.length!==1)return false;const p=candidates[0],points=characters(record);
  if(!Number.isSafeInteger(p.character_start)||!Number.isSafeInteger(p.character_end)||p.character_start<0||p.character_end<=p.character_start||p.character_end>points.length)return false;
  const end=Math.min(p.character_end,p.character_start+320),quote=points.slice(p.character_start,end).join('');
  const fragment=record.passages.find(x=>x.character_start<=p.character_start&&x.character_end>p.character_start)?.reader_fragment;if(!fragment)return false;
  ref.target_evidence={record_id:record.id,text_version_id:record.text_version_id,text_sha256:record.text_sha256,character_start:p.character_start,character_end:end,quote,quote_sha256:sha(quote),reader_fragment:fragment,reader_url:'/laws/'+record.id+'#'+fragment,source_url:record.source_url||null};
  ref.target_fragment=p.anchor;ref.resolution='matched_operative_heading';ref.resolution_scope='numbered_heading_only';ref.target_identification='unique_main_heading_in_source_based_reader';return true;
 };
 for(const ref of graph.internal_references)if(attach(ref))internal++;
 for(const ref of graph.external_references||[])if(attach(ref))external++;
 const resolvedInternal=new Set(graph.internal_references.filter(r=>r.target_fragment).map(r=>r.id));
 const newlyResolved=new Set([...graph.internal_references,...(graph.external_references||[])].filter(r=>r.target_identification==='unique_main_heading_in_source_based_reader').map(r=>r.id));
 for(const c of Object.values(graph.coverage)){c.resolved_internal=c.internal.filter(id=>resolvedInternal.has(id)).length;c.unresolved=c.unresolved.filter(id=>!newlyResolved.has(id));}
 graph.statistics.resolved_internal_references=graph.internal_references.filter(r=>r.target_fragment).length;
 graph.statistics.resolved_external_provision_headings=(graph.external_references||[]).filter(r=>r.target_fragment).length;
 graph.statistics.unresolved_external_references=(graph.external_references||[]).filter(r=>!r.target_fragment).length;
 graph.parent_reader_enrichment={internal_targets_added:internal,external_targets_added:external,scope:'Unique main-scope source headings only; ambiguous editions, duplicated headings and amending-instrument quotations remain unresolved.'};
 return graph.parent_reader_enrichment;
}
