#!/usr/bin/env python3
"""
Build the Doctrine Register.

A doctrine does not belong to the chapter that first states it. It is addressed
independently, and works cite the Register rather than restating it - which is what
JUS.automica Charter Art. 11.1 already requires: "foundational doctrines are stated
in full only in Volume I. Later volumes apply and cross-reference them."

Two classes of entry, and the difference is load-bearing:

  RATIFIED   JUS.automica Charter Art. 6.1 lists 23 foundational doctrines with
             canonical names and first-formulation chapters. Charter v1.0 is a
             ratified freeze (Author ratification 26 July 2026). The names here are
             the Author's, not mine.

  CANDIDATE  Code, Law and Capital states named analytical constructs - six
             conditions, three clocks, seven links - located and cited here from the
             published text. Most are NOT given canonical doctrinal names in the
             work. They are listed as candidates awaiting the Author's naming. No
             name has been invented.

Status reflects the project's own records: CITATION-CLEARED = 0 across 234 records,
0 of 23 chapters at treatise grade. Entries therefore open as exploratory or
working. A register claiming settled doctrine it cannot support would breach
Charter Art. 10.3.

Usage:  python tools/build_doctrines.py
"""

import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "code-law-and-capital"

# ---------------------------------------------------------------------------
# RATIFIED - JUS.automica Charter Art. 6.1. Names and chapters are the Author's.
# (id, canonical name, Vol I chapter, canonical chapter title)
# ---------------------------------------------------------------------------
RATIFIED = [
    ("DOC-ILC-01",  "Intelligent Legal Condition",            1,  "Law at the Threshold"),
    ("DOC-LTP-01",  "Legal Translation Problem",              2,  "Written → Executable"),
    ("DOC-COH-01",  "Coherence Requirement",                  3,  "Fragmented Legality"),
    ("DOC-HDC-01",  "Human Dignity Constraint",               4,  "Natural Law / Dignity"),
    ("DOC-APP-01",  "Authority-Pedigree Principle",           5,  "Positivism / Authority of Code"),
    ("DOC-RLP-01",  "Reasoned Legality Principle",            6,  "Interpretation / Reason"),
    ("DOC-NRP-01",  "Non-Reproduction Principle",             7,  "Realism / Law in Action"),
    ("DOC-CFP-01",  "Constitutional Feedback Principle",      8,  "Cybernetics / Informatics"),
    ("DOC-COE-01",  "Constitutionalisation of Execution",     9,  "Digital Constitutionalism as Jurisprudential Foundation"),
    ("DOC-NPP-01",  "Normative Plurality Principle",         10,  "Islamic Jurisprudence / Plurality"),
    ("DOC-UAC-01",  "Unbroken Authority Chain",              11,  "Digital Chain of Authority"),
    ("DOC-NAWR-01", "No Authority Without Responsibility",   12,  "Delegation / Automation"),
    ("DOC-CSP-01",  "Constitutional Subject Principle",      13,  "Constitutional Subject"),
    ("DOC-SCR-01",  "Sovereign Control Requirement",         14,  "Sovereignty / Dependence"),
    ("DOC-LET-01",  "Legal-Effect Threshold",                15,  "Definition / Scope / Structure"),
    ("DOC-CBT-01",  "Code-Based Truth",                      16,  "Code-Based Truth"),
    ("DOC-MRL-01",  "Machine-Readable Legality",             17,  "Machine-Readable Legality"),
    ("DOC-CDP-01",  "Computational Due Process",             18,  "Computational Due Process"),
    ("DOC-HCC-01",  "Human Constitutional Control",          19,  "Human Constitutional Control"),
    ("DOC-TRA-01",  "Traceable Authority",                   20,  "Traceable Authority"),
    ("DOC-SSM-01",  "Source-to-System Legal Mapping",        21,  "Source-to-System Mapping"),
    ("DOC-AAC-01",  "Anti-Automation Constitutionalism",     22,  "Anti-Automation"),
    ("DOC-FCN-01",  "Foundational Canons",                   23,  "Foundational Canons"),
]

