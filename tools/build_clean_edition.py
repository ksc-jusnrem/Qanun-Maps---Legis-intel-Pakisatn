#!/usr/bin/env python3
"""
Build a clean public reading edition from a Code, Law and Capital editorial Reader.

Reads only the READ pane of a Reader file. Discards the editorial apparatus
(stage panes, history, tab bar, per-paragraph marking controls, export bar,
build stamps, all-stage search index) and re-renders the prose in the
v0.20 "Designed" visual identity with web reading mechanics.

The source Reader is never modified. Output is a new file.

Usage:
    python build_clean_edition.py <reader.html> <output.html>
"""

import html
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- v0.20 tokens
GREEN = "#43652E"
GOLD = "#43652E"
INK = "#111516"
INK_HEAD = "#111516"
INK_SOFT = "#22292C"
INK_MUTE = "#56676E"
CREAM = "#FFFFFF"
BACKDROP = "#EEF0F0"
RULE = "#CCD1D4"
RULE_FAINT = "#EEF0F0"
OXBLOOD = "#652E43"


PARTS = {  # chapter -> part number, per the Codex architecture
    **{c: 1 for c in range(1, 7)}, **{c: 2 for c in range(7, 10)},
    **{c: 3 for c in range(10, 14)}, **{c: 4 for c in range(14, 18)},
    **{c: 5 for c in range(18, 23)}, **{c: 6 for c in range(23, 26)}, 26: 7,
}
WORDS = ("One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen "
         "Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen Twenty Twenty-One "
         "Twenty-Two Twenty-Three Twenty-Four Twenty-Five Twenty-Six").split()


def eyebrow_for(slug: str) -> str:
    """The line above the chapter title, derived from the unit rather than fixed."""
    if slug == "front-matter":
        return "Front matter &middot; print apparatus"
    if slug == "back-matter":
        return "Back matter &middot; print apparatus"
    if slug.startswith("chapter-"):
        n = int(slug.split("-")[1])
        return f"Chapter {WORDS[n - 1]} &middot; Part {PARTS.get(n, '')}".strip()
    return "Code, Law and Capital"


CHAPTERS = {
    1: "The Governing Thesis: Code, Law and Capital",
    2: "From Electronic Value to the Global Digital-Asset Order",
    3: "Pakistan’s Digital-Asset Order: From Perimeter Preservation to Statutory Recognition",
    4: "Code: Digital-Asset Technologies, Functions and Control",
    5: "Law: Authority, Interpretation and the Digital Legal Order",
    6: "Capital: Markets, Monetary Sovereignty and Distribution",
    7: "Pakistan’s Digital, Electronic and ICT Legal Architecture",
    8: "The Virtual Assets Act 2026 and PVARA",
    9: "Market Entry, Existing Participants and Transitional Legality",
    10: "The Monetary and Financial Perimeter",
    11: "Property, Custody, Customer Assets, Insolvency and Market Conduct",
    12: "Financial Integrity, Sanctions and Evidentiary Enforcement",
    13: "Fiscal Order: Recognition, Taxation, Disclosure and Public Finance",
    14: "Data, Cybersecurity, Digital Identity and Evidence",
    15: "Smart Contracts, DeFi, DAOs and Autonomous Systems",
    16: "Institutional Integrity, Federalism and Cross-Border Administration",
    17: "Enforcement, Tribunal, Courts and Constitutional Remedies",
    18: "The United States: Markets, Enforcement and the Contest for Regulatory Authority",
    19: "The United Kingdom and European Legal Orders",
    20: "Asian and Asia-Pacific Digital-Asset Orders",
    21: "GCC and Middle Eastern Digital-Asset Orders",
    22: "ASEAN and Emerging Regional Models",
    23: "Global Standards and Transnational Regulatory Coordination",
    24: "Public International Law and Digital Assets",
    25: "Private International Law and Cross-Border Digital Assets",
    26: "Building Pakistan’s Digital-Asset Order",
}
PART_NAMES = {
    1: "Foundations and the Governing Triad",
    2: "Pakistan’s Digital and Virtual-Asset Legal Order",
    3: "Financial, Property, Integrity and Fiscal Order",
    4: "Digital Systems, Institutions, Rights and Remedies",
    5: "Comparative Digital-Asset Orders",
    6: "Global Standards and International Law",
    7: "Building Pakistan’s Future Digital-Asset Order",
}


def work_nav(current: str, chapter_toc: str = "") -> str:
    """The whole Codex, on every page, with the current unit expanded.

    A reader inside one chapter must be able to reach any other without
    returning to the library index.
    """
    out, seen = [], None
    for n, title in CHAPTERS.items():
        part = PARTS[n]
        if part != seen:
            seen = part
            out.append(f'<li class="pt"><span>Part {part:02d} &middot; '
                       f'{html.escape(PART_NAMES[part])}</span></li>')
        slug = f"chapter-{n:02d}"
        here = " here" if slug == current else ""
        out.append(f'<li class="ch{here}"><a href="{slug}.html">'
                   f'<b>{n:02d}</b> {html.escape(title)}</a>'
                   + (chapter_toc if here else "") + "</li>")
    for slug, label in (("front-matter", "Front matter"), ("back-matter", "Back matter")):
        here = " here" if slug == current else ""
        out.append(f'<li class="ch app{here}"><a href="{slug}.html"><b>&mdash;</b> {label}</a>'
                   + (chapter_toc if here else "") + "</li>")
    return "".join(out)


