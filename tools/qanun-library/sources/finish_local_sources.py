"""Finalize newly located original identities without certifying old bad text."""
from pathlib import Path
import json,re,fitz
import audit_sources as a

report=a.readjson(a.REPORT)
def save(id,row):
    report['records'][id]=row;a.writejson(a.CACHE/'results'/(id+'.json'),row)
def original(path,url,receipt,identity,pages,textpath,text,**extra):
    return {'path':str(path),'sha256':a.sha(path.read_bytes()),'url':url,'retrieved_at':receipt.get('retrieved_at') or receipt.get('fetched_at'),'identity_basis':identity,'identity_checked':True,'pages':pages,'extracted_text_path':str(textpath),'extracted_text_sha256':a.sha(text.encode()),'extraction_method':'PyMuPDF full original extraction','recorded_sha256':receipt.get('sha256'),'archive_hash_check':'matched' if receipt.get('sha256')==a.sha(path.read_bytes()) else 'no_prior_original_hash_recorded',**extra}

# The146-page BRA consolidation is the actual source behind the held version.
id='balochistan-code-d9d838bd66607fd9';row=report['records'][id];law=a.readjson(a.ROOT/'landing-pages/qanun-maps/laws'/(id+'.json'))
p=a.CACHE/'originals/balochistan-candidate-0.pdf';receipt=a.readjson(p.with_suffix('.receipt.json'))
with fitz.open(p) as doc:text='\n\f\n'.join(page.get_text() for page in doc);pages=len(doc)
ep=a.CACHE/'extracted'/(receipt['sha256']+'.fitz.txt');ep.write_text(text,encoding='utf-8')
status,proof,diff=a.comparison(text,law['text'])
assert status in ['matched_original_normalized','matched_original_character_stream'],status
old=row.get('original');row.update(source_url=receipt['final_url'],source_material_status='text_checked',comparison_status=status,original=original(p,receipt['final_url'],receipt,'Official BRA full146-page consolidation: complete character stream matches the held source after removing explicit PDF PAGE extraction wrappers.',pages,ep,text),comparison=proof)
row['notes']=[*row.get('notes',[]),'The recorded BalochistanCode link led to a different84-page edition. The actual held2019consolidation was located at the official BRA146-page original; older candidate retained privately and not treated as interchangeable.','Complete non-whitespace character agreement includes all146pages; current force and later amendments are not certified.']
row['superseded_wrong_source_candidate']={k:old.get(k) for k in ['url','sha256','pages']} if old else None
save(id,row);print('BAL0CH_ORIGINAL_RESOLVED',status,pages,flush=True)

# DRS doc695/version1887 is independently corroborated in the current official
# PakistanCode HTML. Its damaged OCR is not upgraded to a checked transcription.
drs=a.ANNEXES/'drs-molaw-corpus';details=a.readjson(drs/'document_details.json');detail=next(x for x in details if x.get('doc_id')==695 and x.get('version_id')==1887)
id='pk-code-c02eccd95b859b79';row=report['records'][id];p=drs/'pdfs/695_1887_Document_History_-_The_Marriage_Functions_(Ostentatious_Displays)_Ordinance,_1999.pdf'
html=a.CACHE/'originals/marriage-detail-html.html';htmltext=html.read_text(encoding='utf-8');assert 'docId=695' in htmltext and 'versionId=1887' in htmltext
with fitz.open(p) as doc:text='\n\f\n'.join(page.get_text() for page in doc);pages=len(doc)
ep=a.CACHE/'extracted'/(a.sha(p.read_bytes())+'.fitz.txt');ep.write_text(text,encoding='utf-8')
row.update(source_url=detail['pdf_url'],source_material_status='source_original_obtained_damaged_ocr',comparison_status='damaged_original_ocr_facsimile_required',original=original(p,detail['pdf_url'],detail,'Archived official DRS doc695/version1887 catalogue, original3-page Gazette, and current official PakistanCode HTML DRS link agree.',pages,ep,text,drs_document_id=695,drs_version_id=1887,drs_metadata_path=str(drs/'document_details.json'),drs_metadata_sha256=a.sha((drs/'document_details.json').read_bytes()),current_official_html_sha256=a.sha(html.read_bytes())))
row['comparison']={'method':'Original3-page Gazette identity and archive bytes checked. Damaged source OCR is not a complete or accurate reading transcription. The complete original facsimile supplies the reading edition.','legacy_ocr_checked':False,'original_pages':3}
row['notes']=['The DRS original is3pages, Gazette17April1999, OrdinanceIIIof1999. The archived source OCR contains visible recognition errors; it remains separately retained. All3original pages are published through the complete original facsimile.','Section1(3) states a two-year duration in the original. Current force and any subsequent continuation/replacement require separate legal research.']
save(id,row);print('MARRIAGE_ORIGINAL_IDENTIFIED',pages,flush=True)

# The ECP volume contains the complete Act range. It is NOT silently treated as
# the same electronic transcription/version as the old held2002 text.
id='pk-code-4ff23b094ca55ea4';row=report['records'][id];law=a.readjson(a.ROOT/'landing-pages/qanun-maps/laws'/(id+'.json'))
p=a.CACHE/'originals/representation-1976.pdf';receipt=a.readjson(p.with_suffix('.receipt.json'))
with fitz.open(p) as doc:text='\n\f\n'.join(doc[i].get_text() for i in range(106,165));pages=len(doc)
ep=a.CACHE/'extracted'/(receipt['sha256']+'.act-pages107-165.fitz.txt');ep.write_text(text,encoding='utf-8')
status,proof,diff=a.comparison(text,law['text']);a.writejson(a.CACHE/'differences'/(id+'.ecp.json'),diff)
row.update(source_url=receipt['final_url'],source_material_status='original_edition_obtained',comparison_status=status,original=original(p,receipt['final_url'],receipt,'Official ECP Election Laws VolumeI identifies ActLXXXVof1976; Actbody bounded by its printed131–189 pages and next separate1977Rules title.',pages,ep,text,selected_physical_pages=list(range(107,166)),selected_printed_pages=[131,189],selected_act_pages=59),comparison=proof)
row['notes']=['Official ECP original publication281pages obtained; Actbody is physical107–165, printed131–189,59pages. The1977Rules begin physical166 and are excluded from this Act selection.','The ECP text layer has OCR defects and footnote-placement differences. The clean held2002amended compilation has not been certified by an exact text match. A complete source-image reading of the selected Actrange is required if no exact electronic source is found.','Separately located DRS doc1224/version3075 is the original04January1977 Gazette,35image-only pages printed22–56; it is not the held2002consolidation.']
save(id,row);a.writejson(a.HERE/'representation-source-selection.json',{'record_id':id,'original':row['original'],'comparison':proof,'comparison_status':status,'next_publication_starts_physical_page':166})
print('REPRESENTATION_ORIGINAL_RANGE_IDENTIFIED',status,'physical107-165',flush=True)
statuses={}
for row in report['records'].values():statuses[row['comparison_status']]=statuses.get(row['comparison_status'],0)+1
report['summary']['statuses']=statuses;report['summary']['originals_obtained']=sum(bool(x.get('original')) for x in report['records'].values());report['audited_at']=a.now();a.writejson(a.REPORT,report)
print(json.dumps(statuses),flush=True)
