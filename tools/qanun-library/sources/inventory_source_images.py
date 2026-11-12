"""Inventory large images on every original page, regardless of OCR text size."""
import collections,concurrent.futures,json
from pathlib import Path
import fitz
import audit_sources as a

def large(page):
    area=page.rect.width*page.rect.height
    return [{'digest':im['digest'].hex(),'area_ratio':round((fitz.Rect(im['bbox'])&page.rect).get_area()/area,6),'bbox':[float(x) for x in im['bbox']],'width':im['width'],'height':im['height']} for im in page.get_image_info(hashes=True) if (fitz.Rect(im['bbox'])&page.rect).get_area()>=area*.35]
def one(item):
    id,original=item
    with fitz.open(original['path']) as doc:
        selected=original.get('selected_physical_pages') or list(range(1,len(doc)+1))
        images=[]
        for number in selected:
            found=large(doc[number-1])
            if found:images.append({'physical_page':number,'images':found})
        return {'id':id,'source_pages_examined':len(selected),'pages_with_large_images':images}
def main():
    report=a.readjson(a.REPORT);initial=a.readjson(a.HERE/'source-supplement-inventory.json');selected={r['id']:set(r['selected_physical_pages']) for r in initial['records']};hybrid=a.readjson(a.HERE/'hybrid-source-page-review.json')
    # These34 pages were actually visually reviewed: only native sparse contents
    # or repeal text plus decorative PakistanCode watermark, no omitted graphics.
    decorative=set()
    for row in hybrid['records']:
        remaining=[p['page'] for p in row['image_body_candidates'] if p['page'] not in selected.get(row['id'],set())]
        if not remaining:continue
        with fitz.open(row['original']) as doc:
            for n in remaining:decorative.update(i['digest'] for i in large(doc[n-1]))
    work=[(id,row['original']) for id,row in report['records'].items() if row.get('original') and Path(row['original']['path']).suffix.lower()=='.pdf']
    rows=[];done=0
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(one,item) for item in work]
        for f in concurrent.futures.as_completed(futures):
            rows.append(f.result());done+=1
            if done%250==0:print('Original-image inventory',done,'/',len(work),flush=True)
    counts=collections.Counter(i['digest'] for r in rows for p in r['pages_with_large_images'] for i in p['images'])
    candidates=[]
    full_facsimiles={r['id'] for r in a.readjson(a.ROOT/'tools/qanun-library/reader/facsimiles/manifest.json')['records']}|{'pk-code-a2f0a11f70fdf902'}
    for r in rows:
        if r['id'] in full_facsimiles:continue
        pages=[]
        for p in r['pages_with_large_images']:
            substantive=[i for i in p['images'] if i['digest'] not in decorative]
            if substantive:pages.append({'physical_page':p['physical_page'],'images':substantive})
        if pages:candidates.append({'id':r['id'],'pages':pages})
    summary={'source_records_examined':len(rows),'original_pages_examined':sum(r['source_pages_examined'] for r in rows),'records_with_large_images':sum(bool(r['pages_with_large_images']) for r in rows),'pages_with_large_images':sum(len(r['pages_with_large_images']) for r in rows),'decorative_image_digests_visually_reviewed':len(decorative),'non_facsimile_records_with_non_decorative_large_images':len(candidates),'non_facsimile_pages_with_non_decorative_large_images':sum(len(r['pages']) for r in candidates)}
    a.writejson(a.HERE/'all-source-image-inventory.json',{'summary':summary,'decorative_image_digests':sorted(decorative),'large_image_digest_frequencies':dict(counts),'records':rows,'non_decorative_candidates':candidates})
    print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
