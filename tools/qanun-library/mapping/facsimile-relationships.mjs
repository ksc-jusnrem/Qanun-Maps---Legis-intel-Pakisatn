import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const law=id=>'/laws/'+encodeURIComponent(id);
const fail=message=>{throw Error('Facsimile relationship: '+message);};
const safeId=value=>typeof value==='string'&&/^[a-z0-9_-]+$/.test(value);
const hashPattern=/^[a-f0-9]{64}$/;
const relationshipId=r=>'facsimile-'+sha(JSON.stringify([r.source_id,r.source_page,r.source_provision,r.relation,r.target_id,r.target_title,r.target_provision,r.quote_sha256])).slice(0,20);

function readInputs(options={}) {
 const repoRoot=path.resolve(options.repoRoot??root);
 const directory=path.resolve(options.directory??path.join(repoRoot,'tools/qanun-library/reader/facsimiles'));
 const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
 return {repoRoot,directory,manifest:options.manifest??read('manifest.json'),relationships:options.relationships??read('reviewed-relationships.json'),targets:options.targets??read('reviewed-target-passages.json')};
}

function below(base,relative) {
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))fail('unsafe asset path');
 const resolved=path.resolve(base,relative),prefix=path.resolve(base)+path.sep;
 if(!resolved.startsWith(prefix))fail('asset leaves repository');
 return resolved;
}

