import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {applyHistoricalAnchors} from './historical-anchors.mjs';
import {appendSourceSupplements} from './supplement-integration.mjs';
import {execFileSync} from 'node:child_process';
import {renderTextReader} from './text-reader.mjs';
import {renderManuallyCollatedReader} from './manual-reader.mjs';
import {enrichProvisionTargets} from './enrich-provisions.mjs';
import {loadReadingVersions,preserveLegacyVersion} from './reading-versions.mjs';
import {displayRecordTitle} from './record-display.mjs';
import {getFacsimile,renderFacsimileReader} from './reader/facsimile.mjs';
import {loadSourceReaderInputs} from './reader/source-inputs.mjs';
import {getSourceReadingInput} from './sources/reading-inputs.mjs';
import {attachFacsimileRelationships,renderFacsimileRelationships} from './mapping/facsimile-relationships.mjs';
import {buildLibraryGraph,verifyLibraryGraph,renderLawRelationships,renderLibraryMap,mappingCss,mappingScript} from './mapping/mapping.mjs';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function publicSourceResult(record,audit){
 const r=audit?.records?.[record.id];
 if(!r)return{id:record.id,title:record.title,stored_text_sha256:record.text_sha256,comparison_status:'not_compared',source_material_status:'stored_transcription_only',source_url:record.source_url||null,current_force_status:'not_checked',notes:[]};
 const safe=JSON.parse(JSON.stringify(r));
 if(/[A-Z]:[\\/]/.test(JSON.stringify(safe)))throw Error('Private path in public source status '+record.id);
 return{...safe,notes:safe.notes||[]};
}

function sourcePanel(result){
 const statuses={matched_original_normalized:'Original-source text comparison matched',matched_original_nonwhitespace:'Original-source characters match; extraction spacing differs',exact_normalized_match:'Original-source text comparison matched',exact_match:'Original-source text comparison matched',material_difference_unresolved:'Original-source differences require review',material_difference:'Original-source differences require review',material_differences:'Original-source differences require review',original_unavailable:'Original source not obtained',unavailable:'Original source not obtained',not_compared:'Original-source comparison pending',source_notice_no_legislation_text:'Source notice; legislation text unavailable',source_notice:'Source notice; legislation text unavailable'};
 Object.assign(statuses,{matched_original_character_stream:'Original-source character comparison matched under the recorded normalization',original_reading_restored:'Complete reading restored from the identified original',manually_collated_original_scan:'Reading visually collated against every original Gazette page',original_facsimile_complete:'Complete original Gazette provided as page images'});
 const label=statuses[result.comparison_status]||String(result.comparison_status||'Comparison pending').replaceAll('_',' ');
 return `<section class="library-source-status" id="original-source-check"><h2>Original-source comparison</h2><p><strong>${esc(label)}</strong></p>${result.original?.url?`<p><a href="${esc(result.original.url)}" rel="noopener">Open the compared original source</a></p>`:''}<p>Source comparison checks the identified transcription and edition. The law's current force, later amendments and territorial application require separate legal review.</p><details><summary>Comparison evidence</summary><dl><dt>Stored text SHA-256</dt><dd>${esc(result.stored_text_sha256||'Not recorded')}</dd><dt>Original source SHA-256</dt><dd>${esc(result.original?.sha256||'Original not obtained')}</dd><dt>Comparison method</dt><dd>${esc(result.comparison?.method||'Not yet compared')}</dd></dl>${result.notes.map(n=>`<p>${esc(n)}</p>`).join('')}<p><a href="/data/source-verification.json">Download the library source-comparison register</a></p></details></section>`;
}

function relationshipPanels(record,graph){
 let standard=renderLawRelationships(record,graph);
 if(getFacsimile(record.id))standard=standard.replace('<h2 id="library-relationships-title">This law in the library</h2>','<h2 id="library-relationships-title">Relationships in the archived transcription</h2><p class="notice">These automatically extracted relationships refer to the separately preserved earlier transcription and its text version. That transcription has not been certified as matching the statutory body in the original page images. Separately reviewed original-page relationships are identified below with their page evidence.</p>');
 return standard+renderFacsimileRelationships(record,graph);
}

