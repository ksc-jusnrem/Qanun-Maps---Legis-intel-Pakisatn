from pathlib import Path
import hashlib,json,shutil
from PIL import Image
root=Path(__file__).resolve().parents[2]
target=root/'tools/qanun-library/original-pages';target.mkdir(parents=True,exist_ok=True)
manifest={'record_id':'pk-code-a2f0a11f70fdf902','source_pdf_sha256':'0a8b926e1c6417563ab2afd0c5dc360edec2a4081a8b52be6e7b491ed4033efa','rendering':'PyMuPDF at scale1.7; no cropping or content editing','pages':[]}
for i in range(1,7):
    src=root/f'work/library-repair/railways-original/page-{i}.png'
    dest=target/f'page-{i}.png';shutil.copyfile(src,dest)
    with Image.open(dest) as image:width,height=image.size
    manifest['pages'].append({'page':i,'file':dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'width':width,'height':height})
(target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Original Gazette page manifest prepared')
