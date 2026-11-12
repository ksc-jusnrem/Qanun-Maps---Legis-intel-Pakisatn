"""Complete original-image coverage, including images below35% page area."""
import concurrent.futures,json
from pathlib import Path
import fitz
import audit_sources as a

def one(item):
    id,original=item;out=[]
    with fitz.open(original['path']) as doc:
        selected=original.get('selected_physical_pages') or list(range(1,len(doc)+1))
        for n in selected:
            p=doc[n-1];area=p.rect.get_area();infos=p.get_image_info(hashes=False)
            if not any(0<(fitz.Rect(im['bbox'])&p.rect).get_area()<area*.35 for im in infos):continue
            small=[]
            for im in p.get_image_info(hashes=True):
                ratio=(fitz.Rect(im['bbox'])&p.rect).get_area()/area
                if 0<ratio<.35:small.append({'digest':im['digest'].hex(),'area_ratio':round(ratio,7),'bbox':[float(x) for x in im['bbox']],'width':im['width'],'height':im['height']})
            if small:out.append({'physical_page':n,'images':small})
        return {'id':id,'source_pages_examined':len(selected),'pages_with_small_images':out}
def main():
    report=a.readjson(a.REPORT);work=[(id,row['original']) for id,row in report['records'].items() if row.get('original') and Path(row['original']['path']).suffix.lower()=='.pdf'];rows=[];done=0
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(one,item) for item in work]
        for f in concurrent.futures.as_completed(futures):
            rows.append(f.result());done+=1
            if done%250==0:print('Small-image inventory',done,'/',len(work),flush=True)
    summary={'source_records_examined':len(rows),'source_pages_examined':sum(r['source_pages_examined'] for r in rows),'records_with_small_images':sum(bool(r['pages_with_small_images']) for r in rows),'pages_with_small_images':sum(len(r['pages_with_small_images']) for r in rows),'unique_small_image_digests':len({i['digest'] for r in rows for p in r['pages_with_small_images'] for i in p['images']})}
    a.writejson(a.HERE/'all-source-small-image-inventory.json',{'summary':summary,'records':rows});print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
