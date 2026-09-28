#!/usr/bin/env python3
"""
Build the Codex apparatus from the published chapters.

Two research instruments that a treatise has and a website usually does not:

  authorities.html   A live Table of Authorities. Every statute, ordinance,
                     regulation, SRO, circular and case the corpus discusses,
                     normalised, with a link to each paragraph discussing it.

  search-index.json  Every paragraph in the work, so search runs across the
                     whole corpus rather than one chapter at a time.

Both are derived from the published text, so neither can drift from it.

Usage:  python tools/build_apparatus.py
"""

import collections
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "code-law-and-capital"

PATTERNS = {
    "Primary legislation": [
        r"\b((?:[A-Z][A-Za-z\-']*[ ,]+){1,7}?Act,? \d{4})\b",
        r"\b((?:[A-Z][A-Za-z\-']*[ ,]+){1,7}?Ordinance,? \d{4})\b",
        r"\b(Constitution of the Islamic Republic of Pakistan,? \d{4})\b",
    ],
    "Delegated instruments": [
        r"\b((?:[A-Z][A-Za-z\-']*[ ,]+){1,8}?Regulations,? \d{4})\b",
        r"\b((?:[A-Z][A-Za-z\-']*[ ,]+){1,8}?Rules,? \d{4})\b",
        r"\b(SRO \d{3,4}\(I\)/\d{4})\b",
    ],
    "Circulars and directions": [
        r"\b((?:BPRD|FE|EPD|PSD)[A-Za-z ]*Circular(?: Letter)?(?: No\.?)? ?\d+ of \d{4})\b",
    ],
    "Cases": [
        r"\b([A-Z][A-Za-z'&\. ]{2,42}? v (?:the )?[A-Z][A-Za-z'&\. ]{2,42})",
    ],
}

# Leading words that get swept into a match but are not part of the name.
NOISE = re.compile(
    r"^(?:the|The|first|First|second|Second|in|In|under|Under|see|See|a|A|an|An|"
    r"notified|The notified|and|And|of|Of)\s+", re.X)


def canonical(name: str) -> str:
    """Normalise a citation so its variants collapse to one entry."""
    n = " ".join(name.split())
    while NOISE.match(n):
        n = NOISE.sub("", n, count=1)
    n = n.replace("Act, ", "Act ").replace("Ordinance, ", "Ordinance ")
    n = n.replace("Regulations, ", "Regulations ").replace("Rules, ", "Rules ")
    n = n.replace("Activity-Specific", "Activity Specific")
    n = re.sub(r"\bNo\.? ", "No ", n)
    n = re.sub(r"\s+", " ", n).strip(" ,.;:")
    return n


def paragraphs(path: pathlib.Path):
    s = path.read_text(encoding="utf-8")
    body = s[s.index("<main"): s.index("</main>")]
    body = re.sub(r'<section class="notes".*', "", body, flags=re.S)
    body = re.sub(r'<nav class="onthispage".*?</nav>', "", body, flags=re.S)
    for pid, frag in re.findall(
            r'<div class="para" id="p(\d+)">.*?<div class="ptext">(.*?)</div></div>',
            body, re.S):
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", frag))).strip()
        yield int(pid), text


