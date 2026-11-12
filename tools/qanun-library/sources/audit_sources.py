"""Compare each held law with a separately identified official source artifact.

Original bytes and extraction are cached privately. No law JSON is modified.
Whitespace-only agreement is not current-law certification. A comparison with
material differences remains unresolved, even where a similarity score is high.
"""
from __future__ import annotations
import argparse, concurrent.futures, datetime, difflib, hashlib, json, os, re, sys, unicodedata,uuid
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
CACHE=HERE/'cache'
REPORT=HERE/'source-verification.json'
FED=Path(r'D:\Qanun Maps\pakistan-code-corpus')
PROV=Path(r'D:\Qanun Maps\Pk-LaC-RaC-All Laws - Fed-Provincial\provincial-law-agents')
ANNEXES=Path(r'D:\Qanun Maps\PK-LaC\PK-LAC-  Law as Code Project\annexes')
def sha(b): return hashlib.sha256(b).hexdigest()
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def readjson(p):
    try:return json.loads(Path(p).read_text(encoding='utf-8-sig'))
    except (OSError,ValueError):return None
def writejson(p,d):
    p.parent.mkdir(parents=True,exist_ok=True)
    temp=p.with_suffix(p.suffix+'.'+uuid.uuid4().hex+'.tmp');temp.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(p)
def titlekey(s):
    s=unicodedata.normalize('NFKC',s).lower().replace('’',"'")
    s=re.sub(r'[^\w\s]',' ',s);s=re.sub(r'^the\s+','',s)
    return re.sub(r'\s+',' ',s).strip()
def urlkey(s):return unquote(s or '').rstrip('/')
def norm(s):
    # Preserve spelling, digits and punctuation; collapse extraction whitespace
    # and known typography equivalents only. No OCR guessing.
    s=re.sub(r'(?m)^[ \t]*={5}[ \t]*PDF[ \t]+PAGE[ \t]+\d+[ \t]*={5}[ \t\r]*$','',s)
    s=unicodedata.normalize('NFKC',s).replace('\ufeff','').replace('\u00ad','')
    s=s.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"')
    return re.sub(r'\s+',' ',s).strip()
def words(s):return re.findall(r'\w+|[^\w\s]',norm(s),re.UNICODE)
def relocate(value):
    p=Path(value)
    if p.exists():return p
    s=str(value).replace('\\','/')
    for marker,base in [('provincial-law-agents/',PROV),('pakistan-code-corpus/',FED)]:
        if marker in s:
            candidate=base/Path(s.split(marker,1)[1])
            if candidate.exists():return candidate
    for corpus in ['punjab-code-corpus','kp-code-corpus','balochistan-code-corpus','sindh-laws-corpus','drs-molaw-corpus']:
        marker=corpus+'/'
        if marker in s:
            candidate=ANNEXES/corpus/Path(s.split(marker,1)[1])
            if candidate.exists():return candidate
    return None
def docs(d):
    if isinstance(d,list):return d
    if isinstance(d,dict):
        for key in ['documents','items','laws','records','results']:
            if isinstance(d.get(key),list):return d[key]
    return []
def load_catalogs():
    candidates=[]
    fed_details=docs(readjson(FED/'law_details.json'))
    fed_by_pdf={u:d for d in fed_details for u in d.get('pdf_urls',[])}
    for p in [FED/'catalog.json',FED/'law_details.json',FED/'law_detail_manifest.json',FED/'pdf_manifest.json']:
        d=readjson(p)
        for x in docs(d): candidates.append((x,p))
    # Federal metadata files identify downloaded official PDFs independently.
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        paths=list((FED/'meta').glob('*.json'))
        for p,d in zip(paths,ex.map(readjson,paths)):
            if isinstance(d,dict) and d.get('title'):
                detail=fed_by_pdf.get(d.get('pdf_url'))
                if detail:d={**d,'official_url':detail.get('url'),'detail_fetched_at':detail.get('fetched_at'),'detail_html_path':detail.get('html_file')}
                candidates.append((d,p))
    # Read only catalogues, not all output records; this is intentionally bounded.
    for base in [PROV/'corpus',PROV/'data',PROV/'out'/'corpus',PROV/'out'/'law-library',PROV/'out'/'agents',PROV/'out']:
        if not base.exists():continue
        for p in base.glob('*/catalog.json'):
            for x in docs(readjson(p)):candidates.append((x,p))
        for p in base.glob('catalog*.json'):
            for x in docs(readjson(p)):candidates.append((x,p))
    for corpus in ['punjab-code-corpus','kp-code-corpus','balochistan-code-corpus','sindh-laws-corpus']:
        p=ANNEXES/corpus/'catalog.json'
        for x in docs(readjson(p)):candidates.append((x,p))
    index={}
    for d,p in candidates:
        if not isinstance(d,dict):continue
        title=d.get('title') or d.get('name')
        if not title:continue
        index.setdefault(titlekey(title),[]).append((d,p))
        for key in ['official_url','source_url','detail_url','url']:
            if d.get(key):index.setdefault('url:'+urlkey(d[key]),[]).append((d,p))
    return index
