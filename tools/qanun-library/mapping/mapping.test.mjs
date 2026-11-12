import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildLibraryGraph,renderLawRelationships,renderLibraryMap,verifyLibraryGraph,titleKey,mappingScript} from './mapping.mjs';

const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function law(id,title,text,collection='Federal') {
 const length=Array.from(text).length;
 return {id,title,text,source_collection:collection,source_url:'https://example.test/'+id,content_kind:'stored_law_text',text_sha256:hash(text),text_version_id:'law:'+id+':sha256:'+hash(text),passages:[{character_start:0,character_end:length,reader_fragment:'p-'+id}]};
}
test('exact title/year citations carry source offsets and inverse links',()=>{
 const source=law('a','University Act, 2025','😀 The Board is registered under the Companies Act, 2017 (XIX of 2017).');
 const target=law('b','The Companies Act, 2017','1. Short title.—(1) This Act may be called the Companies Act, 2017.');
 const g=buildLibraryGraph([source,target]);assert.equal(g.citations.length,1);const c=g.citations[0];
 assert.equal(c.target,'b');assert.equal(c.evidence.quote,'Companies Act, 2017');
 assert.equal(Array.from(source.text).slice(c.evidence.character_start,c.evidence.character_end).join(''),c.evidence.quote);
 assert.deepEqual(g.coverage.b.inbound,[c.id]);assert.equal(c.evidence.reader_fragment,'p-a');
 assert.equal(verifyLibraryGraph([source,target],g).records,2);
});
test('different source editions remain ambiguous; current force is never invented',()=>{
 const a=law('a','University Act 2025','The provisions of the Companies Act 2017 shall apply.');
 const b=law('b','Companies Act 2017','First source.');const c=law('c','Companies Act 2017','Second source.','Punjab');
 const g=buildLibraryGraph([a,b,c]);assert.equal(g.citations[0].target,null);assert.equal(g.citations[0].resolution,'ambiguous_source_editions');
 assert.deepEqual(g.citations[0].target_candidates,['b','c']);assert.equal(g.coverage.b.inbound.length,0);
 assert.match(renderLawRelationships(a,g),/more than one source record/);assert.ok(!('current_force' in g.citations[0]));
});
test('year prevents near-title merging and missing instruments retain actual citation evidence',()=>{
 const a=law('a','University Act 2025','The Punjab Higher Education Commission Act, 2014 and the Companies Act, 1913 apply.');
 const b=law('b','Companies Act 2017','Other law.');const g=buildLibraryGraph([a,b]);
 assert.equal(g.citations.length,0);assert.ok(g.unresolved.some(x=>x.title.includes('Companies Act, 1913')));
 assert.ok(g.unresolved.some(x=>x.title.includes('Punjab Higher Education Commission Act, 2014')));
 verifyLibraryGraph([a,b],g);
});
test('a held short title inside a different longer proper title is not a match',()=>{
 const a=law('a','University Act 2025','Under the Punjab Companies Act 2017, and under the Companies Act 2017.');
 const b=law('b','Companies Act 2017','Text.');const g=buildLibraryGraph([a,b]);
 assert.equal(g.citations.length,1);assert.equal(g.citations[0].evidence.quote,'Companies Act 2017');
 assert.ok(g.unresolved.some(x=>x.title==='Punjab Companies Act 2017'));
});
test('citation near repeal wording is not converted into a repeal holding',()=>{
 const a=law('a','University Act 2025','Nothing in this Act repeals the Companies Act 2017.');const b=law('b','Companies Act 2017','Legislation.');
 const g=buildLibraryGraph([a,b]);assert.equal(g.citations[0].relation,'citation_in_repeal_context');
 assert.notEqual(g.citations[0].relation,'repeals');assert.match(renderLawRelationships(a,g),/Citation near repeal wording/);
});
test('own title repetitions are not self edges',()=>{
 const a=law('a','The University Act, 2025','THE UNIVERSITY ACT, 2025\n1. Short title.—(1) This Act is the University Act, 2025.');
 assert.equal(buildLibraryGraph([a]).citations.length,0);
});
test('catalogue acronyms and review annotations do not block exact instrument citations',()=>{
 const a=law('a','University Act 2025','The Higher Education Commission Ordinance 2002 applies alongside the Pakistan Penal Code, 1860.');
 const b=law('b','Higher Education Commission (HEC) Ordinance, 2002','Text.');
 const c=law('c','Pakistan Penal Code (PPC),1860 (Under Review)','Text.');
 const g=buildLibraryGraph([a,b,c]);assert.equal(g.citations.length,2);assert.deepEqual(g.citations.map(x=>x.target),['b','c']);
});
test('territorial and other substantive uppercase parentheticals are never discarded',()=>{
 const a=law('a','University Act 2025','The Local Government Act 2013 and the Local Government (FATA) Act 2013 are distinct references.');
 const b=law('b','Local Government (FATA) Act 2013','Text.');const g=buildLibraryGraph([a,b]);
 assert.equal(g.citations.length,1);assert.equal(g.citations[0].evidence.quote,'Local Government (FATA) Act 2013');
 assert.ok(g.unresolved.some(x=>x.title==='Local Government Act 2013'));
});
test('a year held only in an Act-number catalogue citation remains mandatory',()=>{
 const a=law('a','University Act 2025','The Coasting-Vessels Act 1838 applies; the Coasting-Vessels Act 1839 does not.');
 const b=law('b','Coasting-Vessels Act,(XIX of 1838)(Repeal by 52 of 2001 s.610 & sch (pp-1-5)))','Text.');
 const g=buildLibraryGraph([a,b]);assert.equal(g.citations.length,1);assert.equal(g.citations[0].evidence.quote,'Coasting-Vessels Act 1838');
 assert.ok(g.unresolved.some(x=>x.title.includes('Coasting-Vessels Act 1839')));
});
test('internal provision links resolve operative headings, not bare contents entries',()=>{
 const a=law('a','University Act 2025','CONTENTS\n1. Short title\n2. Definitions\n\n1. Short title.—(1) Subject to section 2, this Act applies.\n2. Definitions.—In this Act, Board means the Board.');
 const g=buildLibraryGraph([a]);assert.equal(g.internal_references.length,1);assert.equal(g.internal_references[0].provision_number,'2');
 assert.equal(g.internal_references[0].resolution,'matched_operative_heading');assert.equal(g.internal_references[0].target_fragment,'p-a');
});
test('quoted inserted provisions and schedules do not silently choose duplicate numbered headings',()=>{
 const a=law('a','University Act 2025','2. Substitution.—The following is substituted.\n3. Powers.—The Board acts.\nSCHEDULE\n3. Powers.—The Committee acts.\nSee section 3.');
 const g=buildLibraryGraph([a]);assert.equal(g.internal_references[0].resolution,'ambiguous_operative_headings');assert.equal(g.internal_references[0].target_fragment,null);
});
test('unique quoted insertions do not become local provisions of an Amendment Act',()=>{
 const a=law('a','University (Amendment) Act 2025','1. Title.—This Act applies.\n2. Insertion.—After section 15 the following is inserted:\n16. Powers.—The Board acts.\nThe reference to section 16 is amended. See section 2 of this Act.');
 const g=buildLibraryGraph([a]);assert.equal(g.internal_references.length,1);assert.equal(g.internal_references[0].provision_number,'2');
});
test('explicit external section citation is not mislabelled as an internal reference',()=>{
 const a=law('a','University Act 2025','2. Definitions.—Commission means the body under section 12 of the Punjab Higher Education Commission Act 2014.\n12. Board.—The Board acts.');
 const g=buildLibraryGraph([a]);assert.equal(g.internal_references.length,0);
});
test('external subsections across wraps and generic parent-Act references stay external',()=>{
 const a=law('a','University Act 2025','12. Board.—The Board acts.\nUnder section 12(1)(a) of\n the Punjab Higher Education Commission Act 2014; section 12 of that Act; section 12 of any law.');
 assert.equal(buildLibraryGraph([a]).internal_references.length,0);
 const b=law('b','University Rules 2025','12. Board.—The Board acts.\nUnder section 12 of this Act and rule 12 of these Rules.');
 const g=buildLibraryGraph([b]);assert.equal(g.internal_references.length,1);assert.equal(g.internal_references[0].provision_kind,'rule');
});
test('an explicit external section qualifier links exact source and target headings across wraps',()=>{
 const a=law('a','University Act 2025','The Board acts under section 12(1)(a) of\n the Companies Act, 2017.');
 const b=law('b','Companies Act 2017','1. Title.—This Act applies.\n12. Board powers. — (1) The Board has powers.\n(a) It may act.');
 const g=buildLibraryGraph([a,b]);assert.equal(g.external_references.length,1);const x=g.external_references[0];
 assert.equal(x.target,'b');assert.equal(x.provision_number,'12');assert.equal(x.qualifier,'(1)(a)');
 assert.equal(x.evidence.quote,'section 12(1)(a) of\n the Companies Act, 2017');assert.equal(x.target_evidence.record_id,'b');
 assert.equal(x.target_evidence.quote,'12. Board powers. — ');assert.equal(x.target_fragment,'p-b');
 assert.equal(x.resolution_scope,'numbered_heading_only');assert.equal(x.subprovision_status,'not_independently_matched');
 assert.ok(g.coverage.a.external_outgoing.includes(x.id));assert.ok(g.coverage.b.external_incoming.includes(x.id));
 assert.match(renderLawRelationships(a,g),/Open the target section 12/);verifyLibraryGraph([a,b],g);
});
test('external qualifiers are never inferred from another sentence or a shared paragraph',()=>{
 const a=law('a','University Act 2025','Section 12 describes the Board. The Companies Act 2017 applies.');
 const b=law('b','Companies Act 2017','12. Board.—The Board acts.');const g=buildLibraryGraph([a,b]);
 assert.equal(g.citations.length,1);assert.equal(g.external_references.length,0);
});
test('wrong-year and longer-title external references remain unheld',()=>{
 const a=law('a','University Act 2025','Under section 12 of the Companies Act 2018 and section 12 of the Punjab Companies Act 2017.');
 const b=law('b','Companies Act 2017','12. Board.—The Board acts.');const g=buildLibraryGraph([a,b]);
 assert.equal(g.citations.length,0);assert.equal(g.external_references.length,2);
 assert.ok(g.external_references.every(x=>x.target===null&&x.target_evidence===null&&x.resolution==='instrument_not_held'));
 verifyLibraryGraph([a,b],g);
});
test('external references never select an ambiguous edition or duplicate schedule heading',()=>{
 const a=law('a','University Act 2025','Under section 12 of the Companies Act 2017.');
 const b=law('b','Companies Act 2017','12. Board.—The Board acts.');const c=law('c','Companies Act 2017','12. Board.—The Board acts.','Punjab');
 const ambiguous=buildLibraryGraph([a,b,c]).external_references[0];assert.equal(ambiguous.resolution,'ambiguous_source_editions');assert.equal(ambiguous.target_evidence,null);
 const d=law('d','Companies Act 2017','12. Board.—The Board acts.\nSCHEDULE\n12. Board.—The Committee acts.');
 const duplicate=buildLibraryGraph([a,d]).external_references[0];assert.equal(duplicate.resolution,'ambiguous_operative_headings');assert.equal(duplicate.target_evidence,null);
});
test('missing headings and wrong provision kinds remain explicit unresolved references',()=>{
 const a=law('a','University Act 2025','Under section 12 of the Companies Act 2017 and article 2 of the Companies Act 2017.');
 const b=law('b','Companies Act 2017','2. Definitions.—Board means the Board.');const g=buildLibraryGraph([a,b]);
 assert.equal(g.external_references[0].resolution,'operative_heading_not_identified');
 assert.equal(g.external_references[1].resolution,'target_provision_kind_not_matched');
 assert.equal(g.statistics.resolved_external_provision_headings,0);verifyLibraryGraph([a,b],g);
});
test('a unique inserted heading in an external Amendment Act is not treated as its local section',()=>{
 const a=law('a','University Act 2025','Under section 12 of the Companies (Amendment) Act 2017.');
 const b=law('b','Companies (Amendment) Act 2017','2. Insertion.—The following is inserted:\n12. Board.—The Board acts.');
 const g=buildLibraryGraph([a,b]);assert.equal(g.external_references[0].resolution,'amending_instrument_target_requires_review');assert.equal(g.external_references[0].target_evidence,null);
});
test('external target evidence is checked against the target record rather than the citing source',()=>{
 const a=law('a','University Act 2025','Under section 12 of the Companies Act 2017.');const b=law('b','Companies Act 2017','12. Board.—The Board acts.');
 const g=buildLibraryGraph([a,b]);verifyLibraryGraph([a,b],g);g.external_references[0].target_evidence.quote='Forged target';
 assert.throws(()=>verifyLibraryGraph([a,b],g),/External provision evidence mismatch/);
});
test('target evidence is the exact full raw heading, including variable spacing',()=>{
 const a=law('a','University Act 2025','1. Short title.—(1) See section 2.\n  2.  Definitions. —   In this Act, Board means the Board.');
 const g=buildLibraryGraph([a]);assert.equal(g.internal_references[0].target_evidence.quote,'  2.  Definitions. —   ');
});
test('an Act mentioning the Constitution in its title still uses sections',()=>{
 const a=law('a','Tribunals (Extension of Provisions of the Constitution) Act 1974','1. Title.—See section 2.\n2. Effect.—This Act applies.');
 const g=buildLibraryGraph([a]);assert.equal(g.internal_references.length,1);assert.equal(g.internal_references[0].provision_kind,'section');
});
test('the actual university Act links the HEC Ordinance and Companies Act',()=>{
 const base=new URL('../../../landing-pages/qanun-maps/laws/',import.meta.url);
 const records=['punjab-code-d660763e2dce89e6','pk-code-791dfe3cf34c8eb4','pk-code-d0aea4d6f80cd068'].map(id=>JSON.parse(fs.readFileSync(new URL(id+'.json',base),'utf8')));
 const g=buildLibraryGraph(records),out=g.citations.filter(x=>x.source===records[0].id);
 assert.ok(out.some(x=>x.target==='pk-code-791dfe3cf34c8eb4'));
 assert.ok(out.some(x=>x.target==='pk-code-d0aea4d6f80cd068'));
 verifyLibraryGraph(records,g);
});
test('source notices remain covered without invented relationships',()=>{
 const a=law('a','Missing Act 2000','Source unavailable');a.content_kind='source_notice';const g=buildLibraryGraph([a]);
 assert.equal(g.nodes.length,1);assert.equal(g.coverage.a.status,'source_text_unavailable');assert.equal(g.citations.length,0);
 assert.match(renderLawRelationships(a,g),/cannot be extracted from a source notice/);
});
test('tampering with evidence and reverse adjacency fails verification',()=>{
 const a=law('a','University Act 2025','The Companies Act 2017 applies.');const b=law('b','Companies Act 2017','Text');
 const g=buildLibraryGraph([a,b]);g.citations[0].evidence.quote='invented';assert.throws(()=>verifyLibraryGraph([a,b],g),/evidence mismatch/);
 const h=buildLibraryGraph([a,b]);h.coverage.b.inbound=[];assert.throws(()=>verifyLibraryGraph([a,b],h),/inverse/);
});
test('forged node identity and evidence version identities fail verification',()=>{
 const a=law('a','University Act 2025','Under section 12 of the Companies Act 2017.');const b=law('b','Companies Act 2017','12. Board.—The Board acts.');
 const g=buildLibraryGraph([a,b]);g.nodes[0].title='Fabricated title';assert.throws(()=>verifyLibraryGraph([a,b],g),/node identity mismatch/);
 const h=buildLibraryGraph([a,b]);h.citations[0].evidence.text_version_id='wrong';assert.throws(()=>verifyLibraryGraph([a,b],h),/Graph evidence mismatch/);
 const j=buildLibraryGraph([a,b]);j.external_references[0].target_evidence.text_version_id='wrong';assert.throws(()=>verifyLibraryGraph([a,b],j),/External provision evidence mismatch/);
});
test('a stale stored text hash fails before relationship extraction',()=>{
 const a=law('a','University Act 2025','Original');a.text='Changed';assert.throws(()=>buildLibraryGraph([a]),/Raw record hash mismatch/);
});
test('rendering escapes source text and renders all records without JavaScript',()=>{
 const a=law('a','<University> Act 2025','No citations here.');const g=buildLibraryGraph([a]);const html=renderLibraryMap(g);
 assert.match(html,/&lt;University&gt;/);assert.match(html,/data-map-law="a"/);assert.match(html,/without JavaScript/);
 assert.match(mappingScript,/URLSearchParams/);assert.equal(titleKey('The Companies Act, 2017'),'companies act 2017');
});
test('whole-library search, law deep-link and clear perform the visitor flow',()=>{
 const events={},input={value:'',addEventListener:(name,fn)=>events['input:'+name]=fn,focus:()=>{input.focused=true;}},status={textContent:''};
 const form={addEventListener:(name,fn)=>events['form:'+name]=fn},clear={addEventListener:(name,fn)=>events['clear:'+name]=fn};
 const cards=[{dataset:{mapLaw:'a',mapSearch:'university act 2025 punjab'},hidden:false},{dataset:{mapLaw:'b',mapSearch:'companies act 2017 federal'},hidden:false}];
 const elements={'library-map-filter':form,'library-map-query':input,'library-map-status':status,'library-map-clear':clear};
 const document={getElementById:id=>elements[id],querySelectorAll:()=>cards};
 vm.runInNewContext(mappingScript,{document,location:{search:'?law=b'},URLSearchParams});
 assert.deepEqual(cards.map(x=>x.hidden),[true,false]);
 input.value='university punjab';events['input:input']();assert.deepEqual(cards.map(x=>x.hidden),[false,true]);
 events['clear:click']();assert.deepEqual(cards.map(x=>x.hidden),[false,false]);assert.equal(input.focused,true);
 input.value='absent';events['form:submit']({preventDefault(){}});assert.deepEqual(cards.map(x=>x.hidden),[true,true]);assert.match(status.textContent,/0 of 2/);
});
