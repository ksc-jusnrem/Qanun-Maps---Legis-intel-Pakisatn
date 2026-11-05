import zipfile,json,pathlib,re,hashlib,argparse
parser=argparse.ArgumentParser(description="Prepare discovery candidates for review; never overwrite the published index.")
parser.add_argument("--archive",required=True,type=pathlib.Path)
parser.add_argument("--laws",required=True,type=pathlib.Path)
parser.add_argument("--output",required=True,type=pathlib.Path)
args=parser.parse_args()
if args.output.exists():parser.error("Output exists; choose a new candidate file")
if not args.archive.is_file() or not args.laws.is_dir():parser.error("Source archive and law directory must exist")
root=pathlib.Path('tools/qanun-release')
zpath=args.archive
with zipfile.ZipFile(zpath) as z: raw=json.loads(z.read('fiscal/case-register/raw/all_cases.json'))
laws=[json.loads(p.read_text(encoding='utf-8')) for p in args.laws.glob('*.json')]
def norm(s):return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
needles=[]
for r in laws:
 t=re.split(r'\(|\b(?:18|19|20)\d\d\b',r['title'])[0].strip(' ,')
 n=norm(t)
 if len(n)>20 and len(n.split())>=3:needles.append((n,r['id'],r['title']))
constitution='pk-code-30ecabb4a7ed433a'
records=[]
for key,c in raw.items():
 sid=str(c['id']);assert sid==str(key) and sid.isdigit()
 topics=sorted(set(t for t in c.get('topics',[]) if not t.startswith('Citation-graph:')))
 text=' '+norm(c.get('snippet',''))+' '
 links={}
 for n,lid,title in needles:
  if ' '+n+' ' in text:links[lid]={'law_id':lid,'law_title':title,'basis':'Named-title match in supplied search snippet; judgment relationship not checked'}
 arts=sorted(set(re.findall(r'\bArt(?:icle)?\.?\s*(\d+[A-Z]?)', ' '.join(topics),re.I)))
 if arts:links[constitution]={'law_id':constitution,'law_title':'Constitution of the Islamic Republic of Pakistan','basis':'Research topic refers to Article(s) '+', '.join(arts)+'; judgment passage and application not checked'}
 url='https://pakistancaselaw.com/case/'+sid
 records.append({'id':sid,'title':c['title'],'citation':c.get('citation',''),'court':c.get('court') or None,'source_scope':c.get('source_scope') or 'Source body needs review','year':c.get('year'),'url':url,'topics':topics,'law_links':list(links.values()),'evidence_status':'Source record located; citation identity, full judgment, propositions, pinpoints and subsequent treatment not checked','retrieval_date':None})
records.sort(key=lambda c:(-(int(c['year']) if str(c['year']).isdigit() else 0),c['title'],c['id']))
data={'schema':'qanun-case-discovery/1','package_date':None,'release_status':'candidate only; identity and source-scope review required','source_archive_sha256':hashlib.sha256(zpath.read_bytes()).hexdigest(),'source_member':'fiscal/case-register/raw/all_cases.json','records':records}
args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'cases':len(records),'linked_cases':sum(bool(c['law_links']) for c in records),'candidate_links':sum(len(c['law_links']) for c in records)}))