def resolve_candidate(r,index):
    cs=index.get('url:'+urlkey(r.get('source_url')),[])+index.get(titlekey(r['title']),[])
    answer=[]
    for d,mp in cs:
        url=d.get('official_url') or d.get('source_url') or d.get('detail_url') or d.get('url')
        pdfurl=d.get('pdf_url') or d.get('final_url')
        for k in ['offline_pdf','local_pdf','pdf_path','path','offline_html','html_path']:
            value=d.get(k)
            if not isinstance(value,str):continue
            p=relocate(value)
            if not p and k=='path':
                pp=FED/value
                if pp.exists():p=pp
            if p and p.suffix.lower() in ['.pdf','.html','.htm']:
                direct=urlkey(url)==urlkey(r.get('source_url'))
                answer.append({'path':str(p),'url':pdfurl if p.suffix.lower()=='.pdf' else url,'detail_url':url,'metadata_path':str(mp),'metadata_sha256':sha(mp.read_bytes()),'metadata':d,'identity_basis':'official_catalogue_url_and_title' if direct else 'official_metadata_title_candidate'})
    # Multiple copies of the same artifact are one candidate, but materially
    # different artifacts are retained; comparison chooses only exact agreement.
    seen=set();out=[]
    for a in answer:
        key=a['path'].lower()
        if key not in seen:seen.add(key);out.append(a)
    return sorted(out,key=lambda x:(x['identity_basis']!='official_catalogue_url_and_title',not x['path'].endswith('.pdf')))
def extract(p,engine='fitz'):
    if p.suffix.lower()=='.pdf':
        if engine=='fitz':
            import fitz
            with fitz.open(p) as doc:return '\n\f\n'.join(page.get_text('text',sort=False) for page in doc),len(doc),'PyMuPDF text blocks (original order)'
        try:
            from pypdf import PdfReader
            reader=PdfReader(p);return '\n\f\n'.join(page.extract_text() or '' for page in reader.pages),len(reader.pages),'pypdf extract_text'
        except Exception:
            import fitz
            with fitz.open(p) as doc:return '\n\f\n'.join(page.get_text('text',sort=False) for page in doc),len(doc),'PyMuPDF text blocks (original order) fallback'
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(p.read_bytes(),'html.parser')
    for e in soup(['script','style','nav','header','footer']):e.decompose()
    # Original HTML remains available; only explicit article bodies are preferred.
    body=soup.select_one('.law-content, .article-content, #content, .content') or soup.body or soup
    return body.get_text('\n',strip=True),None,'HTML text extraction (body/article container)'
