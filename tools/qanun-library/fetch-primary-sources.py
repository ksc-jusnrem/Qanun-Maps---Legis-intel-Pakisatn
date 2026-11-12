from pathlib import Path
import datetime,hashlib,json,ssl,urllib.request
import requests,fitz
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'tools/qanun-library/sources/cache/originals';DEST.mkdir(parents=True,exist_ok=True)
SOURCES={
 'marriage-detail-html':'https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUbA%3D%3D-sg-jjjjjjjjjjjjj',
 'marriage-section-html':'https://pakistancode.gov.pk/english/UY2FqaJw2-apaUY2Fqa-apaUbA%3D%3D-con-5298-sg-jjjjjjjjjjjjj',
 'representation-1976':'https://ecp.gov.pk/storage/files/1/eleclaws18.pdf',
 'marriage-1999':'https://pakistancode.gov.pk/pdffiles/administrator3a905072090c7de7a69b842bc3f73df3.pdf',
 'marriage-search-html':'https://pakistancode.gov.pk/english/sHyuRsF?domain=&query=ordinance+of+law&results=10&search=1&start=150&type=or',
 'marriage-index-html':'https://www.pakistancode.gov.pk/english/LGu0xAD?action=null&alp=M&page=1'
}
for key,url in SOURCES.items():
    try:
        html_source=key.endswith('-html');path=DEST/(key+('.html' if html_source else '.pdf'))
        if path.exists() and path.with_suffix('.receipt.json').exists():
            prior=json.loads(path.with_suffix('.receipt.json').read_text(encoding='utf-8'))
            if prior.get('requested_url')==url and hashlib.sha256(path.read_bytes()).hexdigest()==prior.get('sha256'):
                print(json.dumps({'source':key,'cached_original':str(path),'receipt':prior}),flush=True);continue
        try:
            response=requests.get(url,timeout=45,headers={'User-Agent':'Mozilla/5.0 Legis-Intel source-fidelity review'});response.raise_for_status()
            content,final,status=response.content,response.url,response.status_code
        except requests.exceptions.SSLError:
            # Keep verification enabled; Windows' system trust can include an issuer absent from certifi.
            request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(request,context=ssl.create_default_context(),timeout=45) as response:
                content,final,status=response.read(),response.url,response.status
        if not html_source and not content.startswith(b'%PDF'):raise ValueError('Official URL did not return PDF bytes')
        path.write_bytes(content)
        receipt={'requested_url':url,'final_url':final,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(content).hexdigest(),'http_status':status}
        links=[]
        if html_source:
            from bs4 import BeautifulSoup
            soup=BeautifulSoup(content,'html.parser')
            links=[{'text':a.get_text(' ',strip=True),'href':a.get('href')} for a in soup.find_all('a',href=True) if 'marriage' in a.get_text(' ',strip=True).lower()]
            for tag in soup(['script','style']):tag.decompose()
            text=soup.get_text('\n',strip=True)
        else:
            with fitz.open(path) as pdf:
                text='\n\f\n'.join(page.get_text('text') for page in pdf);receipt['pages']=len(pdf)
        path.with_suffix('.txt').write_text(text,encoding='utf-8',newline='\n')
        path.with_suffix('.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'source':key,'path':str(path),'receipt':receipt,'extracted_characters':len(text),'matching_links':links}),flush=True)
    except Exception as error:print(json.dumps({'source':key,'error':str(error)}),flush=True)
