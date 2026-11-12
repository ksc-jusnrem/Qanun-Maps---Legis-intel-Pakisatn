"""Acquire observed official consolidated PDFs to resolve an edition conflict."""
from pathlib import Path
import json,re,requests,fitz
import audit_sources as a
URLS=[
 'https://bra.gob.pk/NewsDirectory/Downloads/BSTSACT2015.pdf',
 'https://bra.gob.pk/NewsDirectory/Downloads/BRA_ACT_2015.pdf',
 'https://ebra.com.pk/storage/uploads/downloads/1715239265.pdf',
]
record=a.readjson(a.ROOT/'landing-pages/qanun-maps/laws/balochistan-code-d9d838bd66607fd9.json')
out=[]
for n,url in enumerate(URLS):
    try:
        response=requests.get(url,timeout=40,headers={'User-Agent':'Mozilla/5.0 LegisIntelSourceAudit/1.0'})
        response.raise_for_status()
        if not response.content.startswith(b'%PDF'):raise ValueError('Response is not a PDF')
        p=a.CACHE/'originals'/('balochistan-candidate-'+str(n)+'.pdf');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(response.content)
        receipt={'requested_url':url,'final_url':response.url,'retrieved_at':a.now(),'sha256':a.sha(response.content),'http_status':response.status_code}
        a.writejson(p.with_suffix('.receipt.json'),receipt)
        with fitz.open(p) as doc:source='\n\f\n'.join(page.get_text() for page in doc);pages=len(doc)
        status,proof,differences=a.comparison(source,record['text'])
        sourcepath=a.CACHE/'extracted'/(receipt['sha256']+'.fitz.txt');sourcepath.write_text(source,encoding='utf-8')
        entry={'url':url,'path':str(p),'pages':pages,'status':status,'comparison':proof,'receipt':receipt,'extracted_text_path':str(sourcepath),'first_difference':differences[:2]}
        out.append(entry);print(json.dumps({k:v for k,v in entry.items() if k not in ['comparison','first_difference']},ensure_ascii=False),flush=True)
    except Exception as e:
        out.append({'url':url,'error':str(e)});print(url,str(e),flush=True)
a.writejson(a.HERE/'balochistan-original-candidates.json',out)
