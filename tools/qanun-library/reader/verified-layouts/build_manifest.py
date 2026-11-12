import json,hashlib,re
from pathlib import Path
import fitz

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[3]
probes=json.loads((OUT/'probe-results.json').read_text(encoding='utf-8'))
def sha(b):return hashlib.sha256(b).hexdigest()
def stream(s):return re.sub(r'\s','',s)
rows=[]
for row in probes:
    id=row['id']; record=json.loads((ROOT/'landing-pages/qanun-maps/laws'/f'{id}.json').read_text(encoding='utf-8'))
    original=row['original']; pdf=Path(original['path']); actual_pdf_sha=sha(pdf.read_bytes())
    if actual_pdf_sha!=original['sha256']:raise ValueError('Original PDF hash changed: '+id)
    method=next(m for m in row['methods'] if m['method']=='fitz-original' and m['literal_stream_equal'])
    data=Path(method['path']).read_bytes(); text=data.decode('utf-8'); raw=stream(record['text'])
    if stream(text)!=raw:raise ValueError('Literal full character stream mismatch: '+id)
    dest=OUT/'layouts'/f'{id}.txt';dest.parent.mkdir(exist_ok=True);dest.write_bytes(data)
    with fitz.open(pdf) as doc:
        pages=[{'page':i+1,'extracted_non_whitespace_characters':len(stream(p.get_text('text'))),'images':len(p.get_images(full=True))} for i,p in enumerate(doc)]
    low_text_image_pages=[p['page'] for p in pages if p['images'] and p['extracted_non_whitespace_characters']<100]
    incomplete_image_body=len(pages)>4 and len(low_text_image_pages)>len(pages)/2
    rows.append({'id':id,'title':record['title'],'input_text_sha256':record['text_sha256'],'layout_path':dest.relative_to(ROOT).as_posix(),'layout_sha256':sha(data),'layout_characters':len(text),'non_whitespace_characters':len(raw),'literal_non_whitespace_sha256':sha(raw.encode('utf-8')),'literal_stream_equal':True,'comparison_method':'Exact full non-whitespace character equality; no NFKC, case folding, quote equivalence, soft-hyphen removal or punctuation substitution.','original_pdf_path':str(pdf),'original_pdf_sha256':actual_pdf_sha,'original_url':original.get('url'),'recorded_detail_url':original.get('recorded_detail_url'),'original_retrieval_date':original.get('retrieved_at'),'extraction_method':'PyMuPDF page.get_text("text"), original content order; page texts joined by two newlines.','pages':pages,'low_text_image_pages':low_text_image_pages,'reading_status':'text_layer_incomplete_image_body_requires_source_image_reader_or_verified_OCR' if incomplete_image_body else 'source_derived_readable_layout','source_completeness_note':'The text layer does not expose most image pages. Exact character-stream matching is not complete statute-body verification.' if incomplete_image_body else 'Layout verified against complete held text character stream; legal force and later amendments remain separate.'})
manifest={'schema_version':'legis-intel-source-reading-layouts/1','scope':'Eight paragraph-only fallback records identified by prior complete reader scan','accepted':len(rows),'readable_text_layouts':sum(r['reading_status']=='source_derived_readable_layout' for r in rows),'image_body_exceptions':[r['id'] for r in rows if r['reading_status']!='source_derived_readable_layout'],'nonmatches':[],'records':rows}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'accepted':len(rows),'records':[{'id':r['id'],'pages':r['pages'],'layout_path':r['layout_path']} for r in rows]},ensure_ascii=True))
