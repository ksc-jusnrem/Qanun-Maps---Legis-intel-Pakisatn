"""Give every platform page the same header, menu and sign-in link.

Run after any generator (build_apparatus, build_map, build_doctrines), which
still emit their own mastheads:

    python tools/unify_chrome.py

Idempotent. Chapter pages keep their reader header and are not touched.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (href from site root, label, key)
NAV = [
    ("code-law-and-capital/", "Library", "library"),
    ("search.html", "Search", "search"),
    ("authorities.html", "Authorities", "authorities"),
    ("doctrines.html", "Doctrines", "doctrines"),
    ("map.html", "Map", "map"),
]

PAGES = {
    "index.html": ("home", "Legal Intelligence Ecosystem", [
        ("#libraries", "Libraries"), ("#governance", "Governance"), ("#ecosystem", "Ecosystem")]),
    "search.html": ("search", "Search", []),
    "authorities.html": ("authorities", "Table of Authorities", []),
    "map.html": ("map", "Cross-reference map", []),
    "doctrines.html": ("doctrines", "Doctrine Register", []),
    "account.html": ("account", "Your account", []),
    "code-law-and-capital/index.html": ("library", "Code, Law and Capital", [
        ("#question", "The question"), ("#test", "The test"), ("#codex", "Chapters"),
        ("#doctrines", "Doctrines"), ("#reference", "Reference"), ("#status", "Status")]),
}

HEADER_RE = re.compile(r'<header class="(?:masthead|masthead site-head)">.*?</header>\n?'
                       r'(?:<div class="site-sub">.*?</div></div>\n)?', re.S)
Q_RE = re.compile(r'\s*(<input id="q"[^>]*>)')


def header(key, sub, anchors, base):
    links = []
    for href, label, k in NAV:
        cur = ' aria-current="page"' if k == key else ""
        links.append(f'<a href="{base}{href}"{cur}>{label}</a>')
    html = (
        '<header class="masthead site-head"><div class="in">\n'
        f'  <a class="brand" href="{base}index.html"><b>JUSNREM Codex</b><span>{sub}</span></a>\n'
        '  <nav aria-label="Site">' + "".join(links) + "</nav>\n"
        "</div></header>\n"
    )
    if anchors:
        html += ('<div class="site-sub"><div class="in" aria-label="On this page">'
                 + "".join(f'<a href="{h}">{t}</a>' for h, t in anchors) + "</div></div>\n")
    return html


def run():
    for rel, (key, sub, anchors) in PAGES.items():
        path = ROOT / rel
        s = path.read_text(encoding="utf-8")
        base = "../" if "/" in rel else ""
        m = HEADER_RE.search(s)
        if not m:
            print("no header:", rel)
            continue
        old = m.group(0)
        q = Q_RE.search(old)
        new = header(key, sub, anchors, base)
        if q:  # page filter box moves out of the header, under it
            new += f'<div class="page-tools">{q.group(1)}</div>\n'
        s = s[:m.start()] + new + s[m.end():]
        css = f'<link rel="stylesheet" href="{base}assets/css/codex-chrome.css">'
        if css not in s:
            s = s.replace("</head>", css + "\n</head>", 1)
        js = (f'<script src="{base}assets/js/codex-config.js"></script>\n'
              f'<script src="{base}assets/js/codex-auth.js"></script>')
        if "codex-auth.js" not in s:
            s = s.replace("</body>", js + "\n</body>", 1)
        path.write_text(s, encoding="utf-8")
        print("ok", rel)


if __name__ == "__main__":
    run()