def comparison(source,stored):
    a,b=norm(source),norm(stored)
    out={'method':'NFKC, typography-equivalent quotation marks, soft-hyphen removal and whitespace normalization; full-text equality required','normalized_source_sha256':sha(a.encode()),'normalized_stored_sha256':sha(b.encode()),'source_chars':len(source),'stored_chars':len(stored),'normalized_source_chars':len(a),'normalized_stored_chars':len(b)}
    if a==b:return 'matched_original_normalized',out,[]
    # PDF text engines segment lines and even glyphs differently. This exact
    # character-stream test retains every non-whitespace character, numeral and
    # punctuation mark. It proves character fidelity, not word-boundary review.
    compact_a=re.sub(r'\s+','',a);compact_b=re.sub(r'\s+','',b)
    out['source_character_stream_sha256']=sha(compact_a.encode())
    out['stored_character_stream_sha256']=sha(compact_b.encode())
    if compact_a==compact_b:
        out['method']='Complete exact non-whitespace character stream after NFKC, quotation-mark equivalents and soft-hyphen removal. Word boundaries and PDF line-layout differences remain separately described.'
        return 'matched_original_character_stream',out,[]
    # Token comparison permits PDF line wrapping within words only as a separately
    # reported diagnostic. It never clears material differences automatically.
    aa,bb=words(source),words(stored)
    matcher=difflib.SequenceMatcher(None,aa,bb,autojunk=True)
    out['token_similarity']=round(matcher.ratio(),6)
    changes=[]
    for op,i,j,k,l in matcher.get_opcodes():
        if op!='equal':changes.append({'operation':op,'source_tokens':[i,j],'stored_tokens':[k,l],'source':' '.join(aa[i:j])[:1500],'stored':' '.join(bb[k:l])[:1500]})
    out['changed_token_groups']=len(changes)
    return 'material_difference_unresolved',out,changes
def fetch_original(r,timeout=20):
    import requests
    url=r.get('source_url')
    if not url:return None,'No official source URL recorded.'
    response=requests.get(url,timeout=timeout,headers={'User-Agent':'LegisIntelSourceAudit/1.0 (source fidelity research)'})
    response.raise_for_status()
    content=response.content;final=response.url
    if content.startswith(b'%PDF'):
        ext='.pdf'
    else:
        from bs4 import BeautifulSoup
        soup=BeautifulSoup(content,'html.parser')
        urls=[]
        for tag,attr in [('a','href'),('iframe','src'),('embed','src'),('object','data')]:
            for e in soup.find_all(tag):
                h=e.get(attr,'')
                if '.pdf' in h.lower():urls.append(urljoin(final,h))
        htmlpath=CACHE/'originals'/(r['id']+'.html');htmlpath.parent.mkdir(parents=True,exist_ok=True);htmlpath.write_bytes(content)
        writejson(htmlpath.with_suffix('.receipt.json'),{'requested_url':url,'final_url':final,'retrieved_at':now(),'sha256':sha(content),'http_status':response.status_code})
        if urls:
            pdf=requests.get(urls[0],timeout=timeout,headers={'User-Agent':'LegisIntelSourceAudit/1.0'})
            pdf.raise_for_status()
            if pdf.content.startswith(b'%PDF'):content=pdf.content;final=pdf.url;ext='.pdf'
            else:ext='.html'
        else:ext='.html'
    p=CACHE/'originals'/(r['id']+ext);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(content)
    receipt={'requested_url':url,'final_url':final,'retrieved_at':now(),'sha256':sha(content),'http_status':response.status_code}
    writejson(p.with_suffix('.receipt.json'),receipt)
    return {'path':str(p),'url':final,'detail_url':url,'identity_basis':'fetched_from_recorded_official_source_url','receipt':receipt},None