def unit_title(path: pathlib.Path) -> str:
    s = path.read_text(encoding="utf-8")
    m = re.search(r"<h1>(.*?)</h1>", s, re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip() if m else path.stem


def main() -> None:
    files = sorted(LIB.glob("chapter-*.html")) + [LIB / "front-matter.html", LIB / "back-matter.html"]
    files = [f for f in files if f.exists()]

    index, authorities = [], collections.defaultdict(lambda: collections.defaultdict(list))
    for f in files:
        slug, title = f.stem, unit_title(f)
        for pid, text in paragraphs(f):
            index.append({"u": slug, "p": pid, "t": text})
            for kind, pats in PATTERNS.items():
                for pat in pats:
                    for m in re.findall(pat, text):
                        name = canonical(m if isinstance(m, str) else m[0])
                        if len(name) < 8 or name.count(" ") < 1:
                            continue
                        authorities[kind][name].append((slug, pid))

    (ROOT / "search-index.json").write_text(
        json.dumps({"units": {f.stem: unit_title(f) for f in files}, "paras": index},
                   ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    total = sum(len(v) for v in authorities.values())
    rows = []
    for kind in PATTERNS:
        entries = sorted(authorities[kind].items(), key=lambda kv: kv[0].lower())
        if not entries:
            continue
        rows.append(f'<h2 class="auth-kind" id="{kind.split()[0].lower()}">{kind} '
                    f'<span>{len(entries)}</span></h2><dl class="auth">')
        for name, locs in entries:
            seen, refs = set(), []
            for slug, pid in locs:
                key = (slug, pid)
                if key in seen:
                    continue
                seen.add(key)
                label = (slug.replace("chapter-", "").lstrip("0")
                         if slug.startswith("chapter-") else slug.split("-")[0].title())
                refs.append(f'<a href="code-law-and-capital/{slug}.html#p{pid}">'
                            f'<b>{label}</b><i>&para;</i>{pid}</a>')
            rows.append(f'<dt>{html.escape(name)}</dt>'
                        f'<dd><span class="n">{len(refs)}</span>{"".join(refs)}</dd>')
        rows.append("</dl>")

    (ROOT / "authorities.html").write_text(
        PAGE.replace("{{ROWS}}", "".join(rows)).replace("{{TOTAL}}", str(total))
            .replace("{{PARAS}}", f"{len(index):,}"), encoding="utf-8")

    print(f"authorities.html   {total} distinct authorities")
    for kind in PATTERNS:
        if authorities[kind]:
            print(f"    {kind:26} {len(authorities[kind])}")
    print(f"search-index.json  {len(index):,} paragraphs, "
          f"{(ROOT / 'search-index.json').stat().st_size/1024:.0f} KB")


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Table of Authorities &mdash; JUSNREM Codex</title>
<meta name="description" content="Every statute, ordinance, regulation, SRO, circular and case discussed in the Codex, linked to the paragraphs that discuss it.">
<link rel="canonical" href="https://www.jusnrem.legal/authorities.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600&family=Spectral:ital,wght@0,400&display=swap" rel="stylesheet">
<style>
:root{--ground:#EEF0F0;--surface:#FFFFFF;--ink:#111516;--ink-2:#3C484D;--ink-3:#56676E;
 --gold:#43652E;--gold-soft:rgba(67,101,46,.10);--rule:#CCD1D4;--rule-2:#DDE1E2;--green:#43652E;
 --sans:Aptos,"Segoe UI",system-ui,Inter,Helvetica,Arial,sans-serif;
 --serif:Georgia,"Iowan Old Style","Times New Roman",serif;}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:8rem}
body{margin:0;background:var(--ground);color:var(--ink);font:400 .95rem/1.6 var(--sans)}
.masthead{position:sticky;top:0;z-index:50;background:rgba(238,240,240,.95);
 backdrop-filter:blur(8px);border-bottom:1px solid var(--rule)}
.masthead .in{max-width:74rem;margin:0 auto;padding:.7rem 1.4rem;display:flex;
 align-items:center;gap:1.2rem;flex-wrap:wrap}
.brand{text-decoration:none;color:var(--ink)}
.brand b{display:block;font:600 .78rem/1 var(--sans);letter-spacing:.19em;text-transform:uppercase}
.brand span{display:block;margin-top:.22rem;font:400 .64rem/1 var(--sans);
 letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3)}
#q{margin-left:auto;font:400 .82rem var(--sans);padding:.42rem .7rem;width:20rem;max-width:52vw;
 border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:2px}
#q:focus{outline:2px solid var(--gold);outline-offset:1px}
.wrap{max-width:74rem;margin:0 auto;padding:0 1.4rem}
.head{padding:3.2rem 0 2rem;border-bottom:1px solid var(--rule)}
h1{margin:0;font:400 clamp(2rem,4.4vw,2.9rem)/1.14 var(--serif);letter-spacing:-.012em}
.lede{margin:1.2rem 0 0;max-width:60ch;color:var(--ink-2)}
.stat{margin-top:1.7rem;display:flex;flex-wrap:wrap;gap:.5rem}
.stat b{font:600 .62rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;
 padding:.45rem .65rem;border:1px solid var(--rule);background:var(--surface);
 color:var(--ink-2);font-weight:600}