# Charter Art. 8.2 gives provisional senses for several of these.
CHARTER_SENSE = {
    "DOC-CBT-01": "Verifiable correspondence among source, authority, interpretation, "
                  "data, process, outcome and remedy — not “code creates truth”.",
    "DOC-MRL-01": "Computational representation that preserves authority, context, "
                  "purpose, exceptions, procedure and remedy.",
    "DOC-CDP-01": "Notice, participation, reasons, correction, human review and "
                  "effective remedy proportionate to risk.",
    "DOC-HCC-01": "Final constitutional authority and responsibility remain with "
                  "lawful human institutions with real capacity.",
    "DOC-TRA-01": "Reconstructable evidentiary record of legally significant "
                  "computational action.",
    "DOC-SCR-01": "Capacity to understand, audit, secure, modify, suspend and replace "
                  "critical systems.",
}

# ---------------------------------------------------------------------------
# CANDIDATE - located in the published Code, Law and Capital text.
# (working label, chapter, paragraph, what it is). NO canonical name invented.
# ---------------------------------------------------------------------------
CANDIDATES = [
    ("The Intelligent-Order Test — six conditions", 1, 41,
     "Classification legibility, authority traceability, institutional executability, "
     "rights and remedy, capital intelligibility, adaptive legality. Named in the text "
     "at §1.6.", True),
    ("Five questions of every material system", 1, 27,
     "Asset or representation; activity performed; actor or actors in control; "
     "capital consequence; remedy available.", False),
    ("The control-spectrum inquiry — seven questions", 4, 51,
     "Upgrade authority; administrative keys; interface control; parameter selection; "
     "voting concentration; incident response; hidden dependency.", False),
    ("Three registers of a directive instrument", 3, 29,
     "Separating a circular into declaratory, directive and reporting registers, each "
     "carrying a different consequence and limit.", False),
    ("The three clocks", 3, 81,
     "Constitutional and legislative; service-provider transition; implementation. "
     "Kept separate throughout the treatise.", False),
    ("The three-limb savings test", 3, 87,
     "Category, source and correspondence, applied cumulatively to test whether a "
     "pre-Act instrument survives.", False),
    ("The seven-link chain of execution", 3, 112,
     "Valid norm; competent decision-maker; authenticated status; operational "
     "interface; evidence of compliance; and the remaining links, each of which must "
     "hold.", False),
    ("The six gates of the governing inquiry", 6, 4,
     "A sequenced inquiry into capital formation, described as having a shape as well "
     "as an order.", False),
    ("Four tests of the macro setting", 6, 21,
     "A digital-asset product is not credited with capital formation unless it adds "
     "funded enterprise, assets, productivity or capacity.", False),
    ("Six questions separating financial-integrity claims", 6, 131,
     "Lawfulness of underlying funds; licensing; foreign-exchange and cross-border "
     "compliance; and further limbs, against the assumption that seizure proves crime "
     "solved.", False),
    ("Five gates of the corrective sequence", 6, 155,
     "The sequence through which a corrective package should proceed.", False),
    ("The eight-part legality test", 9, 91,
     "Applied to each material decision.", False),
    ("Six questions of the permission map", 26, 187,
     "Pakistan nexus; professional business basis; service to third parties; apparent "
     "Schedule I match; and further limbs, asked in sequence.", False),
    ("Six gates for model release", 26, 208,
     "Applied to each model release.", False),
]


def strip_num(title: str, num: str) -> str:
    """Section titles carry their own number; don't print it twice."""
    t = (title or "").strip()
    return t[len(num):].strip() if num and t.startswith(num) else t


def locate(chapter: int, para: int):
    """Resolve a paragraph to its section, so the citation is structural."""
    f = LIB / f"chapter-{chapter:02d}.html"
    if not f.exists():
        return None, None
    s = f.read_text(encoding="utf-8")
    body = s[s.index("<main"): s.index("</main>")]
    body = re.sub(r'<nav class="onthispage".*?</nav>', "", body, flags=re.S)
    cur = None
    for m in re.finditer(r'<h[2-4] id="[^"]+" class="sec lvl\d">(.*?)</h[2-4]>'
                         r'|<div class="para" id="p(\d+)">', body, re.S):
        if m.group(1) is not None:
            n = re.search(r'<span class="num">([^<]*)</span>', m.group(1))
            t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip()
            cur = (n.group(1).strip() if n and n.group(1).strip() else None, t)
        elif int(m.group(2)) == para:
            return cur if cur else (None, "")
    return None, None


