"""Conservative small-image grouping with explicit operative negative controls."""
import io,json,collections,importlib.util
from pathlib import Path
from PIL import Image,ImageOps,ImageChops
import fitz
import audit_sources as a

def normalized(im):
    im=im.convert('RGBA');white=Image.new('RGBA',im.size,'white');white.alpha_composite(im);g=white.convert('L')
    g=ImageOps.autocontrast(g,cutoff=1)
    bbox=g.point(lambda v:255 if v<240 else 0).getbbox()
    if bbox:g=g.crop(bbox)
    g=ImageOps.autocontrast(g)
    p=g.resize((9,8),Image.Resampling.LANCZOS);values=list(p.getdata());h=0
    for y in range(8):
        for x in range(8):h=(h<<1)|(values[y*9+x]>values[y*9+x+1])
    exact=g.resize((64,64),Image.Resampling.LANCZOS).point(lambda v:round(v/32)*32)
    return h,g.width/max(1,g.height),a.sha(exact.tobytes()),g

class Loader:
    def __init__(self,report):self.report=report;self.id=None;self.doc=None;self.page=None;self.infos=None
    def load(self,row):
        if self.id!=row['id']:
            if self.doc:self.doc.close()
            self.doc=fitz.open(self.report['records'][row['id']]['original']['path']);self.id=row['id'];self.page=None
        if self.page!=row['page']:
            self.p=self.doc[row['page']-1];self.page=row['page'];self.infos=self.p.get_image_info(hashes=True,xrefs=True)
        info=next(i for i in self.infos if i['digest'].hex()==row['digest'])
        if info['xref']>0:b=self.doc.extract_image(info['xref'])['image']
        else:
            blocks=[x for x in self.p.get_text('dict')['blocks'] if x['type']==1]
            block=min(blocks,key=lambda x:sum(abs(float(u)-float(v)) for u,v in zip(x['bbox'],info['bbox'])));b=block['image']
        im=Image.open(io.BytesIO(b)).copy();return im

def main():
    report=a.readjson(a.REPORT);large_keys=a.readjson(a.CACHE/'review/all-image-digests-key.json');review=a.readjson(a.HERE/'source-image-review.json');keep=set(review['retained_large_object_numbers']);loader=Loader(report);logos=[];operative=[]
    for row in large_keys:
        h,aspect,exact,g=normalized(loader.load(row));item={'digest':row['digest'],'hash':h,'aspect':aspect,'exact':exact,'row':row}
        (operative if row['number'] in keep else logos).append(item)
    small=a.readjson(a.CACHE/'review/small-image-key.json');classified=[];unknown=[];samples=a.CACHE/'review/small-image-samples';samples.mkdir(parents=True,exist_ok=True)
    # These additional actual images were visually inspected on the dimension
    # contact sheet: only national/publisher emblems and watermark variants.
    seeds={1,4,5,8,10,14,16,18,20,22,26,28,31,33,36,39,51,54,56,69,207,334}
    for row in small:
        if row['number'] not in seeds:continue
        file=samples/(row['digest']+'.png');im=Image.open(file) if file.is_file() else loader.load(row)
        h,aspect,exact,g=normalized(im);logos.append({'digest':row['digest'],'hash':h,'aspect':aspect,'exact':exact,'row':row})
    for n,row in enumerate(small):
        file=samples/(row['digest']+'.png');im=Image.open(file) if file.is_file() else loader.load(row);h,aspect,exact,g=normalized(im)
        matches=[x for x in logos if max(aspect/x['aspect'],x['aspect']/aspect)<=1.2 and (h^x['hash']).bit_count()<=3]
        # A candidate must also be farther from EVERY known operative image.
        negative=[x for x in operative if max(aspect/x['aspect'],x['aspect']/aspect)<=1.2 and (h^x['hash']).bit_count()<=3]
        result={**row,'dhash':format(h,'016x'),'trimmed_aspect':aspect,'normalized_pixel_sha256':exact,'known_operative_collision':bool(negative)}
        if matches and not negative:
            best=min(matches,key=lambda x:(h^x['hash']).bit_count());result.update(classification='provisional_visually_similar_logo',matched_logo_digest=best['digest'],distance=(h^best['hash']).bit_count());classified.append(result)
        else:
            result['classification']='unclassified_retained';unknown.append(result)
        # Originals are kept, not only normalized bitmaps, for human review.
        im.convert('RGB').save(samples/(row['digest']+'.png'))
        if (n+1)%250==0:print('Small-image grouping',n+1,'/',len(small),flush=True)
    summary={'objects_examined':len(small),'provisional_logo_matches':len(classified),'unclassified_retained':len(unknown),'negative_controls':len(operative),'known_operative_images_matching_logo_rule':sum(any(max(x['aspect']/l['aspect'],l['aspect']/x['aspect'])<=1.2 and (x['hash']^l['hash']).bit_count()<=3 for l in logos) for x in operative)}
    a.writejson(a.HERE/'small-image-classification.json',{'summary':summary,'provisional_logos':classified,'unclassified':unknown,'threshold':'dHash64 Hamming<=3, trimmed aspect ratio within20%; excludesanycandidate colliding with a knownoperativeimage. Provisionalmatches require representative humanreview.'})
    print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
