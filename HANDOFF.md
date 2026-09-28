# Handoff — 3 September 2026 (session 2)

Supersedes `HANDOFF-2026-09-03.md` in the working folder, which covers session 1.

**Read `## Traps` before touching anything.** Several defects here cost real time,
and two of them silently corrupted output that had already been reported as verified.

---

## 1. Where things are

| Path | What | Git |
|---|---|---|
| `~/Documents/Code Law and Capital - Aug 2026/` | Working source. 7,744 documents, 101 readers, 6 Wave folders. **Messy by nature — never build here.** | No |
| `~/Documents/jusnrem-digital-codex/` | The site. 45 files. | 11 commits → `origin/codex-rebuild-2026-09` |
| `~/Documents/ksc-jusnrem-ecosystem/` | Ecosystem standards. | 6 commits → `origin/main` (**private**) |

**Remotes (both live):**

- `github.com/ksc-jusnrem/jusnrem-digital-codex` — **public**, branch `codex-rebuild-2026-09`
- `github.com/ksc-jusnrem/ksc-jusnrem-ecosystem` — **private**, `main`

> **`main` on the codex repo is the live site and was deliberately not touched.**
> It holds the v0.25 site serving `readers/` (full editorial readers with stage tabs),
> 2 commits, deployed via `jusnrem-digital-codex.vercel.app` → `jusnrem.legal`.
> The rebuild has **no shared history** with it. Never force-push over `main`.

### One action outstanding, for the Author

The user asked for the codex repo to be **private**. I began it, then stopped: the
Chrome viewport was reporting 0×0 so I was working blind, one dialog away from
*Delete repository*. Nothing was changed — verified both branches intact afterwards.

Settings → Danger Zone → Change visibility → Change to private. The site stays up;
Vercel deploys private repos normally.

---

## 2. What this session completed

**The full corpus, generated and verified.** 28 units — 26 chapters plus front and
back matter — from 67.0 MB of editorial Readers down to ~25 MB of reading editions.

Verified against source on **five** counts, no mismatches:

| | |
|---|---|
| Paragraphs | 3,691 |
| Footnotes | 577 |
| Headings | 1,164 |
| Images | 42 |
| Tables | 98 |

**Three research instruments**, all generated from the published text so none can
drift from it:

- `search.html` — corpus-wide search over all 3,691 paragraphs, ranked, every result
  a citation linking to its paragraph. `?q=term` deep-links.
- `authorities.html` — Table of Authorities: 70 distinct authorities (35 primary,
  15 delegated, 3 circulars, 17 cases), each linked to every paragraph discussing it.
- `map.html` — cross-reference arc diagram: 47 connections, 79 references.

**Navigation rebuilt.** Every page carries the whole Codex — 7 parts, 26 chapters,
current unit highlighted with its sections nested — plus breadcrumb and an on-page
contents block. Previously a reader in Chapter 13 could not reach Chapter 14.

**134 cross-references made live** (two-pass build against an index of 969 numbered
sections) and **249 cited URLs made clickable** (OSCOLA brackets kept, address inside
linked).

---

## 3. Decisions locked

- **Doctrine identifiers are independent of the work they appear in** (Author,
  this session). `DOC-UAC-01` style. Provenance is a field, not the address.
- **The Constitution of Fiscal Order is the third treatise on the platform.**
  Independence under Charter Art. 4.1/4.5 is a rule about **doctrine** — not
  absorbed, not redefined, cross-referenced not merged — and does not bear on where
  it is published. I got this wrong once in both directions; it is now settled.
- **JUS.automica is TEN volumes.** Charter Art. 5, ratified 26 July 2026,
  "controlling until formal amendment". A nine-volume regrouping exists but is a
  proposal in a rank-8 instrument, open Author decision **V-D05**. Do not state
  nine anywhere.
- Front and back matter are **print apparatus, not chapters** — in a Reference
  section, not the reading sequence, front matter marked incomplete.
- Editorial Reader is the master; chapters are **generated, never hand-edited**.
- Design: records on warm light ground, engines dark. Web edition in the ecosystem
  family; v0.20 green/gold/Cormorant carries print and the cover plate.
- **The September deadline question is closed. The Author said to leave it. Do not
  raise it again.**

---

## 4. Open, in order

1. **The identifier scheme** — the keystone, and the next task. Facts already
   established from the corpus:
   - **94%** of chapter paragraphs sit under a numbered section, so section-anchored
     IDs derive cleanly.
   - The other **6%** (146 of 2,450) sit under unnumbered blocks — *Chapter Summary*,
     *Chapter N Conclusion*, *Selected Authorities*, plus genuine sections lacking
     decimal numbers. These need an explicit rule, not a guess.
   - The largest single section holds **46 paragraphs**, so the within-section
     ordinal needs two digits.
   - Insertion-safety is the whole point: `CLC-01-1.6.1-03`, insertion after it
     becomes `-03a`, nothing downstream renumbers.
   - **Nothing may be published as citable until this is settled.** The pages
     currently say the numbering is provisional. Keep that until it isn't.
2. **The Doctrine Register.** Charter Art. 6.1 lists **23 foundational doctrines**
   with canonical names and first-formulation chapters, ratified — Unbroken Authority
   Chain (Ch. 11), Computational Due Process (Ch. 18), Sovereign Control Requirement
   (Ch. 14), Code-Based Truth (Ch. 16), Traceable Authority (Ch. 20) and others. That
   is the register's seed. Charter Art. 11.1 already mandates the architecture:
   foundational doctrines stated in full only in Volume I, applied and
   cross-referenced thereafter.
   **Honest status is required**: the framework records CITATION-CLEARED = 0 across
   234 records and 0 of 23 chapters at treatise grade. Entries open as exploratory
   or working, and that honesty is the feature.