def build() -> None:
    rows_r = []
    for did, name, ch, title in RATIFIED:
        sense = CHARTER_SENSE.get(did)
        rows_r.append(
            f'<tr><td class="id">{did}</td>'
            f'<td class="nm">{html.escape(name)}'
            + (f'<span class="sense">{sense}</span>' if sense else "")
            + f'</td>'
            f'<td class="pv">JUS.automica Vol.&nbsp;I, Ch.&nbsp;{ch}<span class="ct">'
            f'{html.escape(title)}</span></td>'
            f'<td><span class="st st-work">Working</span></td></tr>')

    rows_c = []
    for label, ch, para, gloss, named in CANDIDATES:
        num, sec_title = locate(ch, para)
        cite = f"CLC-{num}-p??" if num else f"Ch {ch}"
        rows_c.append(
            f'<tr><td class="id">&mdash;</td>'
            f'<td class="nm">{html.escape(label)}<span class="sense">{html.escape(gloss)}</span></td>'
            f'<td class="pv"><a href="code-law-and-capital/chapter-{ch:02d}.html#p{para}">'
            f'Code, Law and Capital, Ch.&nbsp;{ch} &para;{para}</a>'
            + (f'<span class="ct">&sect;{num} {html.escape(strip_num(sec_title, num))}</span>' if num else "")
            + f'</td>'
            f'<td><span class="st st-{"cand" if named else "expl"}">'
            f'{"Named in text" if named else "Unnamed"}</span></td></tr>')

    page = PAGE
    for k, v in {
        "{{RATIFIED}}": "".join(rows_r), "{{CANDIDATES}}": "".join(rows_c),
        "{{NR}}": str(len(RATIFIED)), "{{NC}}": str(len(CANDIDATES)),
    }.items():
        page = page.replace(k, v)
    (ROOT / "doctrines.html").write_text(page, encoding="utf-8")
    print(f"doctrines.html  {len(RATIFIED)} ratified, {len(CANDIDATES)} candidates located")


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Doctrine Register &mdash; JUSNREM Codex</title>
<meta name="description" content="Doctrines addressed independently of the works that state them, with honest status on every entry.">
<link rel="canonical" href="https://jusnrem.digital/doctrines.html">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600&family=Spectral:wght@400&display=swap" rel="stylesheet">
<style>
:root{--ground:#EEF0F0;--surface:#FFFFFF;--ink:#111516;--ink-2:#3C484D;--ink-3:#56676E;--ink-head:#111516;
 --gold:#43652E;--gold-soft:rgba(67,101,46,.10);--rule:#CCD1D4;--rule-2:#DDE1E2;
 --green:#43652E;--rust:#652E43;--violet:#698458;
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
.head{padding:3rem 0 1.6rem}
h1{margin:0;font:400 clamp(1.9rem,4.2vw,2.7rem)/1.15 var(--serif);letter-spacing:-.012em}
.lede{margin:1.1rem 0 0;max-width:64ch;color:var(--ink-2)}
.stat{margin-top:1.5rem;display:flex;flex-wrap:wrap;gap:.5rem}
.stat b{font:600 .62rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;
 padding:.45rem .65rem;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2)}
.note{margin:1.7rem 0 0;padding:1.05rem 1.2rem;background:rgba(67,101,46,.09);
 border:1px solid var(--gold);border-left-width:4px;max-width:74ch}
.note b{display:block;font:600 .62rem/1 var(--sans);letter-spacing:.15em;
 text-transform:uppercase;color:#2F4720;margin-bottom:.5rem}
.note p{margin:0 0 .6rem;font-size:.87rem;line-height:1.6;color:var(--ink-2)}
.note p:last-child{margin-bottom:0}
h2{margin:3rem 0 .4rem;font:600 1.05rem var(--sans)}
.sub{margin:0 0 1rem;max-width:70ch;font-size:.87rem;color:var(--ink-2)}
table{border-collapse:collapse;width:100%;font-size:.87rem}
th{text-align:left;padding:.55rem .7rem;border-bottom:1.2pt solid var(--gold);
 font:600 .66rem var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--ink-head)}
td{padding:.7rem .7rem;border-bottom:1px solid var(--rule-2);vertical-align:top}
td.id{font:600 .74rem var(--sans);color:var(--green);white-space:nowrap;
 font-variant-numeric:tabular-nums}
