#!/usr/bin/env python3
"""
Build the cross-reference map from the published chapters.

An arc diagram of the corpus as it actually cites itself. Every arc is a real
link in the published text, so the map cannot claim a connection the chapters
do not make - and a chapter with no arc is visibly unconnected.

Usage:  python tools/build_map.py
"""

import collections
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "code-law-and-capital"

PART_OF = {**{c: 1 for c in range(1, 7)}, **{c: 2 for c in range(7, 10)},
           **{c: 3 for c in range(10, 14)}, **{c: 4 for c in range(14, 18)},
           **{c: 5 for c in range(18, 23)}, **{c: 6 for c in range(23, 26)}, 26: 7}
PART_NAME = {1: "Foundations and the Governing Triad",
             2: "Pakistan's Digital and Virtual-Asset Legal Order",
             3: "Financial, Property, Integrity and Fiscal Order",
             4: "Digital Systems, Institutions, Rights and Remedies",
             5: "Comparative Digital-Asset Orders",
             6: "Global Standards and International Law",
             7: "Building Pakistan's Future Digital-Asset Order"}
PART_COLOUR = {1: "#43652E", 2: "#652E43", 3: "#43652E", 4: "#698458",
               5: "#2F4720", 6: "#3C484D", 7: "#43652E"}

W, PAD_X, BASE, ARC_MAX = 1160, 54, 300, 232


def read_graph():
    edges, titles = collections.Counter(), {}
    for f in sorted(LIB.glob("chapter-*.html")):
        src = int(f.name[8:10])
        s = f.read_text(encoding="utf-8")
        body = s[s.index("<main"): s.index("</main>")]
        body = re.sub(r'<section class="notes".*', "", body, flags=re.S)
        body = re.sub(r'<nav class="(onthispage|crumb)".*?</nav>', "", body, flags=re.S)
        m = re.search(r"<h1>(.*?)</h1>", s, re.S)
        titles[src] = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip() if m else ""
        for dst in re.findall(r'href="chapter-(\d\d)\.html"', body):
            dst = int(dst)
            if dst != src:
                edges[(src, dst)] += 1
    return edges, titles


def build():
    edges, titles = read_graph()
    out, inn = collections.Counter(), collections.Counter()
    for (a, b), n in edges.items():
        out[a] += n
        inn[b] += n
    step = (W - 2 * PAD_X) / 25
    x = {c: PAD_X + (c - 1) * step for c in range(1, 27)}
    orphans = [c for c in range(1, 27) if not out[c] and not inn[c]]

    arcs = []
    for (a, b), n in sorted(edges.items(), key=lambda kv: -abs(kv[0][0] - kv[0][1])):
        x1, x2 = x[a], x[b]
        span = abs(x2 - x1)
        h = min(ARC_MAX, 26 + span * 0.46)
        up = a < b                      # forward references arc above, back-references below
        y = BASE - h if up else BASE + h * 0.60
        c = PART_COLOUR[PART_OF[a]]
        wgt = min(3.4, 0.7 + n * 0.5)
        arcs.append(
            f'<path class="arc" d="M{x1:.1f},{BASE} Q{(x1 + x2) / 2:.1f},{y:.1f} {x2:.1f},{BASE}" '
            f'stroke="{c}" stroke-width="{wgt:.2f}" fill="none" '
            f'data-a="{a}" data-b="{b}" data-n="{n}">'
            f'<title>Chapter {a} cites Chapter {b} — {n} reference{"s" if n > 1 else ""}</title></path>')

    nodes = []
    for c in range(1, 27):
        deg = out[c] + inn[c]
        r = 3.2 + min(7.5, deg * 0.42)
        col = PART_COLOUR[PART_OF[c]]
        cls = "node orphan" if c in orphans else "node"
        nodes.append(
            f'<g class="{cls}" data-ch="{c}">'
            f'<a href="code-law-and-capital/chapter-{c:02d}.html">'
            f'<circle cx="{x[c]:.1f}" cy="{BASE}" r="{r:.1f}" fill="{col if deg else "none"}" '
            f'stroke="{col}" stroke-width="1.4"/>'
            f'<text x="{x[c]:.1f}" y="{BASE + 26}" text-anchor="middle" class="lbl">{c}</text>'
            f'<title>Chapter {c} — {html.escape(titles.get(c, ""))}\n'
            f'cites {out[c]}, cited by {inn[c]}</title></a></g>')

    legend = "".join(
        f'<span class="lg"><i style="background:{PART_COLOUR[p]}"></i>'
        f'Part {p:02d} &middot; {html.escape(PART_NAME[p])}</span>' for p in range(1, 8))

    rank = "".join(
        f'<tr><td><a href="code-law-and-capital/chapter-{c:02d}.html">Ch {c}</a></td>'
        f'<td class="t">{html.escape(titles.get(c, ""))}</td>'
        f'<td class="n">{out[c]}</td><td class="n">{inn[c]}</td></tr>'
        for c in sorted(range(1, 27), key=lambda c: -(out[c] + inn[c])))

    page = PAGE
    for k, v in {
        "{{ARCS}}": "".join(arcs), "{{NODES}}": "".join(nodes), "{{LEGEND}}": legend,
        "{{RANK}}": rank, "{{W}}": str(W), "{{H}}": str(BASE + 190),
        "{{EDGES}}": str(len(edges)), "{{REFS}}": str(sum(edges.values())),
        "{{ORPHANS}}": ", ".join(str(o) for o in orphans) or "none",
        "{{NORPH}}": str(len(orphans)),
    }.items():
        page = page.replace(k, v)
    (ROOT / "map.html").write_text(page, encoding="utf-8")
    print(f"map.html  {len(edges)} edges, {sum(edges.values())} references, "
          f"{len(orphans)} unconnected chapters: {orphans}")


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cross-reference map &mdash; JUSNREM Codex</title>
<meta name="description" content="How the Codex cites itself: every internal cross-reference in the published text, drawn as an arc between chapters.">
<link rel="canonical" href="https://jusnrem.digital/map.html">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600&family=Spectral:wght@400&display=swap" rel="stylesheet">
<style>
:root{--ground:#EEF0F0;--surface:#FFFFFF;--ink:#111516;--ink-2:#3C484D;--ink-3:#56676E;
 --gold:#43652E;--rule:#CCD1D4;--rule-2:#DDE1E2;--green:#43652E;
 --sans:Aptos,"Segoe UI",system-ui,Inter,Helvetica,Arial,sans-serif;
 --serif:Georgia,"Iowan Old Style","Times New Roman",serif;}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:400 .95rem/1.6 var(--sans)}
