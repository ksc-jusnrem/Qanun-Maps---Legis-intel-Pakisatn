"""Move base64-embedded figures out of the chapter HTML into real files.

    python tools/extract_figures.py [page.html ...]

With no arguments, processes every page under code-law-and-capital/.
Idempotent: pages with no data: URIs are left alone.

Each image is written once to code-law-and-capital/assets/figures/<sha>.png,
named by content hash so identical figures share a file and the name changes
whenever the picture does. That lets vercel.json cache them as immutable.
The <img> gains width/height (no layout jump), loading="lazy" and
decoding="async". The original PNG is kept untouched as the fallback; when
Pillow is installed a WebP beside it (quality 92, about 55% smaller) is
offered first through <picture>.

build_clean_edition.py calls extract_page() and add_webp() on every chapter it writes.
"""
import base64
import hashlib
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "code-law-and-capital"
FIG_DIR = WORK / "assets" / "figures"

IMG_RE = re.compile(r'<img\b([^>]*?)\bsrc="data:image/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=\s]+)"([^>]*)>')
EXT = {"png": "png", "jpeg": "jpg", "gif": "gif", "webp": "webp"}


def png_size(raw: bytes):
    if raw[:8] == b"\x89PNG\r\n\x1a\n" and raw[12:16] == b"IHDR":
        return struct.unpack(">II", raw[16:24])
    return None


def extract_page(path: Path) -> int:
    html = path.read_text(encoding="utf-8")
    if "data:image/" not in html:
        return 0
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    rel_dir = Path("assets/figures") if path.parent == WORK else \
        Path(*[".."] * len(path.parent.relative_to(WORK).parts)) / "assets/figures"
    count = 0

    def repl(m):
        nonlocal count
        before, kind, data, after = m.groups()
        raw = base64.b64decode(re.sub(r"\s+", "", data))
        name = hashlib.sha256(raw).hexdigest()[:16] + "." + EXT[kind]
        target = FIG_DIR / name
        if not target.exists():
            target.write_bytes(raw)
        attrs = before + after
        extra = ""
        size = png_size(raw) if kind == "png" else None
        if size and "width=" not in attrs:
            extra += f' width="{size[0]}" height="{size[1]}"'
        if "loading=" not in attrs:
            extra += ' loading="lazy"'
        if "decoding=" not in attrs:
            extra += ' decoding="async"'
        count += 1
        return f'<img{before}src="{(rel_dir / name).as_posix()}"{extra}{after}>'

    html = IMG_RE.sub(repl, html)
    path.write_text(html, encoding="utf-8")
    return count


PIC_RE = re.compile(r'(?<!type="image/webp">)<img\b([^>]*?)\bsrc="([^"]*assets/figures/([0-9a-f]{16})\.png)"([^>]*)>')


def add_webp(path: Path) -> int:
    """Wrap extracted PNG figures in <picture> with a WebP source. Idempotent."""
    try:
        from PIL import Image
    except ImportError:
        return 0
    html = path.read_text(encoding="utf-8")
    count = 0

    def repl(m):
        nonlocal count
        src, sha = m.group(2), m.group(3)
        png, webp = FIG_DIR / f"{sha}.png", FIG_DIR / f"{sha}.webp"
        if not webp.exists():
            Image.open(png).save(webp, "WEBP", quality=92, method=6)
        count += 1
        return (f'<picture><source srcset="{src[:-4]}.webp" type="image/webp">'
                f'{m.group(0)}</picture>')

    html = PIC_RE.sub(repl, html)
    if count:
        path.write_text(html, encoding="utf-8")
    return count


def main():
    pages = [Path(p) for p in sys.argv[1:]] or sorted(WORK.glob("*.html"))
    total = 0
    for p in pages:
        before = p.stat().st_size
        n = extract_page(p.resolve())
        add_webp(p.resolve())
        if n:
            print(f"{p.name}: {n} figure(s), {before/1e6:.2f} MB -> {p.stat().st_size/1e6:.2f} MB")
        total += n
    print(f"{total} figures extracted to {FIG_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
