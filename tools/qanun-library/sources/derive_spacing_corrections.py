"""Ground display-only word-spacing repairs in the original PDF's glyph text.

Only a whitespace run inside alphabetic text may be removed. The surrounding
72-character non-whitespace window must occur exactly once in an independently
extracted original; the original must have no whitespace at that boundary.
Every letter, numeral, punctuation mark and raw legacy source remains intact.
"""
from __future__ import annotations
import concurrent.futures,json,re,unicodedata
from pathlib import Path
import audit_sources as a

def compact_map(text):
    compact=[];raw_boundary=[0]*(len(text)+1);spaces=set();offsets=[]
    for i,ch in enumerate(text):
        raw_boundary[i]=len(compact)
        if ch.isspace():spaces.add(len(compact));continue
        n=a.norm(ch)
        for c in n:
            if c.isspace():spaces.add(len(compact))
            else:compact.append(c);offsets.append(i)
    raw_boundary[len(text)]=len(compact)
    return ''.join(compact),raw_boundary,spaces,offsets

def corrections(stored,source,original):
    sc,_,source_spaces,source_offsets=compact_map(source)
    tc,boundaries,_,_=compact_map(stored)
    out=[]
    for match in re.finditer(r'(?<=[A-Za-z])[ \t\r\n]+(?=[a-z])',stored):
        k=boundaries[match.start()];lo=max(0,k-36);hi=min(len(tc),k+36)
        if k-lo<20 or hi-k<20:continue
        context=tc[lo:hi]
        pos=sc.find(context)
        if pos<0 or sc.find(context,pos+1)>=0:continue
        boundary=pos+k-lo
        if boundary in source_spaces:continue
        # At least one side must be an apparent broken word rather than joining
        # two ordinary capitalized headings. Original geometry supplies evidence.
        cp=source_offsets[boundary] if boundary<len(source_offsets) else len(source)
        excerpt_start=max(0,cp-70);excerpt_end=min(len(source),cp+70)
        out.append({'character_start':match.start(),'character_end':match.end(),'replacement':'','original_source_location':{'source_sha256':original['sha256'],'extraction_method':'PyMuPDF text blocks (independent glyph ordering)','extracted_character_start':cp,'physical_page':source[:cp].count('\f')+1},'evidence':{'kind':'original_pdf_word_boundary','quote':source[excerpt_start:excerpt_end],'unique_nonwhitespace_context':context,'source_has_word_space':False},'scope':'display_only_spacing; original legislative characters unchanged'})
    return out

def one(record,row):
    original=row.get('original') or {}
    p=Path(original.get('path',''))
    if not p.is_file() or p.suffix.lower()!='.pdf' or not original.get('identity_checked'):return record['id'],[],None
    import fitz
    ep=a.CACHE/'extracted'/(original['sha256']+'.fitz.txt')
    if ep.exists():source=ep.read_text(encoding='utf-8')
    else:
        with fitz.open(p) as doc:source='\n\f\n'.join(page.get_text('text',sort=False) for page in doc)
        ep.write_text(source,encoding='utf-8')
    items=corrections(record.get('text',''),source,original)
    return record['id'],items,{'path':str(ep),'sha256':a.sha(source.encode()),'method':'PyMuPDF independent PDF text extraction'}

def main():
    report=a.readjson(a.REPORT)
    if not report:raise SystemExit('Run the full original source audit first.')
    paths=list((a.ROOT/'landing-pages/qanun-maps/laws').glob('*.json'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:records=list(ex.map(a.readjson,paths))
    total=0;affected=0;done=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        futures=[ex.submit(one,r,report['records'][r['id']]) for r in records if r and r['id'] in report['records']]
        for future in concurrent.futures.as_completed(futures):
            id,items,independent=future.result();row=report['records'][id]
            row['displayCorrections']=items
            if independent:row['independent_layout_source']=independent
            total+=len(items);affected+=bool(items);done+=1
            if done%50==0:print('Spacing evidence',done,'/',len(records),'corrections',total,flush=True)
    report['summary']['grounded_spacing_corrections']=total
    report['summary']['records_with_spacing_corrections']=affected
    report['spacing_correction_scope']='Removal of extracted internal word whitespace only, supported by uniquely matching original PDF character context; raw source and legal characters preserved.'
    a.writejson(a.REPORT,report)
    print(json.dumps({'records':done,'records_with_corrections':affected,'grounded_spacing_corrections':total}),flush=True)

if __name__=='__main__':main()