function validateBundle(records,inputs,options={}) {
 const byId=new Map(records.map(r=>[r.id,r]));
 const manifests=new Map(inputs.manifest.records.map(r=>[r.id,r]));
 const targetProofs=new Map();
 const fileHashes=new Map();
 const fileHash=file=>{if(!fileHashes.has(file)){if(!fs.existsSync(file))fail('missing asset '+file);fileHashes.set(file,sha(fs.readFileSync(file)));}return fileHashes.get(file);};
 for(const proof of inputs.targets) {
  const record=byId.get(proof.record_id);if(!record)fail('unknown target '+proof.record_id);
  if(proof.title!==record.title||proof.text_sha256!==record.text_sha256||proof.text_version_id!==record.text_version_id||sha(record.text??'')!==record.text_sha256)fail('target record identity changed '+proof.record_id);
  const chars=Array.from(record.text??'');
  if(!Number.isInteger(proof.character_start)||!Number.isInteger(proof.character_end)||proof.character_start<0||proof.character_end<=proof.character_start||proof.character_end>chars.length||chars.slice(proof.character_start,proof.character_end).join('')!==proof.quote||sha(proof.quote)!==proof.quote_sha256)fail('target passage mismatch '+proof.record_id);
  const number=String(proof.provision_number);
  if(proof.reader_anchor!==`provision-${number.toLowerCase()}-${proof.character_start}`)fail('target provision anchor mismatch '+proof.record_id);
  const key=proof.record_id+':'+number;if(targetProofs.has(key))fail('duplicate target proof '+key);targetProofs.set(key,proof);
 }
 const result=[],ids=new Set();
 for(const input of inputs.relationships.relationships) {
  const r=structuredClone(input),record=byId.get(r.source_id),manifest=manifests.get(r.source_id);
  if(!safeId(r.source_id)||!record||!manifest)fail('unknown source '+r.source_id);
  if(r.source_title!==record.title||manifest.title!==record.title||manifest.input_text_sha256!==record.text_sha256||sha(record.text??'')!==record.text_sha256)fail('source record identity changed '+r.source_id);
  if(!hashPattern.test(r.source_pdf_sha256)||r.source_pdf_sha256!==manifest.source_pdf_sha256||r.source_original_url!==manifest.original_url)fail('original identity mismatch '+r.source_id);
  if(!Number.isInteger(r.source_page)||r.source_page<1)fail('invalid physical page');
  const page=manifest.pages.find(p=>p.page===r.source_page);
  if(!page||page.asset!==r.source_page_image||page.sha256!==r.source_page_image_sha256||!/^page-\d{3,}\.png$/.test(page.asset))fail('source image manifest mismatch '+r.source_id);
  const assetDir=below(inputs.repoRoot,manifest.asset_directory);
  if(fileHash(below(assetDir,manifest.pdf_asset))!==r.source_pdf_sha256||fileHash(below(assetDir,page.asset))!==r.source_page_image_sha256)fail('original or page image bytes changed '+r.source_id);
  if(typeof r.quote!=='string'||!r.quote.trim()||sha(r.quote)!==r.quote_sha256)fail('quote hash mismatch '+r.source_id);
  if(r.evidence_type!=='visual_page_transcription'||r.character_start!=null||r.character_end!=null||!r.review_scope||!r.transcription_method)fail('visual evidence requires review scope and no invented text offsets');
  const pageName=String(r.source_page).padStart(3,'0');
  if(r.reader_anchor!=='source-page-'+pageName||r.image_href!==`/sources/facsimiles/${r.source_id}/${page.asset}`||r.pdf_href!==`/sources/facsimiles/${r.source_id}/${manifest.pdf_asset}#page=${r.source_page}`)fail('source page links mismatch '+r.source_id);
  const id=relationshipId(r);if(ids.has(id))fail('duplicate reviewed relationship');ids.add(id);
  let targetEvidence=null,targetHref=null;
  if(r.target_id!=null) {
   if(!safeId(r.target_id)||!byId.has(r.target_id))fail('unknown canonical target');
   const number=r.target_provision?.match(/\b(?:Article|Section|Rule|Regulation)\s+(\d+[A-Z]?)/i)?.[1];
   targetEvidence=targetProofs.get(r.target_id+':'+number);
   if(!number||!targetEvidence)fail('missing reviewed target passage '+r.target_id+' '+r.target_provision);
   targetHref=law(r.target_id)+'#'+targetEvidence.reader_anchor;
  } else if(!r.identity_status)fail('unresolved target needs identity explanation');
  result.push({...r,id,character_start:null,character_end:null,source_reader_href:law(r.source_id)+'#'+r.reader_anchor,target_reader_href:targetHref,target_evidence:targetEvidence?structuredClone(targetEvidence):null});
 }
 if(options.output) {
  const output=path.resolve(options.output);
  const checkAnchor=(id,anchor)=>{const file=below(output,'laws/'+id+'.html');if(!fs.existsSync(file)||!fs.readFileSync(file,'utf8').includes(`id="${anchor}"`))fail('generated reader anchor missing '+id+'#'+anchor);};
  for(const r of result){checkAnchor(r.source_id,r.reader_anchor);if(r.target_id)checkAnchor(r.target_id,r.target_evidence.reader_anchor);for(const [href,expected] of [[r.image_href,r.source_page_image_sha256],[r.pdf_href.split('#')[0],r.source_pdf_sha256]])if(fileHash(below(output,href.replace(/^\//,'')))!==expected)fail('public asset bytes mismatch '+href);}
 }
 return result;
}

export function attachFacsimileRelationships(graph,records,options={}) {
 const inputs=readInputs(options),relationships=validateBundle(records,inputs,options);
 graph.facsimile_relationships=relationships;
 graph.statistics??={};
 graph.statistics.reviewed_facsimile_relationships=relationships.length;
 graph.statistics.facsimile_source_records=new Set(relationships.map(r=>r.source_id)).size;
 return relationships;
}

export function validateFacsimileRelationships(graph,records,options={}) {
 const expected=validateBundle(records,readInputs(options),options);
 if(JSON.stringify(graph.facsimile_relationships??[])!==JSON.stringify(expected))fail('attached reviewed evidence differs from current source register');
 return {relationships:expected.length,source_records:new Set(expected.map(r=>r.source_id)).size,target_records:new Set(expected.map(r=>r.target_id).filter(Boolean)).size};
}

const labels={cites_enabling_authority:'Enabling provision cited in the original',express_repeal_as_stated_in_source:'Express repeal wording in the original',cites_savings_provision_as_printed:'Savings provision cited as printed',cites_definition:'Definition cited in the original',expressly_operates_notwithstanding_provision:'Express notwithstanding provision'};
export function renderFacsimileRelationships(record,graph) {
 const out=(graph.facsimile_relationships??[]).filter(r=>r.source_id===record.id),incoming=(graph.facsimile_relationships??[]).filter(r=>r.target_id===record.id);
 if(!out.length&&!incoming.length)return '';
 const card=r=>`<article id="${esc(r.id)}" class="library-facsimile-relationship"><h3>${esc(labels[r.relation]??r.relation.replaceAll('_',' '))}</h3><p><a href="${esc(r.source_reader_href)}">${esc(r.source_title)} · ${esc(r.source_provision)}</a> → ${r.target_reader_href?`<a href="${esc(r.target_reader_href)}">${esc(r.target_title)} · ${esc(r.target_provision)}</a>`:esc(r.target_title)+(r.target_provision?' · '+esc(r.target_provision):'')}</p>${r.identity_status?`<p class="notice">${esc(r.identity_status)}</p>`:''}<blockquote>${esc(r.quote)}</blockquote><p><a href="${esc(r.source_reader_href)}">Read original page ${r.source_page}${r.printed_page?' (printed '+esc(r.printed_page)+')':''}</a> · <a href="${esc(r.image_href)}">Open original page image</a> · <a href="${esc(r.pdf_href)}">Open original PDF at this page</a></p>${r.target_evidence?`<details><summary>Read the held target provision</summary><blockquote>${esc(r.target_evidence.quote)}</blockquote><p><a href="${esc(r.target_reader_href)}">Open ${esc(r.target_provision)} in its reader</a></p><p class="library-evidence">${esc(r.target_evidence.review_scope)}</p></details>`:''}<details><summary>Evidence and review scope</summary><p>${esc(r.transcription_method)}</p><p>${esc(r.review_scope)}</p><p class="library-evidence">Original PDF SHA-256: ${esc(r.source_pdf_sha256)}<br>Page image SHA-256: ${esc(r.source_page_image_sha256)}<br>Selected quotation SHA-256: ${esc(r.quote_sha256)}</p><p><a href="${esc(r.source_original_url)}" rel="noopener">Recorded official original source</a></p></details></article>`;
 return `<section id="facsimile-relationships" class="library-relationships" aria-labelledby="facsimile-relationships-title"><div class="eyebrow">REVIEWED ORIGINAL-PAGE EVIDENCE</div><h2 id="facsimile-relationships-title">Relationships read from original pages</h2><p>These selected passages were read from the original page images. Their evidence is attached to the page, with no invented OCR character offsets. Printed identity discrepancies remain visible.</p>${out.length?`<h3>This law’s original-page relationships</h3>${out.map(card).join('')}`:''}${incoming.length?`<h3>Original-page references from other laws</h3>${incoming.map(card).join('')}`:''}</section>`;
}
