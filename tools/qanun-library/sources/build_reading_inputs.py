"""Bundle source-derived, literal-character-preserving reader inputs.

No local path is embedded in the hosted bundle. Layout text is accepted only
when every literal non-whitespace character equals the effective law record.
Spacing-only corrections use complete aligned normalized character streams;
no repeated substring searching or similarity threshold is used.
"""
from pathlib import Path
import concurrent.futures,gzip,json,re
import audit_sources as a
from derive_spacing_corrections import compact_map

def make(record,row):
    if record.get('content_kind')!='stored_law_text':return record['id'],None
    original=row.get('original') or {}
    if not original.get('identity_checked'):return record['id'],None
    candidates=[a.CACHE/'extracted'/(original['sha256']+'.fitz.txt')]
    if original.get('extracted_text_path'):candidates.append(Path(original['extracted_text_path']))
    if record['id']=='balochistan-code-d9d838bd66607fd9':
        # The raw record contains explicit extraction page wrappers. These are
        # separately removed in normal display; they are not legal characters.
        pass
    sources=[]
    for p in candidates:
        if p.is_file():
            s=p.read_text(encoding='utf-8')
            if s.strip() and s not in sources:sources.append(s)
    if not sources:return record['id'],None
    text=record['text'];literal=re.sub(r'\s+','',text)
    proof={'original_pdf_sha256':original['sha256'],'original_url':original.get('url'),'input_text_sha256':record['text_sha256'],'current_force_status':'not_checked'}
    result={'proof':proof}
    for source in sources:
        if re.sub(r'\s+','',source)==literal:
            result['sourceLayoutText']=source
            proof['layout_verification']='Every literal non-whitespace character, including case, punctuation, numerals and negations, equals the complete effective record. Only source-derived whitespace/layout differs.'
            proof['layout_text_sha256']=a.sha(source.encode())
            proof['literal_character_stream_sha256']=a.sha(literal.encode())
            break
    # For word-spacing repairs, exact complete normalized character alignment
    # supplies a direct boundary map. No quadratic context searches are needed.
    if not result.get('sourceLayoutText'):
        stored,raw_boundaries,_,_=compact_map(text)
        for source in sources:
            sc,_,spaces,offsets=compact_map(source)
            if sc!=stored:continue
            items=[]
            for m in re.finditer(r'(?<=[A-Za-z])[ \t\r\n]+(?=[a-z])',text):
                k=raw_boundaries[m.start()]
                if k in spaces:continue
                cp=offsets[k] if k<len(offsets) else len(source)
                items.append({'character_start':m.start(),'character_end':m.end(),'replacement':'','original_source_location':{'source_sha256':original['sha256'],'extracted_character_start':cp,'physical_page':source[:cp].count('\f')+1},'evidence':{'kind':'complete_original_character_alignment','quote':source[max(0,cp-50):cp+50]},'scope':'Display-only whitespace deletion; no legislative character changed.'})
            if items:
                result['displayCorrections']=items
                proof['spacing_source_text_sha256']=a.sha(source.encode())
                proof['spacing_verification']='Complete normalized character streams are exactly equal; only mapped whitespace within extracted alphabetic words is removed.'
            break
    return record['id'],result if len(result)>1 else None

def main():
    report=a.readjson(a.REPORT)
    paths=list((a.ROOT/'landing-pages/qanun-maps/laws').glob('*.json'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:records=list(ex.map(a.readjson,paths))
    effective=[]
    for record in records:
        replacement=a.readjson(a.ROOT/'tools/qanun-library/repaired-records'/(record['id']+'.json'))
        effective.append((replacement.get('record',replacement) if replacement else record))
    result={};done=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures=[ex.submit(make,r,report['records'][r['id']]) for r in effective]
        for f in concurrent.futures.as_completed(futures):
            id,item=f.result();done+=1
            if item:result[id]=item
            if done%250==0:print('Reader source inputs',done,'/',len(records),flush=True)
    summary={'records_examined':len(records),'layout_records':sum('sourceLayoutText' in x for x in result.values()),'spacing_only_records':sum('displayCorrections' in x for x in result.values()),'spacing_deletions':sum(len(x.get('displayCorrections',[])) for x in result.values()),'bundle_records':len(result)}
    payload={'schema_version':'legis-intel-source-reader-inputs/1','generated_at':a.now(),'summary':summary,'records':result}
    raw=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode();bundle=a.HERE/'reading-inputs.json.gz'
    bundle.write_bytes(gzip.compress(raw,compresslevel=8,mtime=0))
    a.writejson(a.HERE/'reading-inputs-summary.json',{**summary,'bundle_sha256':a.sha(bundle.read_bytes()),'uncompressed_bytes':len(raw),'compressed_bytes':bundle.stat().st_size,'privacy':'No local filesystem paths. Public legislation text and source URL/hash only.'})
    print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