def process_record(r,index,online):
    id=r['id'];oldpath=CACHE/'results'/(id+'.json')
    result={'id':id,'title':r['title'],'stored_text_sha256':r.get('text_sha256'),'source_url':r.get('source_url'),'source_material_status':'not_obtained','comparison_status':'not_compared','current_force_status':'not_checked','notes':[]}
    if r.get('content_kind')!='stored_law_text':
        result.update(source_material_status='source_notice',comparison_status='source_notice_no_legislation_text')
        result['notes'].append('The held record is a notice, not legislation. It cannot count as a source-verified law.')
        writejson(oldpath,result);return result
    candidates=resolve_candidate(r,index)
    for ext in ['.pdf','.html']:
        p=CACHE/'originals'/(id+ext)
        if p.exists():
            receipt=readjson(p.with_suffix('.receipt.json')) or {}
            candidates.insert(0,{'path':str(p),'url':receipt.get('final_url'),'detail_url':r.get('source_url'),'identity_basis':'fetched_from_recorded_official_source_url','receipt':receipt})
    if not candidates and online:
        try:
            c,error=fetch_original(r)
            if c:candidates.append(c)
            elif error:result['notes'].append(error)
        except Exception as e:result['notes'].append('Official source acquisition failed: '+str(e)[:500])
    attempts=[]
    for c in candidates:
        p=Path(c['path'])
        try:
            originalbytes=p.read_bytes();originalhash=sha(originalbytes)
            ep=CACHE/'extracted'/(originalhash+'.fitz.txt')
            extraction_meta=readjson(ep.with_suffix('.json'))
            if ep.exists() and extraction_meta:
                source=ep.read_text(encoding='utf-8');pages=extraction_meta.get('pages');method=extraction_meta['method']
                if sha(source.encode())!=extraction_meta.get('text_sha256'):raise ValueError('Cached source extraction hash mismatch')
            else:
                source,pages,method=extract(p);ep.parent.mkdir(parents=True,exist_ok=True);ep.write_text(source,encoding='utf-8');writejson(ep.with_suffix('.json'),{'pages':pages,'method':method,'source_sha256':originalhash,'text_sha256':sha(source.encode())})
            status,cmp,differences=comparison(source,r.get('text',''))
            # The faster independent extractor clears only exact complete
            # agreement. When layout/encoding differs, reproduce the historical
            # pypdf engine independently, with no historical 400-page truncation.
            if status=='material_difference_unresolved' and p.suffix.lower()=='.pdf' and not (pages and pages>120 and len(r.get('text',''))<len(source)*0.85):
                alternate=CACHE/'extracted'/(originalhash+'.pypdf.txt')
                ameta=readjson(alternate.with_suffix('.json'))
                if alternate.exists() and ameta:
                    other=alternate.read_text(encoding='utf-8');opages=ameta.get('pages');omethod=ameta['method']
                    if sha(other.encode())!=ameta.get('text_sha256'):raise ValueError('Cached alternate source extraction hash mismatch')
                else:
                    other,opages,omethod=extract(p,engine='pypdf');alternate.write_text(other,encoding='utf-8');writejson(alternate.with_suffix('.json'),{'pages':opages,'method':omethod,'source_sha256':originalhash,'text_sha256':sha(other.encode())})
                ostatus,ocmp,odifferences=comparison(other,r.get('text',''))
                if ostatus in ['matched_original_normalized','matched_original_character_stream'] or ocmp.get('token_similarity',0)>cmp.get('token_similarity',0):
                    source,pages,method,ep,status,cmp,differences=other,opages,omethod,alternate,ostatus,ocmp,odifferences
            # Title equality alone cannot settle identity. Locate an independently
            # matching exact instrument title in the original's textual contents.
            titlepresent=titlekey(r['title']) in titlekey(source[:30000])
            identity=c['identity_basis']!='official_metadata_title_candidate' or titlepresent
            if not identity:status='source_identity_unresolved'
            if not source.strip():status='original_scan_requires_ocr'
            original={'path':str(p),'sha256':originalhash,'url':c.get('url'),'recorded_detail_url':c.get('detail_url'),'retrieved_at':c.get('receipt',{}).get('retrieved_at') or c.get('metadata',{}).get('downloaded_at') or c.get('metadata',{}).get('retrieved_at') or c.get('metadata',{}).get('crawled_at'),'identity_basis':c['identity_basis'],'title_located_in_original':titlepresent,'identity_checked':identity,'pages':pages,'extracted_text_path':str(ep),'extraction_method':method}
            original['extracted_text_sha256']=sha(source.encode())
            expectedhash=c.get('metadata',{}).get('sha256') or c.get('receipt',{}).get('sha256')
            original['recorded_sha256']=expectedhash
            original['archive_hash_check']='matched' if expectedhash==originalhash else 'mismatch' if expectedhash else 'no_prior_original_hash_recorded'
            if expectedhash and expectedhash!=originalhash:status='original_artifact_hash_conflict'
            if c.get('metadata_path'):original.update(metadata_path=c['metadata_path'],metadata_sha256=c['metadata_sha256'])
            original['official_detail_fetched_at']=c.get('metadata',{}).get('detail_fetched_at')
            attempts.append({'original':original,'comparison':cmp,'status':status,'differences':differences})
            if status in ['matched_original_normalized','matched_original_character_stream']:break
        except Exception as e:attempts.append({'original':{'path':str(p),'url':c.get('url')},'status':'extraction_failed','error':str(e)[:500]})
    if attempts:
        best=next((a for a in attempts if a['status'] in ['matched_original_normalized','matched_original_character_stream']),None) or max(attempts,key=lambda a:a.get('comparison',{}).get('token_similarity',0))
        result.update(source_material_status='text_extracted' if best.get('comparison') else 'source_file_obtained',comparison_status=best['status'],original=best['original'],comparison=best.get('comparison'))
        if best.get('differences'):
            dp=CACHE/'differences'/(id+'.json');writejson(dp,best['differences']);result['comparison']['difference_file']=str(dp)
        result['source_candidates_examined']=len(attempts)
        if best['status'] in ['matched_original_normalized','matched_original_character_stream']:result['source_material_status']='text_checked'
    else:
        result['comparison_status']='original_unavailable'
        result['notes'].append('No matching separately identified original artifact was available in the searched local official archives.' if not online else 'No matching local original and official retrieval did not yield an available source artifact.')
    writejson(oldpath,result);return result