def read_pane(src: str) -> str:
    """Isolate the READ pane; everything else in the Reader is apparatus."""
    start = src.index('<div class="pane on" id="read">')
    end = src.find('<div class="pane"', start)
    return src[start : end if end > 0 else len(src)]


def strip_controls(fragment: str) -> str:
    """Remove marking buttons and per-paragraph tooling, keeping prose intact."""
    # Readers differ between build generations: section marks appear as a <span>
    # in some and a <div> in others. Strip both, or the control labels
    # ("recover superseded later") end up inside published heading text.
    fragment = re.sub(r'<span class="secmarks">.*?</span>', "", fragment, flags=re.S)
    fragment = re.sub(r'<div class="secmarks">.*?</div>', "", fragment, flags=re.S)
    fragment = re.sub(r'<div class="marks">.*?</div>', "", fragment, flags=re.S)
    fragment = re.sub(r'<span class="marks">.*?</span>', "", fragment, flags=re.S)
    fragment = re.sub(r'<div class="ptools">.*?</div>', "", fragment, flags=re.S)
    fragment = re.sub(r'<span class="ptools">.*?</span>', "", fragment, flags=re.S)
    return fragment


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse(pane: str) -> dict:
    doc = {"title": "", "subtitle": "", "blocks": [], "notes": []}

    m = re.search(r'<h1 class="chtitle">(.*?)</h1>', pane, re.S)
    doc["title"] = m.group(1).strip() if m else "Chapter"
    m = re.search(r'<div class="subtitle">(.*?)</div>', pane, re.S)
    doc["subtitle"] = m.group(1).strip() if m else ""

    # Footnote definitions live in a trailing .notes block.
    m = re.search(r'<div class="notes">.*?<ol>(.*?)</ol>', pane, re.S)
    if m:
        for li in re.finditer(r'<li id="(fn\d+)">(.*?)</li>', m.group(1), re.S):
            body = re.sub(r'<a class="backref".*?</a>\s*', "", li.group(2), flags=re.S)
            doc["notes"].append((li.group(1), link_urls(body.strip())))
        pane = pane[: pane.index('<div class="notes">')]

    # Walk headings and paragraphs in document order.
    STOP = (r'(?=<div class="para"|<(?:h[2-4]) id=|<figure'
            r'|<div class="(?:caption|figurenote|tablewrap)"|<table|$)')
    pattern = re.compile(
        # Two Reader generations exist: newer builds write class="hsec sec",
        # older builds write a bare <h2 id="s2-1">. Inner markup is identical,
        # so the class is optional here.
        r'<(h[2-4]) id="(s[\w-]*|sx\d+)"(?:\s+class="(?:hsec sec|sec hsec)")?[^>]*>(.*?)</\1>'
        r'|<div class="para" id="(p\d+)" data-pid="\4">(.*?)' + STOP +
        r'|<figure([^>]*)>\s*<img([^>]*)>\s*</figure>'
        r'|<div class="tablewrap">\s*(<table.*?</table>)\s*</div>'
        r'|<div class="caption">(.*?)</div>'
        r'|<div class="figurenote">(.*?)</div>',
        re.S,
    )
    for m in pattern.finditer(pane):
        if m.group(1):
            inner = strip_controls(m.group(3))
            num = re.search(r'<span class="num">(.*?)</span>', inner)
            label = num.group(1).strip() if num else ""
            title = text_of(re.sub(r'<span class="num">.*?</span>', "", inner, flags=re.S))
            doc["blocks"].append(
                {"kind": "heading", "level": int(m.group(1)[1]), "id": m.group(2),
                 "num": label, "title": title}
            )
        elif m.group(4):
            body = strip_controls(m.group(5))
            t = re.search(r'<div class="ptext"[^>]*>(.*?)</div>\s*</div>\s*$', body, re.S)
            if not t:
                t = re.search(r'<div class="ptext"[^>]*>(.*?)</div>', body, re.S)
            doc["blocks"].append(
                {"kind": "para", "id": m.group(4), "num": m.group(4)[1:],
                 "html": (t.group(1) if t else body).strip()}
            )
        elif m.group(7) is not None:
            doc["blocks"].append({"kind": "figure",
                                  "figattrs": (m.group(6) or "").strip(),
                                  "attrs": m.group(7).strip()})
        elif m.group(8) is not None:
            doc["blocks"].append({"kind": "table", "html": m.group(8).strip()})
        elif m.group(9) is not None:
            doc["blocks"].append({"kind": "caption", "html": m.group(9).strip()})
        else:
            doc["blocks"].append({"kind": "fignote", "html": m.group(10).strip()})
    return doc


def link_urls(fragment: str) -> str:
    """Make cited URLs clickable.

    OSCOLA wraps a URL in angle brackets because paper cannot be clicked. In the
    Codex the bracket convention is kept for citation fidelity, but the address
    inside it becomes a link.
    """
    def one(m):
        url = m.group(1).rstrip(".,;")
        tail = m.group(1)[len(url):]
        return (f'&lt;<a class="cite-url" href="{url}" target="_blank" '
                f'rel="noopener noreferrer">{url}</a>&gt;{tail}')

    fragment = re.sub(r"&lt;(https?://[^&\s]+)&gt;", one, fragment)
    # any remaining bare address, not already inside an anchor
    parts = re.split(r"(<a.*?</a>)", fragment, flags=re.S)
    for i, part in enumerate(parts):
        if part.startswith("<a"):
            continue
        parts[i] = re.sub(
            r"(?<![\">])(https?://[^\s<>&\"]+)",
            lambda m: f'<a class="cite-url" href="{m.group(1).rstrip(".,;")}" '
                      f'target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
            part)
    return "".join(parts)