3. **Merge or repoint** — decide whether `codex-rebuild-2026-09` becomes `main`.
   If it does, carry `favicon.svg` and `og.png` across from the live `main`; the
   rebuild has neither.
4. **The works inventory beyond the three named works.** Google Drive is connected
   and was used this session; the JUS.automica architecture came from there.

---

## 5. Errors I made this session

Recorded because the next session will otherwise repeat them, and because the
project's own discipline requires corrections on the record.

1. **Reported counts I had not computed.** A commit message claimed 2,791 paragraphs,
   594 footnotes, 1,038 headings, 40 images. The true figures are 3,691 / 577 /
   1,164 / 42. Wrong on four of five. Corrected in a later commit. **Count, don't
   estimate.**
2. **Stated a proposal as fact** — "nine volumes in three books" — from a rank-8
   document that says of itself it "confers nothing". The ratified position is ten.
3. **Over-read the Charter** and removed *The Constitution of Fiscal Order* from the
   platform entirely, on the strength of "independent work". Independence is about
   doctrine, not hosting.
4. **Reported a verified corpus that was missing 98 tables**, because the
   verification checked paragraphs, footnotes, headings and images but never tables.
   The user's question — "are you sure what you observed?" — is what surfaced it.

---

## 6. Traps

### Environment

- **`gh` is installed (2.99.0) but NOT authenticated.** No `~/.config/gh/`.
  However **`git push` works** — Git Credential Manager has cached credentials:
  `git -c credential.helper=manager -c credential.interactive=false push`.
- **Claude in Chrome can report viewport 0×0**, at which point screenshots fail with
  "Cannot take screenshot with 0 width". **Do not keep operating.** You are blind.
- **GitHub's repo Settings page holds every Danger Zone dialog in the DOM at once** —
  rename branch, switch default, make private, disable protection, archive, delete.
  `find` matches hidden ones. An archive confirmation was returned while the
  make-private dialog was the one open. Verify which dialog you are in before typing
  a confirmation.
- The Claude Code browser tool **cannot open `file://`** — serve with
  `python -m http.server`. Screenshots fail on very tall pages; verify with
  `document.elementFromPoint()` instead.
- Recursive `find`/`grep` across `~/Documents` times out. Use `-maxdepth 2`.
- Python needs `PYTHONIOENCODING=utf-8` or it dies on em dashes.
- **`\b` inside a bash heredoc becomes a literal backspace (0x08)** and silently
  corrupts regexes. It produced zero cross-reference links and looked like a logic
  bug. Write regex patches to a `.py` file, don't heredoc them.

### The generator

`tools/build_clean_edition.py`. **There are two Reader generations and they differ:**

| | Newer (Ch 1) | Older (Ch 9) |
|---|---|---|
| Heading class | `class="hsec sec"` | `class="sec hsec"` |
| Section marks | `<span class="secmarks">` | `<div class="secmarks">` |

Both are now handled. Before the fix: 19 units had **empty sidebars**, and 38
headings in Chapter 9 published the control labels *"recover superseded later"*
into heading text, the sidebar, the search index and the Table of Authorities.

Other structures that must be parsed, each of which was silently dropped at some
point:

- Tables live in `<div class="tablewrap"><table>…</table></div>` **between**
  paragraphs — 98 of them.
- Figures are **separate blocks** following a paragraph: `<figure>`, then
  `div.caption`, then `div.figurenote` (the accessible description, also used as
  `alt`).
- Ornamental figures are `<figure class="ornament" aria-hidden="true">` with
  `alt=""` — preserved as decorative, not given an invented description.
- `Chapter-23-Publication` is a different format and fails `read_pane`. Exclude it;
  Chapter 23 proper is covered.

**Verify every build on five counts** — paragraphs, footnotes, headings, images,
tables — against the source Reader. Four is not enough; that is how 98 tables were
lost.

### Already fixed, do not reintroduce

- `IntersectionObserver` `rootMargin` must be px or %; `rem` throws and killed every
  script after it.
- A `/g` regex used with `.test()` is stateful and alternates true/false.
- Restoring `innerHTML` after search destroys upgraded footnote buttons;
  `upgradeFootnotes()` must re-run.

---

## 7. Build commands

```bash
# regenerate all 28 units (two-pass, resolves cross-references)
#   see the batch script pattern in the session log; it builds a section index
#   across every unit first, then renders with linkify()

python tools/build_apparatus.py   # authorities.html + search-index.json
python tools/build_map.py         # map.html

python -m http.server 8767 --bind 127.0.0.1   # serve from repo root
```

---

## 8. Working style the Author asked for

- **One thing at a time, in order.** Pushed back more than once on jumping between
  tasks.
- **Decide rather than ask** where a sensible default exists — but never on
  architecture.
- **Do not invent content.** Borrowed copy was caught immediately. Some text on the
  library page still comes from `ksc-jusnrem.io` and `jus-automica.digital` rather
  than from the Codex, and should be replaced from the Author's own text.
- **"No mistakes — this is serious work."** Verify before asserting. When challenged
  on an observation, re-test it rather than defend it; doing so is what found the
  missing tables.
- Long strategy messages arrive mid-build (Rules-as-Code, payment architecture, UK
  company structure, the non-sovereign assessment engine). **These are roadmap, not
  build instructions.** Nothing from them reaches a public page without evidence —
  the Author's own rule, and the reason JUS.smart currently fails the audit.
- Figma skills were invoked four times; the MCP server is not connected in this
  environment and there is no Figma file. Diagrams are built as inline SVG from
  corpus data instead.
