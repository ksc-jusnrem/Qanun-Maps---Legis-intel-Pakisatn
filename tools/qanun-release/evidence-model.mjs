import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {publicNotes} from './mapping-panels.mjs';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw Error(message); };
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9:_-]*$/.test(value);
export function sourceUrl(value) {
  const url = new URL(value);
  requireThat(url.protocol === 'https:' && !url.username && !url.password, 'Unsafe source URL');
  return url.href;
}
export function exactExcerpt(text, start, end, quote) {
  const points = Array.from(text);
  requireThat(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end > start && end <= points.length, 'Invalid excerpt bounds');
  requireThat(points.slice(start, end).join('') === quote, 'Excerpt differs from held text');
  return digest(quote);
}

// The public projection is an explicit allowlist. Raw discovery and manuscript records never enter it.
export function buildEvidenceModel({statutes, cases, readLaw}) {
  const documents = new Map(), versions = new Map(), excerpts = new Map(), relationships = [], records = new Map();
  const insert = (map, value) => { requireThat(safeId(value.id) && !map.has(value.id), 'Duplicate or invalid identity: ' + value.id); map.set(value.id, value); };
  function law(id) {
    requireThat(safeId(id) && !id.includes(':'), 'Invalid law identity');
    if (records.has(id)) return records.get(id);
    const {record:r, raw} = readLaw(id);
    requireThat(r.id === id, 'Record identity mismatch');
    requireThat(raw.equals(Buffer.from(r.text, 'utf8')) && digest(raw) === r.text_sha256, 'Held text hash mismatch');
    requireThat(r.text_version_id === `law:${id}:sha256:${r.text_sha256}`, 'Version identity mismatch');
    records.set(id, r); return r;
  }
  function addLaw(id, title, url, version, hash, snapshot = null) {
    const r = law(id);
    requireThat(r.text_version_id === version && r.text_sha256 === hash, 'Source version mismatch');
    if (!documents.has(id)) {
      insert(documents, {id, kind:'legislation', title, source_collection:r.source_collection, source_url:sourceUrl(url), reader_url:`/laws/${id}`, identity_status:'separate source record'});
      insert(versions, {id:version, document_id:id, text_sha256:hash, snapshot_as_supplied:snapshot, effective_at:null, full_text_check:'exact held text and download bytes'});
    } else requireThat(versions.get(version)?.document_id === id, 'Conflicting source version');
    return r;
  }
  function addLawExcerpt(id, e, recordId) {
    const r = law(recordId);
    requireThat(r.text_version_id === e.text_version_id && r.text_sha256 === e.text_sha256, 'Excerpt version mismatch');
    const excerptHash = exactExcerpt(r.text,e.character_start,e.character_end,e.quote);
    requireThat(e.passages?.length > 0, 'Missing passage anchor');
    const anchors = e.passages.map(p => {
      const held = r.passages.find(x => p.fragment ? x.reader_fragment === p.fragment : x.passage_id === p.passage_id);
      requireThat(held && held.passage_sha256 === (p.sha256 || p.passage_sha256), 'Passage identity mismatch');
      requireThat(exactExcerpt(r.text,held.character_start,held.character_end,Array.from(r.text).slice(held.character_start,held.character_end).join('')) === held.passage_sha256, 'Passage hash mismatch');
      requireThat(held.character_start < e.character_end && held.character_end > e.character_start, 'Passage does not overlap excerpt');
      requireThat(/^[a-z0-9-]+$/.test(held.reader_fragment), 'Invalid reader fragment');
      if (p.reader_url) {
        const url = new URL(p.reader_url);
        requireThat(url.origin === 'https://www.jusnrem.legal' && url.pathname === `/laws/${recordId}.html` && url.hash === '#'+held.reader_fragment, 'Wrong passage link');
      }
      return `/laws/${recordId}#${held.reader_fragment}`;
    });
    insert(excerpts,{id, document_id:recordId, version_id:r.text_version_id, quote:e.quote, quote_sha256:excerptHash, start:e.character_start,end:e.character_end,anchors,check:'Exact excerpt matched to held text', full_text_rechecked:true});
  }
  for (const n of statutes.nodes) {
    if (n.node_kind === 'owned_instrument') addLaw(n.id,n.title,n.source_url,n.text_version_id,n.text_sha256,n.source_snapshot);
    else insert(documents,{id:n.id,kind:'unresolved_instrument',title:n.title,source_url:null,reader_url:null,identity_status:'cited instrument; source text not held'});
  }
  for (const [id,e] of Object.entries(statutes.evidence)) addLawExcerpt('statute:'+id,e,e.record_id);
  for (const e of statutes.edges) {
    requireThat(publicNotes[e.id], 'Unreviewed statute relationship');
    const notes = [...publicNotes[e.id], ...(e.qualifications || [])];
    for (const finding of statutes.source_version_findings || []) if ([e.source,e.target].includes(finding.record_id)) {
      notes.push(finding.held_edition ? `Held edition: ${finding.held_edition}. Newer edition observed: ${finding.newer_edition_observed}. They are not interchangeable.` : 'Differing Gazette publication dates remain unresolved; no exact commencement date is assigned.');
    }
    relationships.push({id:e.id,kind:'statute',source:e.source,target:e.target,source_provision:e.source_provision || 'Opening recital',target_provision:e.target_provision,relation:e.relation.replaceAll('_',' '),review:'Supporting provisions checked',review_scope:e.verification_scope,notes,evidence_ids:e.evidence_ids.map(id=>'statute:'+id),effective_at:e.effective_at ?? null});
  }
  const caseIds = new Set();
  for (const c of cases.cases) {
    requireThat(!caseIds.has(c.id), 'Duplicate judgment identity'); caseIds.add(c.id);
    requireThat(/^[a-f0-9]{64}$/.test(c.judgment_text_sha256), 'Invalid judgment text digest');
    const id = 'judgment:'+c.id, version = id+':sha256:'+c.judgment_text_sha256;
    insert(documents,{id,kind:'judgment',title:c.title,source_url:sourceUrl(c.source_url),reader_url:'/case-law#reviewed-'+c.id,identity_status:'reviewed source identity; publisher IDs not merged',court:c.court??null,case_number:c.case_number??null,decision_date:c.decision_date ?? null,date_note:c.date_note,source_note:c.source_note || 'Source hosting and acquisition status not specified in this record',source_id:c.source_id,official_report_url:c.official_report_url ? sourceUrl(c.official_report_url) : null});
    insert(versions,{id:version,document_id:id,text_sha256:c.judgment_text_sha256,snapshot_as_supplied:c.retrieved_on,effective_at:null,full_text_check:'Inherited reviewed transcription; full judgment not rechecked by this build'});
  }
  const inventories = new Map(cases.inventory.map(i=>[i.id,i]));
  requireThat(inventories.size === cases.inventory.length, 'Duplicate inventory identity');
  for (const l of cases.links) {
    const c = cases.cases.find(c=>c.id===l.case_id), n = inventories.get(l.law_id);
    requireThat(c && n && l.law_evidence.law_id === l.law_id && c.links.includes(l.id) && n.case_links.includes(l.id), 'Unresolved case relationship');
    addLaw(n.id,n.title,n.source_url,n.text_version_id,n.text_sha256);
    const lawEvidenceId = 'case-law:'+l.id, judgmentEvidenceId = 'case-quote:'+l.id, e=l.judgment_evidence;
    addLawExcerpt(lawEvidenceId,l.law_evidence,l.law_id);
    requireThat(Number.isSafeInteger(e.character_start) && e.character_start >= 0 && e.character_end-e.character_start === Array.from(e.quote).length && digest(e.quote) === e.sha256, 'Judgment excerpt digest or range mismatch');
    insert(excerpts,{id:judgmentEvidenceId,document_id:'judgment:'+c.id,version_id:'judgment:'+c.id+':sha256:'+c.judgment_text_sha256,quote:e.quote,quote_sha256:e.sha256,start:e.character_start,end:e.character_end,anchors:[sourceUrl(c.source_url)],pinpoint:l.judgment_pinpoint,check:'Previously reviewed passage; excerpt digest checked in this build',full_text_rechecked:false});
    relationships.push({id:'case-'+l.id,kind:'case',source:'judgment:'+c.id,target:l.law_id,source_provision:l.judgment_pinpoint,target_provision:l.provision,relation:l.relationship,review:'Reviewed judgment passage',review_scope:l.summary,notes:[l.version_note,c.subsequent_treatment,c.date_note],evidence_ids:[judgmentEvidenceId,lawEvidenceId],effective_at:null});
  }
  requireThat(new Set(relationships.map(e=>e.id)).size===relationships.length,'Duplicate relationship identity');
  for (const e of relationships) {
    requireThat(safeId(e.id) && documents.has(e.source) && documents.has(e.target),'Unresolved relationship endpoint');
    requireThat(e.evidence_ids.length && new Set(e.evidence_ids).size===e.evidence_ids.length,'Missing or duplicate evidence');
    for(const id of e.evidence_ids) requireThat(excerpts.has(id) && [e.source,e.target].includes(excerpts.get(id).document_id),'Evidence unrelated to endpoints');
    requireThat(e.effective_at===null,'Effective dates require separate temporal review');
  }
  const core={schema:'qanun-evidence/1',documents:[...documents.values()],versions:[...versions.values()],excerpts:[...excerpts.values()],relationships};
  return {...core,model_id:digest(JSON.stringify(core))};
}

export function loadEvidenceModel(output) {
  const read = name => JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
  return buildEvidenceModel({statutes:read('./statute-rule-mappings.json'),cases:read('./rule-case-mappings.json'),readLaw:id=>({record:JSON.parse(fs.readFileSync(path.join(output,'laws',id+'.json'),'utf8')),raw:fs.readFileSync(path.join(output,'laws',id+'.txt'))})});
}