td.nm{font-weight:600;max-width:26rem}
td.nm .sense{display:block;margin-top:.3rem;font:400 .8rem/1.5 var(--serif);color:var(--ink-2)}
td.pv{color:var(--ink-2);font-size:.82rem;max-width:20rem}
td.pv a{color:var(--green);text-decoration:none;border-bottom:1px solid var(--rule)}
td.pv a:hover{color:var(--gold);border-bottom-color:var(--gold)}
td.pv .ct{display:block;margin-top:.25rem;font-size:.78rem;color:var(--ink-3)}
.st{display:inline-block;font:600 .58rem/1 var(--sans);letter-spacing:.11em;
 text-transform:uppercase;padding:.34rem .5rem;border:1px solid var(--rule-2);white-space:nowrap}
.st-work{border-color:var(--green);color:var(--green)}
.st-cand{border-color:var(--gold);color:#2F4720}
.st-expl{color:var(--ink-3)}
footer{padding:3rem 0;margin-top:3rem;border-top:1px solid var(--rule);font-size:.8rem;color:var(--ink-3)}
a{color:var(--green)}
@media (max-width:760px){.masthead nav{display:none}td.nm,td.pv{max-width:none}}
@media (max-width:760px){table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}}
</style>
</head>
<body>
<header class="masthead"><div class="in">
  <a class="brand" href="index.html"><b>JUSNREM Codex</b><span>Doctrine Register</span></a>
  <nav><a href="code-law-and-capital/">The Codex</a><a href="search.html">Search</a>
       <a href="authorities.html">Authorities</a><a href="map.html">Map</a></nav>
</div></header>

<div class="wrap">
  <div class="head">
    <h1>Doctrine Register</h1>
    <p class="lede">
      A doctrine does not belong to the chapter that first states it. It is addressed
      independently, so that works cite the Register rather than restating it &mdash;
      which is what the JUS.automica Charter already requires: foundational doctrines
      are stated in full only in Volume&nbsp;I, and applied and cross-referenced
      thereafter.
    </p>
    <div class="stat">
      <b>{{NR}} ratified names</b><b>{{NC}} located candidates</b><b>Register in preparation</b>
    </div>

    <div class="note">
      <b>What this register does and does not claim</b>
      <p>
        Every entry carries its status, and no entry is presented as settled doctrine.
        The programme's own records show no source yet cleared for citation and no
        chapter yet at treatise grade, so entries stand as <em>working</em> or as
        located <em>candidates</em>. That is the honest position, and stating it is
        the point of a register.
      </p>
      <p>
        Names in the first table are the Author's, taken from a ratified instrument.
        Entries in the second are analytical constructs located in the published text
        of <em>Code, Law and Capital</em> and cited to the paragraph that states them.
        Most are not given canonical doctrinal names in the work. <strong>No name has
        been invented here.</strong> Naming them is an authorial act.
      </p>
    </div>
  </div>

  <h2>Ratified doctrinal names</h2>
  <p class="sub">
    JUS.automica Treatise Constitution and Editorial Charter v1.0, Article&nbsp;6.1
    &mdash; a ratified freeze. Identifiers are independent of the work: the first
    formulation is recorded as provenance, not as the address, so a doctrine that
    moves or is restated does not break the citations to it.
  </p>
  <table>
    <thead><tr><th>Identifier</th><th>Canonical name</th><th>First formulation</th><th>Status</th></tr></thead>
    <tbody>{{RATIFIED}}</tbody>
  </table>

  <h2>Located candidates &mdash; Code, Law and Capital</h2>
  <p class="sub">
    Named analytical constructs found in the published text, each cited to the
    paragraph that states it. Identifiers are withheld until the Author names them
    and the identifier scheme is approved.
  </p>
  <table>
    <thead><tr><th>Identifier</th><th>Construct</th><th>Stated at</th><th>Status</th></tr></thead>
    <tbody>{{CANDIDATES}}</tbody>
  </table>

  <footer>
    Ratified names from Charter v1.0, Art. 6.1. Candidates located in the published
    corpus. Nothing here is settled doctrine.<br>&copy; 2026 KSC.JUSNREM.
  </footer>
</div>
</body>
</html>
"""

if __name__ == "__main__":
    build()