def linkify(fragment: str, self_slug: str, sections: dict, misses: list) -> str:
    """Turn internal cross-references into working links.

    A treatise this heavily cross-referenced should let a reader follow a
    reference where it points. References that cannot be resolved are recorded
    rather than silently left as text, so a broken pointer is visible.
    """
    if not fragment:
        return fragment

    # Never linkify inside an existing anchor, or inside tag attributes.
    parts = re.split(r'(<[^>]+>)', fragment)

    def sub_text(txt: str) -> str:
        def chapter(m):
            n = int(m.group(1))
            if not 1 <= n <= 26:
                return m.group(0)
            slug = f"chapter-{n:02d}"
            if slug == self_slug:
                return m.group(0)          # a chapter does not link to itself
            return (f'<a class="xref" href="{slug}.html" '
                    f'title="{html.escape(CHAPTERS[n])}">{m.group(0)}</a>')

        def section(m):
            num = m.group(2)
            ch = int(num.split(".")[0])
            target = sections.get(num)
            if not target:
                misses.append((self_slug, m.group(0)))
                return m.group(0)
            slug, anchor = target
            href = f"#{anchor}" if slug == self_slug else f"{slug}.html#{anchor}"
            return f'{m.group(1)}<a class="xref" href="{href}">{num}</a>'

        txt = re.sub(r'\bChapter (\d{1,2})\b', chapter, txt)
        txt = re.sub(r'\b(sections? )(\d{1,2}\.\d[\d.]*)', section, txt)
        return txt

    out, depth = [], 0
    for part in parts:
        if part.startswith("<"):
            if part.startswith("<a "):
                depth += 1
            elif part.startswith("</a"):
                depth = max(0, depth - 1)
            out.append(part)
        else:
            out.append(part if depth else sub_text(part))
    return "".join(out)


READING_ORDER = (["front-matter"] + [f"chapter-{n:02d}" for n in range(1, 27)]
                 + ["back-matter"])


def pager_for(slug: str) -> str:
    """Previous unit, contents, next unit — present at every width.

    The sidebar carries the whole work, but it is hidden below 960px, so without
    this a reader who reaches the end of a chapter on a phone has no way forward.
    """
    if slug not in READING_ORDER:
        return ""

    def label(s):
        if s == "front-matter":
            return "Front matter", ""
        if s == "back-matter":
            return "Back matter", ""
        n = int(s.split("-")[1])
        return f"Chapter {n}", CHAPTERS.get(n, "")

    i = READING_ORDER.index(slug)
    prev_s = READING_ORDER[i - 1] if i > 0 else None
    next_s = READING_ORDER[i + 1] if i < len(READING_ORDER) - 1 else None

    def cell(s, side):
        if not s:
            return '<span class="pg-end"></span>'
        eyebrow, title = label(s)
        arrow = "&larr;" if side == "prev" else "&rarr;"
        return (f'<a class="pg-{side}" href="{s}.html">'
                f'<span class="pg-dir">{arrow} {"Previous" if side == "prev" else "Next"}</span>'
                f'<span class="pg-ch">{html.escape(eyebrow)}</span>'
                + (f'<span class="pg-ti">{html.escape(title)}</span>' if title else "")
                + '</a>')

    return ('<nav class="pager" aria-label="Chapter navigation">'
            + cell(prev_s, "prev")
            + '<a class="pg-all" href="index.html">All chapters</a>'
            + cell(next_s, "next")
            + '</nav>')


def render(doc: dict, note_map: dict, sections: dict | None = None,
           misses: list | None = None) -> str:
    sections = sections or {}
    misses = misses if misses is not None else []
    contents, body = [], []
    blocks = doc["blocks"]
    for i, b in enumerate(blocks):
        if b["kind"] in ("caption", "fignote"):
            continue  # emitted with the figure they belong to
        if b["kind"] == "table":
            body.append(f'<div class="tablewrap">{b["html"]}</div>')
            continue
        if b["kind"] == "figure":
            # The caption and the accessible description follow the image.
            cap = next((x["html"] for x in blocks[i + 1 : i + 3] if x["kind"] == "caption"), "")
            note = next((x["html"] for x in blocks[i + 1 : i + 3] if x["kind"] == "fignote"), "")
            attrs = re.sub(r'\salt="[^"]*"', "", b["attrs"])
            decorative = (
                "aria-hidden" in b.get("figattrs", "")
                or (not cap and not note and 'alt=""' in b["attrs"])
            )
            if decorative:
                # An ornament carries no information: keep it, but keep it silent
                # for assistive technology rather than inventing a description.
                body.append(
                    f'<figure class="ornament" aria-hidden="true">'
                    f'<img {attrs} alt=""></figure>'
                )
            else:
                alt = html.escape(text_of(note or cap), quote=True)
                body.append(
                    f'<figure><img {attrs} alt="{alt}">'
                    + (f'<figcaption>{cap}</figcaption>' if cap else "")
                    + (f'<p class="fignote">{note}</p>' if note else "")
                    + "</figure>"
                )
            continue
        if b["kind"] == "heading":
            lvl = b["level"]
            label = f'<span class="num">{b["num"]}</span> ' if b["num"] else ""
            body.append(
                f'<h{lvl} id="{b["id"]}" class="sec lvl{lvl}">{label}{html.escape(b["title"])}</h{lvl}>'
            )
            contents.append(
                f'<li class="toc-l{lvl}"><a href="#{b["id"]}">'
                f'{html.escape((b["num"] + " " + b["title"]).strip())}</a></li>'
            )
        else:
            body.append(
                f'<div class="para" id="{b["id"]}">'
                f'<a class="pnum" href="#{b["id"]}" aria-label="Paragraph {b["num"]}">{b["num"]}</a>'
                f'<div class="ptext">{linkify(b["html"], doc.get("slug", ""), sections, misses)}</div></div>'
            )

    notes_html = "".join(
        f'<li id="{fid}"><a class="backref" href="#{fid.replace("fn", "fnref")}" '
        f'aria-label="Back to text">&#8593;</a> {txt}</li>'
        for fid, txt in doc["notes"]
    )

    return TEMPLATE.format(
        eyebrow=doc.get("eyebrow", "Code, Law and Capital"),
        title=doc["title"],
        title_text=html.escape(text_of(doc["title"])),
        subtitle=doc["subtitle"],
        contents="".join(contents),
        pager=pager_for(doc.get("slug", "")),
        worknav=work_nav(doc.get("slug", ""),
                         '<ol class="seclist">' + "".join(contents) + "</ol>"),
        body="".join(body),
        notes=notes_html,
        note_data=note_map,
        **TOKENS,
    )


