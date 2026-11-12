import json, hashlib, re
from pathlib import Path
import fitz
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
coverage=json.loads((OUT.parent/'coverage.json').read_text(encoding='utf-8'))
ids=[r['id'] for r in coverage['records'] if r['status']=='paragraph_source_transcription']
def stream(s):return re.sub(r'\s','',s)
def diff(a,b):
    n=next((i for i,(x,y) in enumerate(zip(a,b)) if x!=y),min(len(a),len(b)))
    return {'position':n,'legacy':a[max(0,n-40):n+90],'extracted':b[max(0,n-40):n+90],'lengths':[len(a),len(b)]}
results=[]
for id in ids:
    record=json.loads((ROOT/'landing-pages/qanun-maps/laws'/f'{id}.json').read_text(encoding='utf-8'))
    result=json.loads((ROOT/'tools/qanun-library/sources/cache/results'/f'{id}.json').read_text(encoding='utf-8'))
    original=result.get('original') or {}
    row={'id':id,'title':record['title'],'comparison_status':result.get('comparison_status'),'original':original,'methods':[]}
    pdf=original.get('path')
    if not pdf or not Path(pdf).exists():results.append(row);print(json.dumps({'id':id,'error':'original unavailable'}));continue
    methods=[]
    with fitz.open(pdf) as doc:
        methods.append(('fitz-original','\n\n'.join(p.get_text('text') for p in doc)))
        methods.append(('fitz-sorted','\n\n'.join(p.get_text('text',sort=True) for p in doc)))
        blocks=[]
        for p in doc:
            blocks.append('\n\n'.join(b[4] for b in sorted(p.get_text('blocks'),key=lambda b:(round(b[1],1),b[0])) if len(b)>4))
        methods.append(('fitz-blocks-geometric','\n\n'.join(blocks)))
    try:
        reader=PdfReader(pdf)
        methods.append(('pypdf-plain','\n\n'.join(p.extract_text() or '' for p in reader.pages)))
        methods.append(('pypdf-layout','\n\n'.join(p.extract_text(extraction_mode='layout') or '' for p in reader.pages)))
    except Exception as e:row['pypdf_error']=str(e)
    raw=stream(record.get('text',''))
    (OUT/'candidates'/id).mkdir(parents=True,exist_ok=True)
    for method,text in methods:
        p=OUT/'candidates'/id/f'{method}.txt';p.write_text(text,encoding='utf-8')
        got=stream(text);entry={'method':method,'path':str(p),'literal_stream_equal':raw==got,'characters':len(text),'non_whitespace_characters':len(got),'difference':None if raw==got else diff(raw,got)}
        row['methods'].append(entry)
    results.append(row)
    print(json.dumps({'id':id,'title':record['title'],'methods':[{k:m[k] for k in ['method','literal_stream_equal','characters','difference']} for m in row['methods']]},ensure_ascii=True),flush=True)
(OUT/'probe-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
