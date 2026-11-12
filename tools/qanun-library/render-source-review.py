from pathlib import Path
import json
import fitz
root=Path(__file__).resolve().parents[2]
row=json.loads((root/'tools/qanun-library/sources/cache/results/pk-code-a2f0a11f70fdf902.json').read_text(encoding='utf-8'))
target=root/'work/library-repair/railways-original'
target.mkdir(parents=True,exist_ok=True)
with fitz.open(row['original']['path']) as pdf:
    for i,page in enumerate(pdf):
        path=target/f'page-{i+1}.png'
        page.get_pixmap(matrix=fitz.Matrix(1.7,1.7)).save(path)
        print(path,flush=True)