TOKENS = dict(
    green=GREEN, gold=GOLD, ink=INK, ink_head=INK_HEAD, ink_soft=INK_SOFT,
    ink_mute=INK_MUTE, cream=CREAM, backdrop=BACKDROP, rule=RULE,
    rule_faint=RULE_FAINT, oxblood=OXBLOOD,
)

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title_text} &mdash; Code, Law and Capital</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root{{
  --green:{green}; --gold:{gold}; --surface:#FFFFFF; --ink:{ink}; --ink-head:{ink_head};
  --ink-soft:{ink_soft}; --ink-mute:{ink_mute}; --cream:{cream};
  --backdrop:{backdrop}; --rule:{rule}; --rule-faint:{rule_faint}; --oxblood:{oxblood};
  --gold-text:#2F4720;   /* 4.98:1 on ground - gold as TEXT */
  --gold-on-dark:#FFFFFF; /* 5.00:1 on the green masthead */
  --sans:Archivo,"Helvetica Neue",Arial,sans-serif;
  --serif:Spectral,Georgia,"Times New Roman",serif;
  --display:"Cormorant Garamond",Georgia,serif;
}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth;scroll-padding-top:5rem}}
:where(a,button,[tabindex]):focus-visible{{outline:2px solid var(--gold-text);outline-offset:2px}}
body{{margin:0;background:var(--backdrop);color:var(--ink);font:400 1.0625rem/1.65 var(--serif)}}

/* ---- masthead ---- */
.masthead{{position:sticky;top:0;z-index:40;background:var(--green);color:var(--cream);
  border-bottom:2px solid var(--gold);display:flex;align-items:center;gap:1rem;
  padding:.6rem 1.1rem;font-family:var(--sans)}}
.masthead .work{{font:600 .72rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;
  color:var(--cream);text-decoration:none;white-space:nowrap}}
.masthead .work span{{color:rgba(255,255,255,.72)}}
.masthead form{{margin-left:auto;display:flex;align-items:center}}
#q{{font:400 .82rem var(--sans);padding:.32rem .6rem;width:14rem;max-width:38vw;
  border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.10);
  color:var(--cream);border-radius:2px}}
#q::placeholder{{color:rgba(255,255,255,.60)}}
.allsearch{{margin-left:.6rem;font:600 .64rem/1 var(--sans);letter-spacing:.1em;
  text-transform:uppercase;color:var(--gold-on-dark);text-decoration:none;white-space:nowrap}}
.allsearch:hover{{color:var(--cream)}}
#q:focus{{outline:2px solid var(--gold);outline-offset:1px}}
#navtoggle{{display:none;font:600 .72rem var(--sans);letter-spacing:.12em;text-transform:uppercase;
  background:none;border:1px solid rgba(255,255,255,.4);color:var(--cream);
  padding:.3rem .55rem;border-radius:2px;cursor:pointer}}

/* ---- shell ---- */
.shell{{display:grid;grid-template-columns:17rem minmax(0,1fr);gap:0;
  max-width:76rem;margin:0 auto;align-items:start}}

/* ---- sidebar ---- */
.sidebar{{position:sticky;top:3.1rem;max-height:calc(100vh - 3.1rem);overflow-y:auto;
  padding:1.6rem 1rem 3rem 1.2rem;font-family:var(--sans);
  border-right:1px solid var(--rule)}}
.sidebar .up{{display:block;font:600 .64rem/1.4 var(--sans);letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-mute);text-decoration:none;margin-bottom:1rem}}
.sidebar .up:hover{{color:var(--gold)}}
.sidebar h2{{font:600 .68rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink-head);margin:0 0 .8rem;padding-bottom:.6rem;border-bottom:1px solid var(--rule)}}
.sidebar ol{{list-style:none;margin:0;padding:0}}

