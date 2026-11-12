import json,hashlib
from pathlib import Path
import fitz
folder=Path(__file__).resolve().parent;root=folder.parents[3]
rid='pk-code-4ff23b094ca55ea4'
record=json.loads((root/'landing-pages/qanun-maps/laws'/f'{rid}.json').read_text(encoding='utf-8'))
pdf=root/'tools/qanun-library/sources/cache/originals/representation-1976.pdf'
sha=lambda b:hashlib.sha256(b).hexdigest()
data=pdf.read_bytes();assert sha(data)=='b6bcc8ac12aae0be36be00073f74de2d45698d01ba7cd12bf92023230c07aca8'
assert sha(record['text'].encode('utf-8'))==record['text_sha256']
dest=folder/rid;dest.mkdir(exist_ok=True);(dest/'original.pdf').write_bytes(data)
row={'id':rid,'title':record['title'],'input_text_sha256':record['text_sha256'],'source_pdf_sha256':sha(data),'source_pdf_path':str(pdf),'original_url':'https://ecp.gov.pk/storage/files/1/eleclaws18.pdf','source_material_status':'official_original_volume_obtained_selected_act_pages_rendered','body_text_status':'different_source_edition_prefer_official_facsimile_legacy_2002_unverified','render_method':'PyMuPDF complete-page RGB raster, matrix 2x2 (144dpi), alpha=False; selected physical PDF pages 107–165 inclusive rendered without clipping or OCR','asset_directory':dest.relative_to(root).as_posix(),'pdf_asset':'original.pdf','pages':[],'source_pdf_page_count':281,'source_page_start':107,'source_page_end':165,'printed_page_start':131,'printed_page_end':189,'selected_act_scope':'All 59 selected pages of the Representation of the People Act, 1976 in the held ECP election-law volume: physical PDF pages 107–165, printed pages 131–189. The untouched download is the complete 281-page ECP volume. This source edition differs from the archived 2002 compilation; identity of provisions across editions and current consolidation have not been certified.','reading_quality_note':'Read the selected Act pages from this official ECP source edition. The separate archived text identifies a 2002 compilation and has not been verified against this different edition; it is retained for provenance only. No current consolidation, later-amendment completeness or current legal force is certified.'}
row['original_pdf_page_count']=281
row['source_edition_note']='The displayed Act is the edition held in the official ECP election-law volume eleclaws18.pdf. It is a different source edition from the archived 2002 compilation, whose text has not been verified against this facsimile. No claim is made that either is a current consolidation or has current legal force.'
with fitz.open(pdf) as doc:
 assert len(doc)==281
 row['page_count']=59
 for physical in range(107,166):
  page=doc[physical-1];i=physical-106;name=f'page-{i:03d}.png';target=dest/name
  pix=page.get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False);pix.save(target);b=target.read_bytes()
  row['pages'].append({'page':i,'source_page':physical,'printed_page':physical+24,'asset':name,'sha256':sha(b),'bytes':len(b),'width':pix.width,'height':pix.height,'pdf_page_rect':[float(v) for v in page.rect]})
  if i%10==0:print(json.dumps({'rendered_selected_pages':i,'total':59}),flush=True)
row['total_page_image_bytes']=sum(p['bytes'] for p in row['pages'])
manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'));manifest['records']=[r for r in manifest['records'] if r['id']!=rid]+[row]
manifest['verification_scope']='Original PDF bytes hashed; complete original pages or explicitly selected Act page ranges rendered without clipping and each image hashed. Archived text/OCR, where present, is not editorially verified against a different edition. Selected proposition evidence is separately recorded.'
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'id':rid,'input_text_sha256':row['input_text_sha256'],'source_pdf_sha256':row['source_pdf_sha256'],'selected_act_pages':59,'source_pdf_pages':281,'image_bytes':row['total_page_image_bytes']}),flush=True)
