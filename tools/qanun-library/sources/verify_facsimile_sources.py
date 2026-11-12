"""Independently re-render displayed original pages and compare full pixels."""
import json,fitz
import audit_sources as a
base=a.ROOT/'tools/qanun-library/reader/facsimiles';manifest=a.readjson(base/'manifest.json');count=0
for record in manifest['records']:
    row=a.readjson(a.CACHE/'results'/(record['id']+'.json'));original=row['original'];pdf=base/record['id']/'original.pdf';data=pdf.read_bytes()
    assert a.sha(data)==record['source_pdf_sha256']==original['sha256'],record['id']
    assert original['identity_checked']
    with fitz.open(pdf) as doc:
        assert len(doc)==original['pages'],(record['id'],'original page count')
        selected=original.get('selected_physical_pages') or list(range(1,len(doc)+1))
        assert len(record['pages'])==record['page_count']==len(selected)
        for n,p in enumerate(record['pages']):
            source_page=p.get('source_page',n+1);assert source_page==selected[n],(record['id'],'page selection/order')
            png=base/record['id']/p['asset'];assert a.sha(png.read_bytes())==p['sha256']
            image=fitz.Pixmap(png);expected=doc[source_page-1].get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False)
            assert image.width==expected.width==p['width'] and image.height==expected.height==p['height']
            assert a.sha(image.samples)==a.sha(expected.samples),(record['id'],source_page,'source pixels differ')
            count+=1
print(json.dumps({'original_facsimiles':len(manifest['records']),'original_pages_pixel_verified':count}),flush=True)
print('SOURCE_FACSIMILE_PIXELS_PASSED',flush=True)