.masthead{position:sticky;top:0;z-index:50;background:rgba(238,240,240,.95);
 backdrop-filter:blur(8px);border-bottom:1px solid var(--rule)}
.masthead .in{max-width:76rem;margin:0 auto;padding:.7rem 1.4rem;display:flex;align-items:center;gap:1.2rem}
.brand{text-decoration:none;color:var(--ink)}
.brand b{display:block;font:600 .78rem/1 var(--sans);letter-spacing:.19em;text-transform:uppercase}
.brand span{display:block;margin-top:.22rem;font:400 .64rem/1 var(--sans);
 letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3)}
.masthead nav{margin-left:auto;display:flex;gap:1.2rem}
.masthead nav a{font:500 .74rem var(--sans);color:var(--ink-2);text-decoration:none}
.masthead nav a:hover{color:var(--gold)}
.wrap{max-width:76rem;margin:0 auto;padding:0 1.4rem}
.head{padding:3rem 0 1.4rem}
h1{margin:0;font:400 clamp(1.9rem,4.2vw,2.7rem)/1.15 var(--serif);letter-spacing:-.012em}
.lede{margin:1.1rem 0 0;max-width:62ch;color:var(--ink-2)}
.stat{margin-top:1.5rem;display:flex;flex-wrap:wrap;gap:.5rem}
.stat b{font:600 .62rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;
 padding:.45rem .65rem;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2)}