/* the whole work, on every page */
.worknav .pt span{{display:block;margin:1rem 0 .35rem;font:600 .58rem/1.35 var(--sans);
  letter-spacing:.14em;text-transform:uppercase;color:var(--gold-text)}}
.worknav .ch a{{display:flex;gap:.5rem;padding:.26rem .4rem;font-size:.76rem;line-height:1.35;
  color:var(--ink-soft);text-decoration:none;border-left:2px solid transparent;border-radius:2px}}
.worknav .ch a b{{flex:none;font-weight:600;color:#56676E;font-variant-numeric:tabular-nums}}
.worknav .ch a:hover{{color:var(--green);background:rgba(67,101,46,.08)}}
.worknav .ch a:hover b{{color:var(--gold)}}
.worknav .ch.here > a{{color:var(--green);font-weight:600;border-left-color:var(--gold);
  background:rgba(67,101,46,.10)}}
.worknav .ch.here > a b{{color:var(--gold)}}
.worknav .ch.app a{{color:var(--ink-mute);font-style:italic}}
.worknav .seclist{{margin:.2rem 0 .5rem;padding:0 0 0 1.35rem;
  border-left:1px solid var(--rule)}}
.worknav .seclist a{{display:block;padding:.16rem .4rem;font-size:.72rem;line-height:1.35;
  color:var(--ink-mute);text-decoration:none;border-left:2px solid transparent}}
.worknav .seclist a:hover{{color:var(--green)}}
.worknav .seclist a.here{{color:var(--green);font-weight:600;border-left-color:var(--gold)}}
.worknav .seclist .toc-l3 a{{padding-left:.9rem}}
.worknav .seclist .toc-l4 a{{padding-left:1.6rem}}

/* breadcrumb */
.crumb{{margin:0 0 1.6rem;font:500 .74rem/1.5 var(--sans);color:var(--ink-mute)}}
.crumb a{{color:var(--ink-soft);text-decoration:none;border-bottom:1px solid var(--rule)}}
.crumb a:hover{{color:var(--gold);border-bottom-color:var(--gold)}}
.crumb span{{margin:0 .45rem;color:var(--rule)}}
.crumb em{{font-style:normal;color:var(--ink)}}

/* on this page, in the reading column */
.onthispage{{margin:0 0 2.4rem;padding:1.1rem 1.3rem;background:var(--surface);
  border:1px solid var(--rule)}}
.onthispage h2{{margin:0 0 .7rem;font:600 .62rem/1 var(--sans);letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-mute)}}
.onthispage ol{{list-style:none;margin:0;padding:0;columns:2;column-gap:2rem}}
.onthispage li{{break-inside:avoid;margin:.12rem 0}}
.onthispage a{{font-size:.82rem;line-height:1.45;color:var(--green);text-decoration:none;
  border-bottom:1px solid transparent}}
.onthispage a:hover{{border-bottom-color:var(--gold);color:var(--gold)}}
.onthispage .toc-l3 a{{padding-left:.9rem;font-size:.78rem;color:var(--ink-soft)}}
.onthispage .toc-l4 a{{padding-left:1.7rem;font-size:.76rem;color:var(--ink-mute)}}
@media (max-width:640px){{.onthispage ol{{columns:1}}}}

/* ---- sheet ---- */
.sheet{{background:var(--surface);border-left:1px solid var(--rule);border-right:1px solid var(--rule);
  padding:3rem 3.4rem 5rem;min-height:100vh}}
/* ---- chapter cover band, after the v0.20 cover ---- */
.cover{{position:relative;margin:-3rem -3.4rem 2.4rem;padding:2.6rem 3.4rem 2.4rem;
  background:var(--green);color:var(--cream);overflow:hidden}}
.cover .plate{{position:absolute;inset:0;background:url("assets/clc-cover.jpg") center/cover no-repeat;
  opacity:.20;filter:grayscale(.25)}}
.cover .frame{{position:absolute;inset:.7rem;border:2px solid rgba(255,255,255,.40);
  pointer-events:none}}
.cover > *:not(.plate):not(.frame){{position:relative}}
.cover .eyebrow{{font:600 .68rem/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;
  color:var(--gold-on-dark);margin-bottom:1rem}}
.cover .rule{{display:flex;align-items:center;gap:.6rem;margin:.9rem 0 0;width:60%}}
.cover .rule i{{display:block;width:5px;height:5px;background:var(--gold);transform:rotate(45deg)}}
.cover .rule b{{flex:1;height:1px;background:rgba(255,255,255,.5)}}
h1{{margin:0;font:600 2.5rem/1.12 var(--display);color:var(--cream);text-wrap:balance}}
.cover .subtitle{{margin-top:.7rem;font:500 1.12rem/1.35 var(--display);font-style:italic;
  color:var(--gold-on-dark)}}
.cover .byline{{margin-top:1.1rem;font:500 .72rem/1 var(--sans);letter-spacing:.28em;
  text-transform:uppercase;color:rgba(255,255,255,.85)}}

h2.sec{{margin:2.6rem 0 .9rem;padding-bottom:.4rem;border-bottom:1px solid var(--rule);
  font:600 1.32rem/1.3 var(--sans);letter-spacing:.02em;color:var(--ink-head);text-wrap:balance}}
h3.sec{{margin:2rem 0 .6rem;font:600 1.08rem/1.35 var(--display);color:var(--oxblood);text-wrap:balance}}
h4.sec{{margin:1.5rem 0 .5rem;font:600 .95rem/1.35 var(--sans);color:var(--ink-soft)}}
.sec .num{{color:var(--gold-text);font-variant-numeric:tabular-nums}}

/* ---- paragraphs ---- */
.para{{position:relative;margin:0 0 1.05rem;padding-left:2.6rem;scroll-margin-top:5rem}}
.pnum{{position:absolute;left:0;top:.28rem;width:2rem;text-align:right;
  font:500 .68rem/1 var(--sans);color:#56676E;text-decoration:none;
  font-variant-numeric:tabular-nums;transition:color .12s}}
.para:hover .pnum,.pnum:focus{{color:var(--gold-text)}}
.para:target .ptext{{background:rgba(67,101,46,.09);box-shadow:-.5rem 0 0 rgba(67,101,46,.09),.5rem 0 0 rgba(67,101,46,.09)}}
.ptext{{max-width:34rem;text-align:left;text-wrap:pretty}}
.ptext em{{font-style:italic}}
a.xref{{color:var(--green);text-decoration:none;border-bottom:1px solid rgba(47,71,32,.32);
  transition:border-color .12s,color .12s}}
a.xref:hover{{color:var(--gold);border-bottom-color:var(--gold)}}
a.xref::after{{content:"↗";font-size:.72em;vertical-align:.35em;margin-left:.1em;
  color:var(--gold);opacity:.7}}
@media print{{a.xref{{border-bottom:0;color:inherit}} a.xref::after{{content:""}}}}
.ptext ul.condlist{{margin:.6rem 0 .6rem 1.15rem;padding:0;list-style:disc}}
.ptext ul.condlist li{{margin:.42rem 0}}
.ptext ul.condlist strong{{font-weight:600;color:var(--ink-head)}}

/* ---- figures ---- */
figure{{margin:2.2rem 0;max-width:none}}
img{{max-width:100%;height:auto;display:block;border:1px solid var(--rule-faint)}}
figcaption{{margin-top:.7rem;font:600 1.02rem/1.35 var(--display);color:var(--oxblood)}}
.fignote{{margin:.5rem 0 0;font:italic 400 .82rem/1.5 var(--serif);color:var(--ink-mute)}}
.tablewrap{{margin:1.8rem 0;max-width:none;overflow-x:auto;-webkit-overflow-scrolling:touch}}
.tablewrap table{{border-collapse:collapse;width:100%;min-width:34rem;
  font:400 .84rem/1.5 var(--sans)}}
.tablewrap th{{text-align:left;padding:.55rem .7rem;border-bottom:1.2pt solid var(--gold);
  font:600 .74rem/1.4 var(--sans);color:var(--ink-head);vertical-align:bottom}}
.tablewrap td{{padding:.5rem .7rem;border-bottom:1px solid var(--rule-faint);
  vertical-align:top;color:var(--ink)}}
.tablewrap tr:last-child td{{border-bottom:0}}
.tablewrap th strong,.tablewrap td strong{{font-weight:600}}
figure.ornament{{margin:2rem auto;max-width:16rem;opacity:.55}}
figure.ornament img{{border:0}}

/* ---- footnotes: inline popover, print endnotes ---- */
sup.fnref{{line-height:0}}
sup.fnref a,button.fnbtn{{font:600 .62rem/1 var(--sans);color:#fff;background:var(--green);
  border:0;border-radius:2px;padding:.12rem .3rem;margin:0 .1rem;cursor:pointer;
  text-decoration:none;vertical-align:super;font-variant-numeric:tabular-nums}}
button.fnbtn:hover,button.fnbtn[aria-expanded=true]{{background:var(--gold)}}
.fnpop{{position:absolute;z-index:60;max-width:min(30rem,88vw);background:#fff;
  border:1px solid var(--gold);border-top:3px solid var(--gold);
  box-shadow:0 6px 24px rgba(36,30,19,.22);padding:.8rem .95rem;
  font:400 .84rem/1.5 var(--serif);color:var(--ink-soft);border-radius:2px}}
.fnpop .close{{float:right;margin:-.3rem -.3rem 0 .5rem;border:0;background:none;
  font:600 .95rem/1 var(--sans);color:var(--ink-mute);cursor:pointer}}
.pager{{display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:stretch;
  margin:3rem 0 0;padding-top:1.6rem;border-top:1px solid var(--rule)}}
.pager a{{display:flex;flex-direction:column;gap:.2rem;padding:.9rem 1rem;
  text-decoration:none;color:var(--ink);border:1px solid var(--rule);
  background:var(--surface);min-height:44px;justify-content:center;transition:border-color .15s}}
.pager a:hover{{border-color:var(--gold-text)}}
.pg-next{{text-align:right}}
.pg-dir{{font:600 .6rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;
  color:var(--gold-text)}}
.pg-ch{{font:600 .84rem/1.3 var(--sans)}}
.pg-ti{{font:400 .8rem/1.35 var(--serif);color:var(--ink-mute)}}
.pg-all{{align-self:center;font:600 .64rem/1 var(--sans);letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-2);white-space:nowrap;flex-direction:row}}
.pg-end{{display:block}}
@media (max-width:640px){{
  .pager{{grid-template-columns:1fr;gap:.5rem}}
  .pg-next{{text-align:left}}
  .pg-all{{order:3;justify-content:center}}
}}
@media print{{.pager{{display:none}}}}
.notes{{margin-top:3.5rem;border-top:1px solid var(--rule);padding-top:1.4rem}}
.notes h2{{font:600 .72rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink-mute);margin:0 0 1rem}}
.notes ol{{margin:0;padding-left:1.4rem}}
.notes li{{margin:.45rem 0;font-size:.85rem;line-height:1.5;color:var(--ink-soft);
  scroll-margin-top:5rem}}
