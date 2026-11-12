"""Render only the source officer's reviewed physical-page inventory; no OCR or transcription."""
import json,hashlib,re,sys
from pathlib import Path
import fitz

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
INVENTORY=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'tools/qanun-library/sources/source-supplement-inventory.json'
OUT=HERE/'supplement-assets';OUT.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
snapshot=INVENTORY.read_bytes();inventory=json.loads(snapshot.decode('utf-8-sig'))
audit=json.loads((ROOT/'tools/qanun-library/sources/source-verification.json').read_text(encoding='utf-8-sig'))
old=json.loads((OUT/'manifest.json').read_text(encoding='utf-8')) if (OUT/'manifest.json').exists() else {'records':[]}
prior={r['id']:r for r in old['records']};rows=[]
full_facsimiles={r['id'] for r in json.loads((HERE/'facsimiles/manifest.json').read_text(encoding='utf-8'))['records']}
for item in inventory['records']:
 rid=item['id'];assert re.fullmatch('[a-z0-9-]+',rid) and rid not in full_facsimiles
 record=json.loads((ROOT/'landing-pages/qanun-maps/laws'/f'{rid}.json').read_text(encoding='utf-8-sig'))
 assert sha(record['text'].encode('utf-8'))==record['text_sha256'],rid+' archived record hash mismatch'
 status=audit['records'][rid];assert status['original']['sha256']==item['original_pdf_sha256'],rid+' audit PDF binding mismatch'
 trusted={record['text_sha256'],status['stored_text_sha256']}
 if status.get('comparison',{}).get('corrected_reading_text_sha256'):trusted.add(status['comparison']['corrected_reading_text_sha256'])
 needed={item['input_text_sha256']}|set(item.get('accepted_input_text_sha256',[]))
 if not needed<=trusted:
  # The private audit preserves legacy differences; repaired reading text is the complete independent extraction.
  # Match the source officer's logical LF hash, changing CRLF only, never another character or whitespace.
  original=status['original'];extracted=Path(original['extracted_text_path']).read_bytes().decode('utf-8').replace('\r\n','\n')
  extraction_sha=sha(extracted.encode('utf-8'));assert extraction_sha==original['extracted_text_sha256'],rid+' independent extraction proof mismatch'
  trusted.add(extraction_sha)
 assert item['input_text_sha256'] in trusted,rid+' inventory input binding mismatch'
 assert set(item.get('accepted_input_text_sha256',[]))<=trusted,rid+' unbound accepted reading input'
 accepted=sorted(trusted)
 source=Path(item['original_pdf_path']);data=source.read_bytes();assert sha(data)==item['original_pdf_sha256'],rid+' original PDF hash mismatch'
 pages=item['selected_physical_pages'];assert pages and pages==sorted(set(pages)) and all(isinstance(p,int) and 1<=p<=item['original_pdf_page_count'] for p in pages)
 dest=OUT/rid;dest.mkdir(exist_ok=True);original=dest/'original.pdf'
 if not original.exists() or sha(original.read_bytes())!=item['original_pdf_sha256']:original.write_bytes(data)
 row={'id':rid,'title':record['title'],'input_text_sha256':item['input_text_sha256'],'accepted_input_text_sha256':accepted,'source_pdf_sha256':item['original_pdf_sha256'],'source_pdf_path':str(source),'source_pdf_bytes':len(data),'original_url':item['original_url'],'original_pdf_page_count':item['original_pdf_page_count'],'selected_physical_pages':pages,'source_inventory_sha256':sha(snapshot),'selection_review_basis':item['review_basis'],'render_method':'PyMuPDF full-page RGB, matrix 2x2 (144dpi), alpha=False, no clipping, no OCR','render_dpi':144,'pixel_format':'RGB','body_text_scope':'Original source images supplement extracted text; graphic/form content is not fully machine-transcribed or text-verified.','pages':[]}
 cached=prior.get(rid,{});cached_pages={p['source_page']:p for p in cached.get('pages',[])} if cached.get('source_pdf_sha256')==row['source_pdf_sha256'] and cached.get('render_dpi')==144 else {}
 with fitz.open(source) as doc:
  assert len(doc)==item['original_pdf_page_count']
  for physical in pages:
   name=f'source-page-{physical:05d}.png';file=dest/name;oldpage=cached_pages.get(physical)
   if oldpage and oldpage.get('pixel_sha256') and oldpage['asset']==name and file.exists() and sha(file.read_bytes())==oldpage['sha256']:
    pageinfo=oldpage
   else:
    page=doc[physical-1];pix=page.get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False);pix.save(file);b=file.read_bytes()
    pageinfo={'source_page':physical,'asset':name,'sha256':sha(b),'bytes':len(b),'width':pix.width,'height':pix.height,'pdf_page_rect':[float(v) for v in page.rect],'pixel_sha256':sha(pix.samples),'pixel_format':'RGB','channels':pix.n,'stride':pix.stride}
   row['pages'].append(pageinfo)
 row['page_count']=len(row['pages']);row['total_page_image_bytes']=sum(p['bytes'] for p in row['pages']);rows.append(row)
 print(json.dumps({'id':rid,'selected_pages':row['page_count'],'images_bytes':row['total_page_image_bytes'],'pdf_bytes':len(data)},ensure_ascii=True),flush=True)
 manifest={'schema_version':'legis-intel-original-source-supplements/1','status':'complete' if INVENTORY.read_bytes()==snapshot else 'inventory_changed_rerun_required','source_inventory_path':INVENTORY.relative_to(ROOT).as_posix(),'source_inventory_sha256':sha(snapshot),'verification_scope':'Reviewed original graphic/form/source pages rendered in full and hashed; original PDF bytes retained and hashed. PNG byte and raw RGB pixel hashes support independent source re-render comparison. No OCR or legal/current-force certification.','records':rows,'summary':{'records':len(rows),'selected_pages':sum(r['page_count'] for r in rows),'page_image_bytes':sum(r['total_page_image_bytes'] for r in rows),'pdf_bytes':sum(r['source_pdf_bytes'] for r in rows)}}
 manifest['source_inventory_review_summary']=inventory.get('summary',{})
 manifest['source_image_screening_complete']=bool(inventory.get('summary',{}).get('small_image_screening_complete',False))
 if len(rows)!=len(inventory['records']):manifest['status']='rendering'
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
assert manifest['status']=='complete','Source inventory changed during rendering; rerun to include new reviewed pages.'
print(json.dumps(manifest['summary']),flush=True)
