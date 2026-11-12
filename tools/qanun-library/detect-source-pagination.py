"""Locate print folios from original PDF geometry, never from bare numerals alone."""
from pathlib import Path
import bisect,concurrent.futures,hashlib,json,re
import fitz
ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'tools/qanun-library'
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def check(id):
    try:
        record_path=HERE/'repaired-records'/f'{id}.json'
        if not record_path.exists():record_path=ROOT/'landing-pages/qanun-maps/laws'/f'{id}.json'
        record=load(record_path);audit=load(HERE/'sources/cache/results'/f'{id}.json');original=audit.get('original') or {}
        if not original.get('identity_checked') or not str(original.get('path','')).lower().endswith('.pdf'):return id,None,'no_pdf'
        raw=record['text'];source=Path(original['extracted_text_path']).read_text(encoding='utf-8')
        raw_positions=[i for i,c in enumerate(raw) if not c.isspace()];source_positions=[i for i,c in enumerate(source) if not c.isspace()]
        if ''.join(raw[i] for i in raw_positions)!=''.join(source[i] for i in source_positions):return id,None,'character_order_not_identical'
        pages=source.split('\f');candidates=[]
        with fitz.open(original['path']) as pdf:
            if len(pdf)<3 or len(pages)!=len(pdf):return id,None,'unmatched_page_boundaries'
            for index,page in enumerate(pdf):
                words=[w for w in page.get_text('words') if re.fullmatch(r'\d{1,4}',w[4]) and w[1]>page.rect.height*.86 and abs((w[0]+w[2])/2-page.rect.width/2)<page.rect.width*.15]
                if len(words)==1:candidates.append({'index':index,'number':int(words[0][4]),'text':words[0][4],'bbox':list(words[0][:4])})
        runs=[];run=[]
        for c in candidates:
            if run and (c['index']!=run[-1]['index']+1 or c['number']!=run[-1]['number']+1):
                if len(run)>=3:runs.extend(run)
                run=[]
            run.append(c)
        if len(run)>=3:runs.extend(run)
        offsets=[];offset=0
        for p in pages:offsets.append(offset);offset+=len(p)+1
        artifacts=[]
        for c in runs:
            matches=list(re.finditer(r'(?m)^[ \t]*'+re.escape(c['text'])+r'[ \t]*\r?$',pages[c['index']]))
            if len(matches)!=1:continue
            m=matches[0];start=offsets[c['index']]+m.start()+len(m.group(0))-len(m.group(0).lstrip());rank=bisect.bisect_left(source_positions,start)
            endrank=rank+len(c['text'])
            if endrank>len(raw_positions):continue
            a,b=raw_positions[rank],raw_positions[endrank-1]+1
            line_start=raw.rfind('\n',0,a)+1;line_end=raw.find('\n',b)
            if line_end<0:line_end=len(raw)
            if raw[line_start:line_end].strip()!=c['text']:continue
            artifacts.append({'character_start':a,'character_end':b,'text':raw[a:b],'input_text_sha256':record['text_sha256'],'source_pdf_sha256':original['sha256'],'source_page':c['index']+1,'printed_page':c['number'],'source_bbox':c['bbox'],'reason':'page_footer_confirmed_in_original'})
        if artifacts:return id,{'input_text_sha256':record['text_sha256'],'source_pdf_sha256':original['sha256'],'artifacts':artifacts},None
        return id,None,'no_unambiguous_sequential_footer'
    except Exception as e:return id,None,'error: '+str(e)[:180]
def main():
    ids=[p.stem for p in (ROOT/'landing-pages/qanun-maps/laws').glob('*.json')];rows={};outcomes={}
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        for n,(id,row,status) in enumerate(pool.map(check,ids),1):
            if row:rows[id]=row
            if status:outcomes[status]=outcomes.get(status,0)+1
            if n%100==0:print('Source pagination',n,'/',len(ids),flush=True)
    result={'schema_version':'source-pagination-proof/1','scope':'Centered bottom-page numeric folios in monotonic original-PDF runs of at least three pages; exact source-to-reading character-stream alignment and unique whole-line matches required.','records':rows,'summary':{'examined_records':len(ids),'records_with_proven_folios':len(rows),'folios':sum(len(r['artifacts']) for r in rows.values()),'other_outcomes':outcomes}}
    target=HERE/'source-pagination.json';target.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result['summary']),flush=True)
if __name__=='__main__':main()