.notes li:target{{background:rgba(67,101,46,.10)}}
.backref{{color:var(--gold-text);text-decoration:none;margin-right:.25rem}}
a.cite-url{{color:var(--green);text-decoration:none;border-bottom:1px solid rgba(67,101,46,.3);
  word-break:break-word}}
a.cite-url:hover{{color:var(--gold);border-bottom-color:var(--gold)}}
@media print{{a.cite-url{{border-bottom:0;color:inherit}}}}
a{{color:var(--green)}}
a:hover{{color:var(--gold)}}

/* ---- search ---- */
mark{{background:rgba(105,132,88,.38);color:inherit;padding:0 .08em}}
.nohit{{display:none}}
#searchnote{{font:500 .76rem var(--sans);color:var(--ink-mute);margin:1rem 0 0}}

/* ---- responsive ---- */
@media (max-width:960px){{
  .shell{{grid-template-columns:minmax(0,1fr)}}
  .sheet{{min-width:0}}
  .sidebar{{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--rule);
    display:none;background:#fff}}
  .sidebar.open{{display:block}}
  #navtoggle{{display:inline-block}}
  .sheet{{padding:1.8rem 1.25rem 3.5rem;border:0}}
  .cover{{margin:-1.8rem -1.25rem 1.8rem;padding:2rem 1.25rem 1.8rem}}
  .cover .rule{{width:100%}}
  h1{{font-size:1.95rem}}
  .masthead{{gap:.6rem;padding:.55rem .8rem}}
  .masthead .work{{font-size:.62rem;overflow:hidden;text-overflow:ellipsis}}
  .masthead form{{flex:1;min-width:0}}
  #q{{width:100%;max-width:none}}
  .para{{padding-left:0}}
  .pnum{{position:static;display:inline-block;width:auto;margin-right:.5rem;
    text-align:left;color:var(--gold)}}
}}

@media (max-width:560px){{
  .masthead .work{{display:none}}
}}

/* ---- print: return to the v0.20 page design ---- */
@media print{{
  @page{{size:Letter;margin:.85in}}
  body{{background:#fff;font:400 10.4pt/1.62 var(--serif)}}
  .masthead,.sidebar,#searchnote,.fnpop,.crumb,.onthispage{{display:none!important}}
  .shell{{display:block;max-width:none}}
  .sheet{{border:0;padding:0;min-height:0}}
  .ptext{{text-align:justify;hyphens:auto}}
  .para{{padding-left:2.2rem}}
  .pnum{{color:#56676E}}
  h1,h2,h3,h4{{break-after:avoid}}
  p,.para{{orphans:2;widows:2}}
  sup.fnref a{{background:none;color:var(--ink);padding:0;font-size:.7em}}
  button.fnbtn{{display:inline!important;background:none;color:var(--ink);border:0;padding:0;font:inherit;font-size:.7em;vertical-align:super;min-width:0;height:auto}}
  .tablewrap{{overflow:visible}}
  .tablewrap table{{min-width:0;font-size:8.6pt}}
  .tablewrap thead{{display:table-header-group}}
  .notes{{break-before:page}}
  a{{color:var(--ink);text-decoration:none}}
}}
</style>
</head>
<body>
<header class="masthead">
  <button id="navtoggle" aria-expanded="false" aria-controls="sidebar">Contents</button>
  <a class="work" href="index.html">Code, Law <span>&amp;</span> Capital</a>
  <form role="search" onsubmit="return false">
    <label class="sr-only" for="q" hidden>Search this chapter</label>
    <input id="q" type="search" placeholder="Search this chapter&hellip;" autocomplete="off">
    <a class="allsearch" href="../search.html">All 26 &rarr;</a>
  </form>
</header>

<div class="shell">
  <nav class="sidebar" id="sidebar" aria-label="Codex contents">
    <a class="up" href="../">&larr; JUSNREM Codex</a>
    <h2>Code, Law and Capital</h2>
    <ol class="worknav">{worknav}</ol>
    <p id="searchnote" hidden></p>
  </nav>

  <main class="sheet">
    <div class="cover">
      <div class="plate" role="presentation"></div>
      <div class="frame" role="presentation"></div>
      <div class="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <div class="subtitle">{subtitle}</div>
      <div class="rule"><i></i><b></b></div>
      <div class="byline">Khurram Chughtai</div>
    </div>
    <nav class="crumb" aria-label="Breadcrumb">
      <a href="../">Codex</a> <span>/</span>
      <a href="index.html">Code, Law and Capital</a> <span>/</span>
      <em>{eyebrow}</em>
    </nav>
    <nav class="onthispage" aria-label="On this page">
      <h2>On this page</h2>
      <ol>{contents}</ol>
    </nav>
    {body}
    <section class="notes" aria-label="Footnotes">
      <h2>Footnotes</h2>
      <ol>{notes}</ol>
    </section>
    {pager}
  </main>
</div>

<script>
const NOTES = {note_data};

/* Footnotes as inline popovers, with the anchor link preserved underneath. */
function upgradeFootnotes(root) {{
  root.querySelectorAll('sup.fnref > a').forEach(a => {{
    const id = (a.getAttribute('href') || '').slice(1);
    if (!NOTES[id]) return;
    const btn = document.createElement('button');
    btn.className = 'fnbtn';
    btn.type = 'button';
    btn.textContent = a.textContent;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Footnote ' + a.textContent);
    btn.dataset.fn = id;
    a.parentNode.replaceChild(btn, a);
  }});
}}
upgradeFootnotes(document);

let openPop = null;
function closePop() {{
  if (!openPop) return;
  openPop.btn.setAttribute('aria-expanded', 'false');
  openPop.el.remove();
  openPop = null;
}}
document.addEventListener('click', e => {{
  const btn = e.target.closest('button.fnbtn');
  if (!btn) {{ if (!e.target.closest('.fnpop')) closePop(); return; }}
  const wasOpen = openPop && openPop.btn === btn;
  closePop();
  if (wasOpen) return;
  const pop = document.createElement('div');
  pop.className = 'fnpop';
  pop.innerHTML = '<button class="close" aria-label="Close">&times;</button>' + NOTES[btn.dataset.fn];
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 6;
  let left = r.left + window.scrollX - 20;
  left = Math.max(10, Math.min(left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 10));
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
  btn.setAttribute('aria-expanded', 'true');
  openPop = {{ btn, el: pop }};
  pop.querySelector('.close').addEventListener('click', closePop);
}});
document.addEventListener('keydown', e => {{ if (e.key === 'Escape') closePop(); }});
window.addEventListener('resize', closePop);

/* Sidebar: current-section highlight. */
const links = [...document.querySelectorAll('.sidebar .seclist a')];
const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
const spy = new IntersectionObserver(entries => {{
  entries.forEach(en => {{
    if (!en.isIntersecting) return;
    links.forEach(l => l.classList.remove('here'));
    const hit = links.find(l => l.getAttribute('href') === '#' + en.target.id);
    if (hit) hit.classList.add('here');
  }});
}}, {{ rootMargin: '-64px 0px -75% 0px' }});  /* px or % only; rem throws */
targets.forEach(t => spy.observe(t));

/* Mobile contents toggle. */
const toggle = document.getElementById('navtoggle');
toggle.addEventListener('click', () => {{
  const open = document.getElementById('sidebar').classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
}});

/* Search, scoped to this chapter only. */
const paras = [...document.querySelectorAll('.para')];
const originals = paras.map(p => p.querySelector('.ptext').innerHTML);
const note = document.getElementById('searchnote');
const q = document.getElementById('q');
let timer;
q.addEventListener('input', () => {{ clearTimeout(timer); timer = setTimeout(run, 140); }});

/* Wrap matches in the text nodes only, so tags and footnote buttons survive. */
function highlight(el, term) {{
  const rx = new RegExp('(' + term.replace(/[.*+?^${{}}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let found = 0;
  nodes.forEach(n => {{
    rx.lastIndex = 0;
    if (!rx.test(n.nodeValue)) return;
    rx.lastIndex = 0;
    found++;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = rx.exec(n.nodeValue)) !== null) {{
      frag.appendChild(document.createTextNode(n.nodeValue.slice(last, m.index)));
      const mk = document.createElement('mark');
      mk.textContent = m[0];
      frag.appendChild(mk);
      last = m.index + m[0].length;
      if (m[0] === '') rx.lastIndex++;
    }}
    frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
    n.parentNode.replaceChild(frag, n);
  }});
  return found > 0;
}}

function run() {{
  const term = q.value.trim();
  closePop();
  paras.forEach((p, i) => {{
    const el = p.querySelector('.ptext');
    el.innerHTML = originals[i];   // discards the upgraded footnote buttons,
    upgradeFootnotes(el);          // so rebuild them on the restored markup
    p.classList.remove('nohit');
  }});
  if (term.length < 2) {{ note.hidden = true; return; }}
  let hits = 0;
  paras.forEach(p => {{
    if (highlight(p.querySelector('.ptext'), term)) hits++;
    else p.classList.add('nohit');
  }});
  note.hidden = false;
  note.textContent = hits
    ? hits + ' paragraph' + (hits === 1 ? '' : 's') + ' matching \\u201c' + term + '\\u201d'
    : 'No match in this chapter.';
}}
</script>
<script src="../assets/js/codex-config.js"></script>
<script src="../assets/js/codex-auth.js"></script>
</body>
</html>
"""


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    src = src_path.read_text(encoding="utf-8")

    doc = parse(read_pane(src))
    doc["eyebrow"] = eyebrow_for(out_path.stem)
    note_map = "{" + ",".join(
        '"%s":%s' % (fid, _js(txt)) for fid, txt in doc["notes"]
    ) + "}"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render(doc, note_map), encoding="utf-8")

    print(f"{src_path.name}: {len(src):,} bytes")
    print(f"{out_path.name}: {out_path.stat().st_size:,} bytes")
    print(f"  paragraphs {sum(1 for b in doc['blocks'] if b['kind'] == 'para')}"
          f"  headings {sum(1 for b in doc['blocks'] if b['kind'] == 'heading')}"
          f"  footnotes {len(doc['notes'])}")


def _js(s: str) -> str:
    """Embed HTML safely inside a JS string literal."""
    return (
        '"' + s.replace("\\", "\\\\").replace('"', '\\"')
        .replace("\n", " ").replace("</", "<\\/") + '"'
    )


if __name__ == "__main__":
    main()
