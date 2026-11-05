import fs from 'node:fs';
import path from 'node:path';
import {digest,exactExcerpt} from '../qanun-release/evidence-model.mjs';
import {buildFramework} from './model.mjs';
import {assessRule} from './assessment.mjs';

const str={type:'string',minLength:1,maxLength:200};
const schema=(properties,required)=>({type:'object',properties,required,additionalProperties:false});
export const toolDefinitions=[
  ['find_legislation','Search held legislation titles. Does not establish current force.',schema({query:str},['query'])],
  ['find_provisions','Search draft section headings from the supplied archive. Unsigned and not verified against AKN.',schema({query:str,instrument_id:str},['query'])],
  ['get_provision','Retrieve a version-bound held passage by source record and fragment.',schema({instrument_id:str,version_id:{type:'string',maxLength:200},fragment:str},['instrument_id','version_id','fragment'])],
  ['find_cases','Get reviewed passage relationships for a held instrument; excludes discovery-only records.',schema({instrument_id:str},['instrument_id'])],
  ['get_rule','Get a structured research proposition, review limits and evidence references.',schema({rule_id:str},['rule_id'])],
  ['get_mapping_evidence','Get the exact passages supporting a reviewed relationship.',schema({relationship_id:str},['relationship_id'])],
  ['compare_versions','Compare two held versions of the same source record; do not merge publisher records.',schema({instrument_id:str,from_version:str,to_version:str},['instrument_id','from_version','to_version'])],
  ['coverage_gaps','Report held-corpus rule coverage and unresolved evidence.',schema({},[])],
  ['assess_rule','Record user-supplied fact evidence against a research checklist. Always undetermined as a legal outcome.',schema({rule_id:str,facts:{type:'object',additionalProperties:{type:'object',properties:{status:{enum:['supported','contradicted','disputed','unknown']},evidence:{type:'string',maxLength:2000}},required:['status'],additionalProperties:false}}},['rule_id','facts'])]
].map(([name,description,inputSchema])=>({name,description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));

export function createService(output) {
  const model=buildFramework(output); let catalogue;
  function readLaw(id) {
    if(typeof id!=='string'||!/^[-a-z0-9]+$/.test(id))throw Error('Invalid instrument ID');
    const file=path.join(output,'laws',id+'.json');if(!fs.existsSync(file))throw Error('Instrument not held');
    const r=JSON.parse(fs.readFileSync(file,'utf8'));
    if(r.id!==id||digest(r.text)!==r.text_sha256)throw Error('Source integrity mismatch');return r;
  }
  function call(name,args={}) {
    const def=toolDefinitions.find(t=>t.name===name);if(!def)throw Error('Unknown tool');
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid arguments');
    for(const key of Object.keys(args))if(!Object.hasOwn(def.inputSchema.properties,key))throw Error('Unknown argument '+key);
    for(const key of def.inputSchema.required)if(!Object.hasOwn(args,key))throw Error('Missing argument '+key);
    for(const [key,value] of Object.entries(args))if(key!=='facts'&&(typeof value!=='string'||!value.trim()||value.length>200))throw Error('Invalid argument '+key);
    let data;
    if(name==='find_legislation') {
      catalogue??=fs.readdirSync(path.join(output,'laws')).filter(n=>n.endsWith('.json')).map(n=>{const r=JSON.parse(fs.readFileSync(path.join(output,'laws',n),'utf8'));return {id:r.id,title:r.title,version_id:r.text_version_id,source_url:r.source_url,reader_url:'/laws/'+r.id,content_kind:r.content_kind,current_force:null};});
      const terms=args.query.toLocaleLowerCase().trim().split(/\s+/);const results=catalogue.filter(r=>terms.every(t=>r.title.toLocaleLowerCase().includes(t)));
      data={matches:results.length,results:results.slice(0,30),truncated:results.length>30,scope:'title search of held reader records'};
    } else if(name==='find_provisions') {
      const source=JSON.parse(fs.readFileSync(new URL('./section-candidates.json',import.meta.url),'utf8'));
      const terms=args.query.toLowerCase().trim().split(/\s+/);
      const results=source.records.filter(r=>!args.instrument_id||r.id===args.instrument_id).flatMap(r=>r.sections.filter(s=>terms.every(t=>`${s.num} ${s.heading}`.toLowerCase().includes(t))).map(s=>({instrument_id:r.id,title:r.title,...s,status:r.status,source_member:r.source_member,source_sha256:r.source_sha256})));
      data={matches:results.length,results:results.slice(0,30),truncated:results.length>30,provenance:source.provenance};
    } else if(name==='get_provision') {
      const r=readLaw(args.instrument_id);if(r.text_version_id!==args.version_id)throw Error('Requested version not held');
      const p=r.passages.find(p=>p.reader_fragment===args.fragment);if(!p)throw Error('Passage not held');
      const quote=Array.from(r.text).slice(p.character_start,p.character_end).join('');
      if(exactExcerpt(r.text,p.character_start,p.character_end,quote)!==p.passage_sha256)throw Error('Passage integrity mismatch');
      data={instrument_id:r.id,version_id:r.text_version_id,quote,quote_sha256:p.passage_sha256,start:p.character_start,end:p.character_end,reader_url:'/laws/'+r.id+'#'+p.reader_fragment,source_url:r.source_url,current_force:null};
    } else if(name==='find_cases') {
      readLaw(args.instrument_id);data=model.rules.filter(r=>r.instrument_id===args.instrument_id).flatMap(r=>r.case_relationships).map(rel=>({...rel,judgment:model.evidence.documents.find(d=>d.id==='judgment:'+rel.case_id)}));
    } else if(name==='get_rule'||name==='assess_rule') {
      const r=model.rules.find(r=>r.id===args.rule_id);if(!r)throw Error('Rule not held');data=name==='get_rule'?r:assessRule(r,args.facts);
    } else if(name==='get_mapping_evidence') {
      const r=model.evidence.relationships.find(r=>r.id===args.relationship_id);if(!r)throw Error('Relationship not held');
      data={relationship:r,excerpts:r.evidence_ids.map(id=>model.evidence.excerpts.find(e=>e.id===id))};
    } else if(name==='compare_versions') {
      const r=readLaw(args.instrument_id);const same=args.from_version===r.text_version_id&&args.to_version===r.text_version_id;
      data={status:same?'SAME_HELD_VERSION':'COMPARISON_UNAVAILABLE',instrument_id:r.id,available_versions:[r.text_version_id],reason:same?'Both references identify identical held bytes':'A second version of this source record is not held; no comparison or legal change is inferred'};
    } else data={records:model.coverage,unresolved:model.coverage.filter(c=>!c.rule_ids.length),scope:model.limitations};
    return {model_id:model.model_id,schema:model.schema,data,limitations:model.limitations};
  }
  return {model,call};
}
