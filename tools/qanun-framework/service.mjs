import fs from 'node:fs';
import path from 'node:path';
import {digest,exactExcerpt} from '../qanun-release/evidence-model.mjs';
import {buildFramework} from './model.mjs';
import {displayRecordTitle} from '../qanun-library/record-display.mjs';
import {createLawVersionStore} from '../qanun-library/version-store.mjs';
import {assessRule} from './assessment.mjs';

const str={type:'string',minLength:1,maxLength:200};
const schema=(properties,required)=>({type:'object',properties,required,additionalProperties:false});
export const toolDefinitions=[
  ['find_legislation','Search held legislation titles, with current reading and preserved earlier text versions. Does not establish current force.',schema({query:str},['query'])],
  ['find_provisions','Search draft section headings from the supplied archive. Unsigned and not verified against AKN.',schema({query:str,instrument_id:str},['query'])],
  ['get_provision','Retrieve an exact passage from the requested current or preserved earlier text version.',schema({instrument_id:str,version_id:{type:'string',maxLength:200},fragment:str},['instrument_id','version_id','fragment'])],
  ['find_cases','Get reviewed passage relationships for a held instrument; excludes discovery-only records.',schema({instrument_id:str},['instrument_id'])],
  ['get_rule','Get a structured research proposition, review limits and evidence references.',schema({rule_id:str},['rule_id'])],
  ['get_mapping_evidence','Get the exact passages supporting a reviewed relationship.',schema({relationship_id:str},['relationship_id'])],
  ['compare_versions','Compare two held versions of the same source record; do not merge publisher records.',schema({instrument_id:str,from_version:str,to_version:str},['instrument_id','from_version','to_version'])],
  ['coverage_gaps','Report held-corpus rule coverage and unresolved evidence.',schema({},[])],
  ['assess_rule','Record user-supplied fact evidence against a research checklist. Always undetermined as a legal outcome.',schema({rule_id:str,facts:{type:'object',additionalProperties:{type:'object',properties:{status:{enum:['supported','contradicted','disputed','unknown']},evidence:{type:'string',maxLength:2000}},required:['status'],additionalProperties:false}}},['rule_id','facts'])]
].map(([name,description,inputSchema])=>({name,description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));

export function createService(output) {
  const model=buildFramework(output); let catalogue;
  const versionStore=createLawVersionStore(output);
  const readLaw=(id,version)=>versionStore.read(id,version);
  let sourceAudit;
  function sourceInfo(record){
    if(sourceAudit===undefined){const file=path.join(output,'data/source-verification.json');sourceAudit=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;}
    const row=sourceAudit?.records?.[record.id];if(!row)return{comparison_status:'source_register_not_supplied',current_force:'not_checked'};
    const facsimile=row.comparison_status==='original_facsimile_complete';
    const earlier=Boolean(row.comparison?.corrected_reading_text_sha256&&row.comparison.corrected_reading_text_sha256!==record.text_sha256);
    return{comparison_status:facsimile?'archived_transcription_not_certified':earlier?'earlier_extraction_not_current_reading':row.comparison_status,primary_reading_representation:facsimile?'original_page_images':'source_transcription',original_pdf_sha256:row.original?.sha256||null,current_force:'not_checked',scope:facsimile?'The statutory body is supplied as original page images. This machine passage comes from the separately archived transcription and is not certified against that body.':earlier?'The requested earlier extraction is preserved separately from the source-restored reading edition.':'Source comparison status applies to the identified transcription edition; legal effect and current consolidation are separate.'};
  }
  function call(name,args={}) {
    const def=toolDefinitions.find(t=>t.name===name);if(!def)throw Error('Unknown tool');
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid arguments');
    for(const key of Object.keys(args))if(!Object.hasOwn(def.inputSchema.properties,key))throw Error('Unknown argument '+key);
    for(const key of def.inputSchema.required)if(!Object.hasOwn(args,key))throw Error('Missing argument '+key);
    for(const [key,value] of Object.entries(args))if(key!=='facts'&&(typeof value!=='string'||!value.trim()||value.length>200))throw Error('Invalid argument '+key);
    let data;
    if(name==='find_legislation') {
      catalogue??=fs.readdirSync(path.join(output,'laws')).filter(n=>n.endsWith('.json')).map(n=>{const id=n.slice(0,-5),held=versionStore.versions(id),r=held[0];return {id:r.id,title:displayRecordTitle(r),source_comparison:sourceInfo(r),version_id:r.text_version_id,available_versions:held.map(v=>v.text_version_id),reading_record_url:r.reading_provenance?'/reading-records/'+id+'.json':'/laws/'+id+'.json',text_download_url:'/laws/'+id+(r.reading_provenance?'.reader.txt':'.txt'),first_fragment:r.passages?.[0]?.reader_fragment||null,reading_edition:r.reading_provenance?'source-restored reading':'stored source transcription',source_url:r.source_url,reader_url:'/laws/'+r.id,content_kind:r.content_kind,current_force:null};});
      const terms=args.query.toLocaleLowerCase().trim().split(/\s+/);const results=catalogue.filter(r=>terms.every(t=>r.title.toLocaleLowerCase().includes(t)));
      data={matches:results.length,results:results.slice(0,30),truncated:results.length>30,scope:'title search of held reader records'};
    } else if(name==='find_provisions') {
      const source=JSON.parse(fs.readFileSync(new URL('./section-candidates.json',import.meta.url),'utf8'));
      const terms=args.query.toLowerCase().trim().split(/\s+/);
      if(args.instrument_id)readLaw(args.instrument_id);
      const results=source.records.filter(r=>!args.instrument_id||r.id===args.instrument_id).flatMap(r=>r.sections.filter(s=>terms.every(t=>`${r.title} ${s.num} ${s.heading}`.toLowerCase().includes(t))).map(s=>({instrument_id:r.id,title:r.title,...s,status:r.status,source_member:r.source_member,source_sha256:r.source_sha256})));
      data={matches:results.length,results:results.slice(0,30),truncated:results.length>30,provenance:source.provenance};
    } else if(name==='get_provision') {
      const r=readLaw(args.instrument_id,args.version_id);
      if(r.content_kind!=='stored_law_text')throw Error('This record is a source notice, not legislation text');
      const p=r.passages.find(p=>p.reader_fragment===args.fragment);if(!p)throw Error('Passage not held');
      const quote=Array.from(r.text).slice(p.character_start,p.character_end).join('');
      if(exactExcerpt(r.text,p.character_start,p.character_end,quote)!==p.passage_sha256)throw Error('Passage integrity mismatch');
      const points=Array.from(r.text),before=Math.max(0,p.character_start-500),after=Math.min(points.length,p.character_end+500);
      data={instrument_id:r.id,version_id:r.text_version_id,source_comparison:sourceInfo(r),quote,quote_sha256:p.passage_sha256,start:p.character_start,end:p.character_end,reader_url:'/laws/'+r.id+'#'+p.reader_fragment,source_url:r.source_url,current_force:null,
        reading_edition:r.reading_provenance?'Source-restored reading; earlier extraction separately retained':'Stored source transcription; an earlier reading version may be separately retained',content_kind:r.content_kind,content_extent:r.content_extent??null,completeness:'not independently established',offset_convention:'zero-based Unicode code points; end exclusive',
        integrity:'Exact stored text, text version, passage hash and TXT download checked; not legal authenticity or currency',
        context:{before:points.slice(before,p.character_start).join(''),after:points.slice(p.character_end,after).join(''),start:before,end:after,status:'Context review required; surrounding text may omit qualifications elsewhere in the instrument'},
        quotation_status:'Exact stored passage located; legal meaning and contextual sufficiency not verified'};
    } else if(name==='find_cases') {
      readLaw(args.instrument_id);data=model.rules.filter(r=>r.instrument_id===args.instrument_id).flatMap(r=>r.case_relationships).map(rel=>({...rel,judgment:model.evidence.documents.find(d=>d.id==='judgment:'+rel.case_id)}));
    } else if(name==='get_rule'||name==='assess_rule') {
      const r=model.rules.find(r=>r.id===args.rule_id);if(!r)throw Error('Rule not held');data=name==='get_rule'?r:assessRule(r,args.facts);
    } else if(name==='get_mapping_evidence') {
      const r=model.evidence.relationships.find(r=>r.id===args.relationship_id);if(!r)throw Error('Relationship not held');
      data={relationship:r,excerpts:r.evidence_ids.map(id=>model.evidence.excerpts.find(e=>e.id===id))};
    } else if(name==='compare_versions') {
      const held=versionStore.versions(args.instrument_id),available=held.map(r=>r.text_version_id),from=held.find(r=>r.text_version_id===args.from_version),to=held.find(r=>r.text_version_id===args.to_version),same=Boolean(from&&to&&from.text_sha256===to.text_sha256);
      data={status:!from||!to?'COMPARISON_UNAVAILABLE':same?'SAME_HELD_VERSION':'DIFFERENT_HELD_TEXTS',instrument_id:args.instrument_id,available_versions:available,from:from?{version_id:from.text_version_id,text_sha256:from.text_sha256,characters:Array.from(from.text).length}:null,to:to?{version_id:to.text_version_id,text_sha256:to.text_sha256,characters:Array.from(to.text).length}:null,reason:!from||!to?'A requested version is not held; no comparison is inferred':same?'Both references identify identical held bytes':'Distinct source transcription editions are held. A recovered extraction or OCR correction is not evidence that the law itself changed.'};
    } else data={records:model.coverage,unresolved:model.coverage.filter(c=>!c.rule_ids.length),scope:model.limitations};
    return {model_id:model.model_id,schema:model.schema,data,limitations:model.limitations};
  }
  return {model,call};
}