export function integrateLibrary({output,records,head,header,footer}){
 const legacyRecords=records,versions=loadReadingVersions(records);
 records=records.map(record=>{const reading=versions.get(record.id)||record;return{...reading,title:displayRecordTitle(reading)};});
 const privateAudit=new URL('./sources/source-verification.json',import.meta.url);
 const publicAudit=new URL('./source-status.json',import.meta.url);
 const sourcePath=fs.existsSync(publicAudit)?publicAudit:privateAudit;
 const audit=fs.existsSync(sourcePath)?JSON.parse(fs.readFileSync(sourcePath,'utf8')):null;
 const reviewedStatutes=JSON.parse(fs.readFileSync(new URL('../qanun-release/statute-rule-mappings.json',import.meta.url),'utf8'));
 const reviewedCases=JSON.parse(fs.readFileSync(new URL('../qanun-release/rule-case-mappings.json',import.meta.url),'utf8'));
 const cachePath=new URL('./mapping/graph.json',import.meta.url),cacheReport=new URL('./mapping/coverage-report.json',import.meta.url);
 let graph;
 if(fs.existsSync(cachePath)&&fs.existsSync(cacheReport)){
  const bound=JSON.parse(fs.readFileSync(cacheReport,'utf8'));
  const moduleHash=hash(fs.readFileSync(new URL('./mapping/mapping.mjs',import.meta.url)));
  const inputHash=hash([...records].sort((a,b)=>a.id.localeCompare(b.id)).map(r=>r.id+':'+r.text_sha256).join('\n'));
  if(bound.module_sha256===moduleHash&&bound.source_text_digest===inputHash){const candidate=JSON.parse(fs.readFileSync(cachePath,'utf8'));const ids=new Map(records.map(r=>[r.id,r]));if(candidate.nodes.every(n=>ids.get(n.id)?.title===n.title))graph=candidate;}
 }
 graph??=buildLibraryGraph(records,{reviewedStatutes,reviewedCases});
 verifyLibraryGraph(records,graph);
 const report={schema_version:'legis-intel-library-repair/1',records:records.length,readers:[],graph_summary:graph.statistics||graph.summary||null,source_summary:audit?.summary||null};
 const sourceRecords={},provisionsByRecord=new Map();
 for(let recordIndex=0;recordIndex<records.length;recordIndex++){
  const record=records[recordIndex],legacyRecord=legacyRecords[recordIndex];
  const file=path.join(output,'laws',record.id+'.html');
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/,'<h1>'+esc(record.title)+'</h1>');
  const raw=html.match(/<pre id="law-text"[^>]*>[\s\S]*?<\/pre>/);
  if(!raw)throw Error('Missing legacy reader block '+record.id);
  const sourceResult=publicSourceResult(record,audit);sourceRecords[record.id]=sourceResult;
  const general=getSourceReadingInput(record);
  if(general.proof&&general.proof.original_pdf_sha256!==sourceResult.original?.sha256)throw Error('Reading layout bound to another original '+record.id);
  const inputs={...general,...loadSourceReaderInputs(record,sourceResult)};
  let reader=getFacsimile(record.id)?renderFacsimileReader(record,{output}):renderManuallyCollatedReader(record,renderTextReader(record,{sourceVerification:sourceResult,...inputs}),{output});
  if(versions.has(record.id)){
   reader=preserveLegacyVersion(legacyRecord,reader);
   fs.mkdirSync(path.join(output,'reading-records'),{recursive:true});
   fs.writeFileSync(path.join(output,'reading-records',record.id+'.json'),JSON.stringify(record));
   fs.writeFileSync(path.join(output,'laws',record.id+'.reader.txt'),record.text);
  }
  if(!reader?.html||!reader.nav||!reader.report)throw Error('Incomplete structured reader '+record.id);
  provisionsByRecord.set(record.id,reader.provisions||[]);
  html=html.replace(raw[0],reader.html);
  if(versions.has(record.id))html=html.replace('Download text</a>','Earlier extraction</a> <a class="secondary" href="'+record.id+'.reader.txt" download>Download source-restored reading text</a> <a class="secondary" href="/reading-records/'+record.id+'.json" download>Reading version record</a>');
  if(versions.has(record.id))html=html.replace('Structured record</a>','Earlier extraction record</a>');
  if(getFacsimile(record.id))html=html.replace('Download text</a>','Archived text extraction</a>').replace('Structured record</a>','Archived transcription record</a>');
  html=html.replace(/<aside class="contents"[^>]*>[\s\S]*?<\/aside>/,`<aside class="contents" aria-label="Legislation contents">${reader.nav}</aside>`);
  html=html.replace('<div class="sourcebox" id="source-details">',sourcePanel(sourceResult)+'<div class="sourcebox" id="source-details">');
  html=html.replace('<a href="#source-details">Source and version</a>','<a href="#library-relationships">Law relationships</a><a href="#original-source-check">Original-source check</a><a href="#source-details">Source and version</a>');
  html=html.replace('</head>',`<style>${reader.css||''}\n${mappingCss||''}\n.structured-law .source-passage-target{background:#fff2bd;outline:2px solid #c29c34;outline-offset:4px}.library-source-status{margin:32px 0;padding:24px;border:1px solid #c8d0d8;line-height:1.7}.library-source-status dd,.library-source-status a{overflow-wrap:anywhere}.library-source-status dd{margin:0 0 12px}.library-source-status dt{font-weight:bold}</style></head>`);
  html=html.replace('</body>','<script src="/assets/library-mapping.js" defer></script></body>');
  fs.writeFileSync(file,html);
  report.readers.push({id:record.id,...reader.report});
 }
 report.reader_enrichment=enrichProvisionTargets(graph,records,provisionsByRecord);
 attachFacsimileRelationships(graph,records);
 verifyLibraryGraph(records,graph);
 for(const node of graph.nodes){if(getFacsimile(node.id)){node.reader_kind='original_facsimile';node.mapping_text_scope='Archived earlier transcription; original-page relationships are separately identified and body text is not certified.';}}
 for(const record of records){const file=path.join(output,'laws',record.id+'.html');let html=fs.readFileSync(file,'utf8');html=html.replace('<section class="library-source-status" id="original-source-check">',relationshipPanels(record,graph)+'<section class="library-source-status" id="original-source-check">');fs.writeFileSync(file,html);}
 let map=fs.readFileSync(path.join(output,'mappings.html'),'utf8');
 const libraryMap=renderLibraryMap(graph);
 map=map.replace(/<main id="main"[^>]*>/,tag=>tag+'<section class="library-map-page"><h2>Map the whole law library</h2><p>Follow explicit instrument citations and provision references across the collection, with incoming links and source evidence.</p><p><a class="textbutton" href="/library-map">Explore the whole-library map →</a></p></section>');
 fs.writeFileSync(path.join(output,'mappings.html'),map);
 const mapPage=head('Law Library Map').replace('</head>',`<style>${mappingCss||''}</style></head>`)+header+'<main id="main">'+libraryMap+'</main>'+footer+'<script src="/assets/library-mapping.js" defer></script></body></html>';
 fs.writeFileSync(path.join(output,'library-map.html'),mapPage);
 fs.mkdirSync(path.join(output,'data'),{recursive:true});
 fs.writeFileSync(path.join(output,'assets','library-mapping.js'),mappingScript||'');
 fs.writeFileSync(path.join(output,'data','law-library-map.json'),JSON.stringify({schema_version:graph.schema_version,scope:graph.scope,statistics:graph.statistics,nodes:graph.nodes,coverage:graph.coverage,facsimile_relationships:graph.facsimile_relationships,citations:graph.citations.map(({evidence,context_evidence,...r})=>({...r,evidence_record:evidence.record_id,evidence_fragment:evidence.reader_fragment,source_evidence_url:'/law-maps/'+r.source+'.json'})),per_law_evidence_directory:'/law-maps/'}));
 const fullGraphPath=new URL('./library-graph-verification.json',import.meta.url);
 fs.writeFileSync(fullGraphPath,JSON.stringify(graph));
 fs.mkdirSync(path.join(output,'law-maps'),{recursive:true});
 for(const record of records){const local={schema_version:graph.schema_version,record_id:record.id,facsimile_relationships:(graph.facsimile_relationships||[]).filter(e=>e.source_id===record.id||e.target_id===record.id),coverage:graph.coverage[record.id],citations:graph.citations.filter(e=>e.source===record.id),incoming:graph.citations.filter(e=>e.target===record.id).map(({evidence,context_evidence,...r})=>({...r,source_evidence_url:'/law-maps/'+r.source+'.json'})),internal_references:graph.internal_references.filter(e=>e.source===record.id),external_references:(graph.external_references||[]).filter(e=>e.source===record.id),external_incoming:(graph.external_references||[]).filter(e=>e.target===record.id).map(({evidence,instrument_evidence,context_evidence,...r})=>({...r,source_evidence_url:'/law-maps/'+r.source+'.json'})),unresolved:graph.unresolved.filter(e=>e.source===record.id)};fs.writeFileSync(path.join(output,'law-maps',record.id+'.json'),JSON.stringify(local));}
 applyHistoricalAnchors({output,records:legacyRecords,report});
 appendSourceSupplements({output,records,sourceRecords,report});
 fs.writeFileSync(path.join(output,'data','source-verification.json'),JSON.stringify({schema_version:'legis-intel-public-source-audit/1',audited_at:audit?.audited_at||null,audit_started_at:audit?.audit_started_at||null,summary:audit?.summary||null,records:sourceRecords}));
 let commit=process.env.VERCEL_GIT_COMMIT_SHA||null;
 if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}}
 fs.writeFileSync(path.join(output,'data','library-release.json'),JSON.stringify({schema_version:'legis-intel-library-release/1',commit,records:records.length,reader_module_sha256:hash(fs.readFileSync(new URL('./reader/reader.mjs',import.meta.url))),mapping_module_sha256:hash(fs.readFileSync(new URL('./mapping/mapping.mjs',import.meta.url))),source_register_sha256:hash(fs.readFileSync(path.join(output,'data','source-verification.json'))),source_summary:audit?.summary||null}));
 const cssSummary=report.readers.reduce((a,r)=>{a[r.status||'structured']=(a[r.status||'structured']||0)+1;return a;},{});
 report.reader_statuses=cssSummary;report.source_facsimile_records=report.readers.filter(r=>r.kind==='original_facsimile').length;report.source_facsimile_pages=report.readers.reduce((sum,r)=>sum+(r.source_facsimile_pages||0),0);report.graph_sha256=hash(fs.readFileSync(path.join(output,'data','law-library-map.json')));report.script_csp_token='sha256-'+crypto.createHash('sha256').update(mappingScript||'').digest('base64');
 fs.writeFileSync(new URL('./library-integration-report.json',import.meta.url),JSON.stringify(report,null,2));
 return report;
}
