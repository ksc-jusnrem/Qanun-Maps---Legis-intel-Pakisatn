import fs from 'node:fs';
import path from 'node:path';
import {loadEvidenceModel,digest,exactExcerpt} from '../qanun-release/evidence-model.mjs';

// Original research checklists. These are not executable statements of current law.
const definitions = [
  ['mustafa-rule16-invalidity','invalidates','Historical constitutional invalidity finding',['The comparison concerns the version of Rule 16(2) considered by the Court'],['Later omission or amendment must be assessed separately']],
  ['mustafa-rule16','interprets','Cabinet consideration of specified tax proposals',['The matter concerns a tax proposal within the quoted Rule 16(1)(d)','The institutional decision-making context matches the cited passage'],['Read the Prime Minister disposal-power qualification with the Cabinet requirement']],
  ['farrukh-rule4-6','upholds','Appointment rule upheld with limits on status and powers',['The issue concerns appointment under Rule 4(6)','Appointment status is distinguished from Cabinet membership and exercise of executive powers'],['The challenged committee appointments were separately set aside']],
  ['haji-rehman-','interprets','Cognizability in the police-misconduct prosecution',['The alleged offence falls within the Article 155 provision discussed','The relevant punishment and CrPC classification have been identified'],['Article 155 of the Police Order is distinct from section 155 CrPC','Territorial and later amendment applicability require separate review']],
  ['shahjehan-','applies','Fact-specific assessment of the alleged sale and forensic evidence',['The prosecution concerns the sale provision discussed','Evidence of sale and the forensic record are available for review'],['The acquittal did not invalidate Article 3','Other facts or offences may require a different analysis']],
  ['awais-','applies','Adverse inference considered in its evidentiary context',['The item of evidence allegedly withheld or not produced is identified','The surrounding evidentiary circumstances are available for review'],['Non-production of an exhibit does not automatically require acquittal','The Court also considered weight and packaging doubts']]
];

export function buildFramework(output) {
  const evidence=loadEvidenceModel(output);
  const source=JSON.parse(fs.readFileSync(new URL('../qanun-release/rule-case-mappings.json',import.meta.url),'utf8'));
  const documents=new Map(evidence.documents.map(d=>[d.id,d]));
  const rules=source.links.map(link=>{
    const def=definitions.find(d=>link.id.startsWith(d[0]));
    if(!def)throw Error('Unclassified relationship '+link.id);
    const inventory=source.inventory.find(i=>i.id===link.law_id);
    const record=JSON.parse(fs.readFileSync(path.join(output,'laws',link.law_id+'.json'),'utf8'));
    const a=inventory.authority_evidence;
    if(!a || a.text_version_id!==record.text_version_id || a.text_sha256!==record.text_sha256)throw Error('Authority version mismatch');
    const authorityHash=exactExcerpt(record.text,a.character_start,a.character_end,a.quote);
    const relationship=evidence.relationships.find(r=>r.id==='case-'+link.id);
    return {
      id:'rule-'+link.id,stable_id_status:'source-bound research proposition; not a canonical rule identity',
      instrument_id:link.law_id,instrument_title:documents.get(link.law_id).title,provision:link.provision,
      version_id:link.law_evidence.text_version_id,source_url:inventory.source_url,
      authority:{note:inventory.authority_note,evidence:{...a,quote_sha256:authorityHash},status:'recital recorded; enabling instrument not independently established here'},
      scope:{jurisdiction:null,persons:null,activities:null,status:'not independently checked'},
      conditions:def[3].map((label,i)=>({id:'condition-'+(i+1),label,kind:'research_checklist',derivation:'Editorial checklist based on the mapped passage; not a complete legal test',evidence_ids:relationship.evidence_ids})),
      legal_effect:{label:def[2],proposition:link.summary,mode:'historical judgment proposition; not an automatic outcome'},
      qualifications:[...def[4],link.version_note],
      time:{commencement:null,effective_from:null,effective_to:null,repeal:null,current_force:null,status:'not established'},
      case_relationships:[{relationship_id:relationship.id,case_id:link.case_id,type:def[1],binding_status:'not assessed',subsequent_treatment:'not comprehensively checked'}],
      evidence_ids:relationship.evidence_ids,
      review:{relationship:'reviewed passage inherited',structured_rule:'awaiting legal review',conditions:'editorial research checklist',current_applicability:'not checked',review_date:source.review_date},
      rights:{original_structure:'Original Qanun Maps implementation and editorial structure',underlying_sources:'Third-party rights retained; no ownership asserted',clearance:'not independently checked',commercial_reuse:'not established by this record'}
    };
  });
  const coverage=source.inventory.filter(i=>i.kind==='rules_or_order').map(i=>({instrument_id:i.id,title:i.title,rule_ids:rules.filter(r=>r.instrument_id===i.id).map(r=>r.id),status:i.case_links.length?'reviewed passage linked':'unresolved: no reviewed case passage',current_force:null}));
  const core={schema:'qanun-rules/1',evidence_model_id:evidence.model_id,rules,coverage,evidence,limitations:['Held-corpus research scope only','No current-applicability or binding-precedent determination','Structured propositions and checklists require separate legal review']};
  return {...core,model_id:digest(JSON.stringify(core))};
}
