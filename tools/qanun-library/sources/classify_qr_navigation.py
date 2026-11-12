"""Decode actual cover QRs; exclude only official publisher navigation URLs."""
import sys,json
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
import audit_sources as a
sys.path.insert(0,str(a.CACHE/'qr-runtime'))
import zxingcpp

def main():
    records=a.readjson(a.REPORT)['records'];keys=a.readjson(a.CACHE/'review/small-image-key.json');results=[];decoded=0
    for n,row in enumerate(keys):
        # Publisher metadata marks on the cover only; never discard body QR data.
        if row['page']!=1 or not .65<=row['width']/row['height']<=1.5 or row['width']<40:continue
        p=a.CACHE/('review/small-image-samples/'+row['digest']+'.png')
        if not p.is_file():continue
        im=Image.open(p).convert('RGB')
        code=zxingcpp.read_barcode(im)
        if code is None:continue
        decoded+=1;text=code.text;uri=urlparse(text);record=records[row['id']]
        source_hosts={urlparse(record.get('source_url') or '').hostname,urlparse(record.get('original',{}).get('url') or '').hostname}
        host=(uri.hostname or '').lower().removeprefix('www.');official=host in {(x or '').lower().removeprefix('www.') for x in source_hosts} and (host.endswith('.gov.pk') or host.endswith('.gob.pk'))
        results.append({**row,'decoded_text':text,'classification':'official_publisher_cover_navigation' if uri.scheme in ['https','http'] and official else 'qr_content_retained','decode_format':str(code.format),'source_hosts':sorted(x for x in source_hosts if x)})
    summary={'cover_qr_objects_decoded':decoded,'official_publisher_navigation':sum(x['classification']=='official_publisher_cover_navigation' for x in results),'other_qr_retained':sum(x['classification']!='official_publisher_cover_navigation' for x in results)}
    a.writejson(a.HERE/'qr-navigation-review.json',{'summary':summary,'records':results,'scope':'Actual decoded URL points to the same official publishing service as the identified original; physical page1 cover metadata. No body QR or non-URL content excluded.'});print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