.auth-kind{margin:2.8rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid var(--rule);
 font:600 1rem/1.3 var(--sans);letter-spacing:.02em;display:flex;align-items:baseline;gap:.7rem}
.auth-kind span{font:600 .62rem/1 var(--sans);letter-spacing:.12em;color:var(--gold)}
dl.auth{margin:0}
dl.auth dt{margin-top:.9rem;font:600 .88rem/1.4 var(--sans);color:var(--ink)}
dl.auth dd{margin:.3rem 0 0;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center}
dl.auth dd .n{font:600 .58rem/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);
 border:1px solid var(--rule-2);padding:.3rem .4rem;background:var(--surface)}
dl.auth dd a{font:500 .7rem/1 var(--sans);color:var(--green);text-decoration:none;
 padding:.3rem .45rem;border:1px solid var(--rule-2);background:var(--surface);
 border-radius:2px;font-variant-numeric:tabular-nums}
dl.auth dd a b{font-weight:600;color:var(--ink)}
dl.auth dd a i{font-style:normal;color:var(--gold);margin:0 .18em 0 .32em;font-size:.9em}
dl.auth dd a:hover{border-color:var(--gold);background:var(--gold-soft)}
dl.auth dt.hide,dl.auth dt.hide + dd{display:none}
#note{margin:1.4rem 0 0;font:500 .78rem var(--sans);color:var(--ink-3)}
footer{padding:3rem 0;margin-top:3rem;border-top:1px solid var(--rule);
 font-size:.8rem;color:var(--ink-3)}
a{color:var(--green)}
@media (max-width:720px){#q{width:100%;max-width:none;margin-left:0}}
.masthead nav{display:flex;gap:1.2rem}
.masthead nav a{font:500 .74rem var(--sans);color:var(--ink-2);text-decoration:none}
.masthead nav a:hover{color:var(--gold)}
@media (max-width:720px){.masthead nav{display:none}}
</style>
</head>
<body>
<header class="masthead"><div class="in">
  <a class="brand" href="index.html"><b>JUSNREM Codex</b><span>Table of Authorities</span></a>
  <nav><a href="code-law-and-capital/">The Codex</a><a href="search.html">Search</a>
       <a href="map.html">Map</a><a href="doctrines.html">Doctrines</a></nav>
  <input id="q" type="search" placeholder="Filter authorities&hellip;" autocomplete="off">
</div></header>

<div class="wrap">
  <div class="head">
    <h1>Table of Authorities</h1>
    <p class="lede">
      Every statute, ordinance, regulation, SRO, circular and case discussed in the
      Codex, with a link to each paragraph that discusses it. Built from the published
      text, so it cannot drift from what the chapters actually say.
    </p>
    <div class="stat">
      <b>{{TOTAL}} authorities</b><b>{{PARAS}} paragraphs searched</b><b>26 chapters</b>
    </div>
    <p id="note" hidden></p>
  </div>
  {{ROWS}}
  <footer>
    Derived from the published corpus. Citations are as they appear in the text; an
    entry records where an instrument is discussed, not that it is in force.
    <br>&copy; 2026 KSC.JUSNREM.
  </footer>
</div>

<script>
const q = document.getElementById('q'), note = document.getElementById('note');
const terms = [...document.querySelectorAll('dl.auth dt')];
let t;
q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
function run() {
  const v = q.value.trim().toLowerCase();
  let shown = 0;
  terms.forEach(dt => {
    const hit = !v || dt.textContent.toLowerCase().includes(v);
    dt.classList.toggle('hide', !hit);
    if (hit) shown++;
  });
  document.querySelectorAll('.auth-kind').forEach(h => {
    let n = h.nextElementSibling, any = false;
    n.querySelectorAll('dt').forEach(d => { if (!d.classList.contains('hide')) any = true; });
    h.style.display = any ? '' : 'none';
    n.style.display = any ? '' : 'none';
  });
  note.hidden = !v;
  note.textContent = shown + ' matching ' + (shown === 1 ? 'authority' : 'authorities');
}
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