.stat b.warn{border-color:var(--gold);color:#2F4720}
figure{margin:1.4rem 0 0;padding:1rem .4rem .4rem;background:var(--surface);
 border:1px solid var(--rule);overflow-x:auto}
svg{display:block;min-width:52rem;width:100%;height:auto}
.arc{opacity:.42;transition:opacity .15s,stroke-width .15s}
.arc:hover{opacity:1;stroke-width:3.4}
svg.focus .arc{opacity:.07}
svg.focus .arc.on{opacity:1}
.lbl{font:600 9px var(--sans);fill:var(--ink-3)}
.node circle{cursor:pointer;transition:r .12s}
.node:hover circle{stroke-width:2.6}
.node.orphan circle{stroke-dasharray:2.5 2.5}
.legend{display:flex;flex-wrap:wrap;gap:.4rem 1.1rem;margin:1rem 0 0}
.lg{display:inline-flex;align-items:center;gap:.4rem;font:500 .72rem var(--sans);color:var(--ink-2)}
.lg i{width:.62rem;height:.62rem;border-radius:2px;display:inline-block}
.note{margin:1.6rem 0 0;padding:1rem 1.15rem;background:rgba(67,101,46,.09);
 border:1px solid var(--gold);border-left-width:4px;max-width:70ch}
.note b{display:block;font:600 .62rem/1 var(--sans);letter-spacing:.15em;
 text-transform:uppercase;color:#2F4720;margin-bottom:.5rem}
.note p{margin:0;font-size:.88rem;line-height:1.6;color:var(--ink-2)}
h2{margin:3rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid var(--rule);
 font:600 1rem var(--sans)}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th{text-align:left;padding:.5rem .6rem;border-bottom:1.2pt solid var(--gold);
 font:600 .68rem var(--sans);letter-spacing:.06em;text-transform:uppercase}
td{padding:.42rem .6rem;border-bottom:1px solid var(--rule-2);vertical-align:top}
td.n{text-align:right;font-variant-numeric:tabular-nums;width:5rem;color:var(--ink-2)}
td.t{color:var(--ink-2)}
td a{color:var(--green);text-decoration:none;font-weight:600;white-space:nowrap}
td a:hover{color:var(--gold)}
footer{padding:3rem 0;margin-top:2rem;border-top:1px solid var(--rule);font-size:.8rem;color:var(--ink-3)}
a{color:var(--green)}
@media (max-width:720px){.masthead nav{display:none}}
</style>
</head>
<body>
<header class="masthead"><div class="in">
  <a class="brand" href="index.html"><b>JUSNREM Codex</b><span>Cross-reference map</span></a>
  <nav><a href="code-law-and-capital/">The Codex</a><a href="search.html">Search</a>
       <a href="authorities.html">Authorities</a></nav>
</div></header>

<div class="wrap">
  <div class="head">
    <h1>How the Codex cites itself</h1>
    <p class="lede">
      Every arc is a cross-reference in the published text. Forward references arc
      above the line, back-references below; the thicker the arc, the more often that
      chapter cites the other. Drawn from the chapters themselves, so it cannot show a
      connection the text does not make &mdash; or hide one it does.
    </p>
    <div class="stat">
      <b>{{EDGES}} connections</b><b>{{REFS}} references</b>
      <b class="warn">{{NORPH}} chapters unconnected</b>
    </div>
  </div>

  <figure>
    <svg id="g" viewBox="0 0 {{W}} {{H}}" role="img"
         aria-label="Arc diagram of cross-references between the 26 chapters">
      <line x1="40" y1="300" x2="{{W}}" y2="300" stroke="#CCD1D4" stroke-width="1"
            transform="translate(-20,0)"/>
      {{ARCS}}
      {{NODES}}
    </svg>
  </figure>
  <div class="legend">{{LEGEND}}</div>

  <div class="note">
    <b>What the shape shows</b>
    <p>
      Chapters {{ORPHANS}} carry no cross-reference in either direction &mdash; drawn
      with a dashed outline and no arcs. They neither cite the rest of the work nor are
      cited by it. For a treatise that argues an integrated analysis, that is a
      structural observation rather than a defect in the drawing.
    </p>
  </div>

  <h2>Chapters by connectedness</h2>
  <table>
    <thead><tr><th>Chapter</th><th>Title</th><th class="n">Cites</th><th class="n">Cited by</th></tr></thead>
    <tbody>{{RANK}}</tbody>
  </table>

  <footer>
    Generated from the published text. &copy; 2026 KSC.JUSNREM.
  </footer>
</div>

<script>
/* Hovering a chapter isolates the references it takes part in. */
const svg = document.getElementById('g');
const arcs = [...svg.querySelectorAll('.arc')];
svg.querySelectorAll('.node').forEach(g => {
  const ch = g.dataset.ch;
  const on = () => {
    svg.classList.add('focus');
    arcs.forEach(a => a.classList.toggle('on', a.dataset.a === ch || a.dataset.b === ch));
  };
  const off = () => { svg.classList.remove('focus'); arcs.forEach(a => a.classList.remove('on')); };
  g.addEventListener('mouseenter', on);
  g.addEventListener('mouseleave', off);
  g.addEventListener('focusin', on);
  g.addEventListener('focusout', off);
});
</script>
</body>
</html>
"""

if __name__ == "__main__":
    build()
