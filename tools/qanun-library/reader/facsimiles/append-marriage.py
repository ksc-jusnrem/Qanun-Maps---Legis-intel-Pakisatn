import json,hashlib
from pathlib import Path
import fitz
folder=Path(__file__).resolve().parent
root=folder.parents[3]
rid='pk-code-c02eccd95b859b79'
record=json.loads((root/'landing-pages/qanun-maps/laws'/f'{rid}.json').read_text(encoding='utf-8'))
pdf=Path('D:/Qanun Maps/PK-LaC/PK-LAC-  Law as Code Project/annexes/drs-molaw-corpus/pdfs/695_1887_Document_History_-_The_Marriage_Functions_(Ostentatious_Displays)_Ordinance,_1999.pdf')
sha=lambda b:hashlib.sha256(b).hexdigest()
data=pdf.read_bytes();dest=folder/rid;dest.mkdir(exist_ok=True)
assert sha(record['text'].encode('utf-8'))==record['text_sha256']
(dest/'original.pdf').write_bytes(data)
row={'id':rid,'title':record['title'],'input_text_sha256':record['text_sha256'],'source_pdf_sha256':sha(data),'source_pdf_path':str(pdf),'original_url':'https://drs.molaw.gov.pk/documents/document-versions?docId=695&versionId=1887','source_material_status':'original_file_obtained_all_pages_rendered','body_text_status':'damaged_source_OCR_not_corrected_prefer_original_facsimile','render_method':'PyMuPDF complete-page RGB raster, matrix 2x2 (144dpi), alpha=False; no clipping or OCR','asset_directory':dest.relative_to(root).as_posix(),'pdf_asset':'original.pdf','pages':[],'reading_quality_note':'Original Gazette dated 17 April 1999. Archived OCR is visibly garbled and is preserved separately; original facsimile is the primary reader. No subsequent amendments or current legal force certified.'}
with fitz.open(pdf) as doc:
 row['page_count']=len(doc)
 assert len(doc)==3
 for i,page in enumerate(doc):
  name=f'page-{i+1:03d}.png';target=dest/name;pix=page.get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False);pix.save(target);b=target.read_bytes();row['pages'].append({'page':i+1,'asset':name,'sha256':sha(b),'bytes':len(b),'width':pix.width,'height':pix.height,'pdf_page_rect':[float(v) for v in page.rect]})
row['total_page_image_bytes']=sum(p['bytes'] for p in row['pages'])
manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'));manifest['records']=[r for r in manifest['records'] if r['id']!=rid]+[row]
manifest['verification_scope']='Original PDF bytes hashed; all pages rendered without clipping and each image hashed. Archived OCR, where present, is not editorially verified body text. Selected proposition evidence is separately recorded.'
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'id':rid,'source_pdf_sha256':row['source_pdf_sha256'],'page_count':row['page_count'],'image_bytes':row['total_page_image_bytes']}))