WORKER_INDEX=None
WORKER_ONLINE=False
def initialize_worker(index,online):
    global WORKER_INDEX,WORKER_ONLINE
    WORKER_INDEX=index;WORKER_ONLINE=online
def process_worker(record):return process_record(record,WORKER_INDEX,WORKER_ONLINE)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--online',action='store_true');ap.add_argument('--workers',type=int,default=6);ap.add_argument('--limit',type=int);ap.add_argument('--retry-only',action='store_true');ap.add_argument('--processes',action='store_true');args=ap.parse_args()
    CACHE.mkdir(parents=True,exist_ok=True)
    paths=list((ROOT/'landing-pages'/'qanun-maps'/'laws').glob('*.json'))
    print('Loading',len(paths),'records',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex: records=list(ex.map(readjson,paths))
    records=[r for r in records if isinstance(r,dict) and r.get('id')]
    print('Indexing independent original metadata',flush=True);index=load_catalogs();print('Indexed',len(index),'titles',flush=True)
    selected=records[:args.limit] if args.limit else records
    if args.retry_only:selected=[r for r in selected if not (readjson(CACHE/'results'/(r['id']+'.json')) or {}).get('original')]
    print('Comparing',len(selected),'records; online',args.online,flush=True)
    results={};completed=0
    executor=concurrent.futures.ProcessPoolExecutor if args.processes else concurrent.futures.ThreadPoolExecutor
    kwargs={'initializer':initialize_worker,'initargs':(index,args.online)} if args.processes else {}
    with executor(max_workers=args.workers,**kwargs) as ex:
        futures={ex.submit(process_worker,r) if args.processes else ex.submit(process_record,r,index,args.online):r for r in selected}
        for f in concurrent.futures.as_completed(futures):
            r=f.result();results[r['id']]=r;completed+=1
            if completed%25==0:print('Compared',completed,'/',len(selected),flush=True)
    # Include all previous complete entries, but always cover each current record.
    for r in records:
        if r['id'] not in results:
            previous=readjson(CACHE/'results'/(r['id']+'.json'))
            if previous and previous.get('stored_text_sha256')==r.get('text_sha256'):results[r['id']]=previous
            else:results[r['id']]={'id':r['id'],'title':r['title'],'stored_text_sha256':r.get('text_sha256'),'comparison_status':'not_compared','source_material_status':'not_obtained','source_url':r.get('source_url'),'current_force_status':'not_checked','notes':['Not yet processed.']}
    statuses={}
    for v in results.values():statuses[v['comparison_status']]=statuses.get(v['comparison_status'],0)+1
    summary={'records':len(records),'originals_obtained':sum(bool(x.get('original')) for x in results.values()),'text_compared':sum(bool(x.get('comparison')) for x in results.values()),'exact_normalized_matches':statuses.get('matched_original_normalized',0),'exact_character_stream_matches':statuses.get('matched_original_character_stream',0),'material_differences':statuses.get('material_difference_unresolved',0),'unavailable':statuses.get('original_unavailable',0),'notices':statuses.get('source_notice_no_legislation_text',0),'statuses':statuses}
    report={'schema_version':'legis-intel-source-audit/1','audited_at':now(),'baseline_commit':'edfd4acf57fc2613d6c1f85235088efe710eb41f','comparison_scope':'Complete held text compared with separately identified source artifact; current force and later amendment completeness are not established.','summary':summary,'records':dict(sorted(results.items()))}
    writejson(REPORT,report);print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
