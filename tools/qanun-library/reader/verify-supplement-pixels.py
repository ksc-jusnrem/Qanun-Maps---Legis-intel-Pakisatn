"""Independently re-render selected original PDF pages and compare decoded published PNG pixels."""
import json,hashlib
from pathlib import Path
import fitz
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];ASSETS=HERE/'supplement-assets'
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(ASSETS/'manifest.json').read_bytes();manifest=json.loads(raw)
assert manifest['status']=='complete'
assert sha((ROOT/manifest['source_inventory_path']).read_bytes())==manifest['source_inventory_sha256'],'Source inventory changed'
rows=[]
for r in manifest['records']:
 source=Path(r['source_pdf_path']);assert sha(source.read_bytes())==r['source_pdf_sha256']
 assert sha((ASSETS/r['id']/'original.pdf').read_bytes())==r['source_pdf_sha256']
 with fitz.open(source) as doc:
  assert len(doc)==r['original_pdf_page_count']
  for p in r['pages']:
   page=doc[p['source_page']-1];pix=page.get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False)
   pngpath=ASSETS/r['id']/p['asset'];assert sha(pngpath.read_bytes())==p['sha256'];decoded=fitz.Pixmap(str(pngpath))
   assert pix.n==decoded.n==3 and not pix.alpha and not decoded.alpha
   assert pix.width==decoded.width==p['width'] and pix.height==decoded.height==p['height']
   assert [float(v) for v in page.rect]==p['pdf_page_rect']
   assert sha(pix.samples)==p['pixel_sha256']==sha(decoded.samples),'Original page pixels differ from PNG '+r['id']+':'+str(p['source_page'])
   rows.append({'id':r['id'],'source_page':p['source_page'],'original_pdf_sha256':r['source_pdf_sha256'],'png_sha256':p['sha256'],'independent_original_render_pixel_sha256':sha(pix.samples),'decoded_png_pixel_sha256':sha(decoded.samples),'matched':True})
 print(json.dumps({'id':r['id'],'verified_original_pages':len(r['pages'])}),flush=True)
assert (ASSETS/'manifest.json').read_bytes()==raw,'Supplement manifest changed during independent pixel verification; rerun'
assert sha((ROOT/manifest['source_inventory_path']).read_bytes())==manifest['source_inventory_sha256'],'Source inventory changed during pixel verification; regenerate assets and rerun'
result={'manifest_sha256':sha(raw),'source_inventory_sha256':manifest['source_inventory_sha256'],'scope':'Independent invocation re-rendered original PDF physical pages as RGB144dpi without clipping and compared every decoded PNG pixel; no OCR/transcription/current-force assertion.','records':len(manifest['records']),'pages':len(rows),'all_pixels_match':True,'results':rows}
(ASSETS/'pixel-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='results'}),flush=True)
