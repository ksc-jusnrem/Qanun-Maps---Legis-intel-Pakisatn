import json,hashlib,shutil
from pathlib import Path
import fitz

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[3]
layout_manifest=json.loads((OUT.parent/'verified-layouts/manifest.json').read_text(encoding='utf-8'))
ids=layout_manifest['image_body_exceptions']
def sha(data):return hashlib.sha256(data).hexdigest()
rows=[]
for item in layout_manifest['records']:
    if item['id'] not in ids:continue
    id=item['id'];pdf=Path(item['original_pdf_path']);data=pdf.read_bytes()
    if sha(data)!=item['original_pdf_sha256']:raise ValueError('Source PDF hash mismatch: '+id)
    dest=OUT/id;dest.mkdir(parents=True,exist_ok=True);(dest/'original.pdf').write_bytes(data)
    row={'id':id,'title':item['title'],'input_text_sha256':item['input_text_sha256'],'source_pdf_sha256':item['original_pdf_sha256'],'source_pdf_path':str(pdf),'original_url':item['original_url'],'source_material_status':'original_file_obtained_all_pages_rendered','body_text_status':'image_body_not_machine_transcribed_or_full_text_checked','render_method':'PyMuPDF complete-page RGB raster, matrix 2x2 (144dpi), alpha=False; no clipping or OCR','asset_directory':dest.relative_to(ROOT).as_posix(),'pdf_asset':'original.pdf','pages':[]}
    print(json.dumps({'id':id,'source_path':str(pdf),'source_pdf_sha256':row['source_pdf_sha256']},ensure_ascii=True),flush=True)
    with fitz.open(pdf) as doc:
        row['page_count']=len(doc)
        for i,page in enumerate(doc):
            name=f'page-{i+1:03d}.png';path=dest/name;pix=page.get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False);pix.save(path)
            b=path.read_bytes();row['pages'].append({'page':i+1,'asset':name,'sha256':sha(b),'bytes':len(b),'width':pix.width,'height':pix.height,'pdf_page_rect':[float(v) for v in page.rect]})
            if (i+1)%10==0:print(json.dumps({'id':id,'rendered_pages':i+1,'total':len(doc)}),flush=True)
    row['total_page_image_bytes']=sum(p['bytes'] for p in row['pages'])
    rows.append(row)
previous=json.loads((OUT/'manifest.json').read_text(encoding='utf-8')) if (OUT/'manifest.json').exists() else {'records':[]}
rows += [r for r in previous['records'] if r['id'] not in ids]
manifest={'schema_version':'legis-intel-original-facsimiles/1','records':rows,'verification_scope':'Original PDF bytes hashed; all pages rendered without clipping and each image hashed. Archived OCR, where present, is not editorially verified body text. Selected proposition evidence is separately recorded.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'facsimiles':len(rows),'page_images':sum(r['page_count'] for r in rows),'image_bytes':sum(r['total_page_image_bytes'] for r in rows)}),flush=True)
