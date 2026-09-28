# Handoff — session 3, 3 September 2026

Read alongside `HANDOFF.md`, which covers sessions 1–2 and carries the **Traps**
section. Everything there still applies. This file records what changed after it.

---

## Completed this session

**Identifier scheme specified** — `standards/IDENTIFIERS.md` in the ecosystem repo.

- Text: `CLC-13.4.2-p07`; an insertion becomes `p07a` and nothing downstream moves.
- Apparatus blocks take alphabetic tokens — `sum`, `toc`, `con`, `auth`, `fig`,
  `note`, `abs`, `front` — which cannot collide with numeric section paths.
- Doctrines are **independent of the work** (Author decision, this session):
  `DOC-UAC-01`, with first formulation recorded as provenance, not as the address.
- Derived across the whole corpus to test it rather than assume it:
  **2,450 identifiers, 2,450 distinct, zero collisions**, longest 58 characters.
- Surfaced an editorial finding: **15 content sections carry no decimal number**,
  five of them in Chapter 11. They take a provisional slug and are flagged for
  numbering rather than concealed.

**Doctrine Register built** — `doctrines.html`, from `tools/build_doctrines.py`.

- **23 ratified names** from JUS.automica Charter Art. 6.1 — the Author's names,
  from a ratified freeze. Six carry the Charter's own Art. 8.2 sense.
- **14 candidates** located in the Code, Law and Capital text, each cited to
  paragraph and resolved section: the Intelligent-Order Test's six conditions
  (Ch 1 ¶41), the control-spectrum inquiry's seven questions (Ch 4 ¶51), the three
  clocks (Ch 3 ¶81), the three-limb savings test (Ch 3 ¶87), the seven-link chain
  (Ch 3 ¶112), the eight-part legality test (Ch 9 ¶91), and others.
- **No name was invented.** Candidates carry no identifier until the Author names
  them. Status is honest: nothing is presented as settled doctrine.

**Charter v1.0 encoded into the ecosystem standards** — Art. 4.1 separation rule,
4.2 sequence, 4.3 meta-rule, 4.4 application limit, 8.3 forbidden conflations,
9.3 anti-authority materials, Art. 10 citation discipline, Art. 11 completion
standard. These replaced my own reconstructions, which were weaker.

**The Constitution of Fiscal Order restored as the third treatise.** I removed it
first, then restored it. Independence under Art. 4.1/4.5 is a rule about
**doctrine** — not absorbed, not redefined, cross-referenced not merged — and says
nothing about where the work is published.

---

## Deployment — nothing is live

| | |
|---|---|
| `jusnrem.legal` | v0.25, unchanged, served from `main` |
| `jusnrem-digital-codex.vercel.app` | Same |
| Branch preview | **404** — three URL patterns tried, none resolve |
| `/search`, `/authorities`, `/map`, `/doctrines` live | Do not exist |

All commits are on GitHub; **none of the work is served anywhere.** The cause of the
missing preview was **not determined** — the browser tool became unavailable
mid-check. Two likely causes, each about a minute to fix: preview deployments
disabled for non-production branches, or the Vercel GitHub integration scoped to
`main` only.

**Start here: vercel.com → the project → Deployments.** Until the branch previews,
nobody can judge the rebuild on real hosting, and fonts, caching and 25 MB of pages
behave differently behind a CDN than on `127.0.0.1`.

---

## Two agents were running when the session ended

Deputed at the Author's explicit request. **Their results were never received.
Do not assume, invent or report any finding from them.** Re-run if wanted.

1. **Design critique of the main pages** — coherence, reading comfort, flow, colour
   scheme, and the platform-to-treatise connection. Briefed to measure real WCAG
   contrast ratios and give exact hex values rather than assert.
2. **PDF formats and access model**, on the Brill pattern — per-chapter and
   whole-work PDF, EPUB, the scholarly title-page pattern, access routes. Briefed
   with the binding constraints: static site, no build step, no authentication or
   payments, 133 MB repo.

---

## The design question, unresolved

The Author said the design needs "massive improvement" in coherence, reading
comfort, flow and colour. My own read, for whoever picks this up:

- **Two design families sit side by side, unresolved.** Chapter pages carry the
  v0.20 *print* identity — green `#233B2C`, gold `#A8813C`, Cormorant Garamond,
  Archivo, Spectral. Platform and instrument pages carry the *ecosystem* family —
  cream `#F3EFE6`, ink `#18221F`, Aptos, Georgia. Nobody has ruled on whether that
  is coherent or incoherent.
- **Gold is doing six jobs** — section numbers, hover states, chip borders,
  cross-reference arrows, table header rules, library accent stripes. A colour that
  means six things navigates nothing. By contrast `ksc-jusnrem.io` runs two accents
  with distinct jobs, teal `#086A70` and rust `#9F321D`, over a navy ink `#13233F`
  that is more legible than my `#18221F`.
- **Secondary greys sit near the contrast floor** — `#6A6152` and `#69716C` on
  `#FFF8EF` — in a work readers spend hours inside. Measure before changing.

Reference the Author admires: **brill.com** — formats offered as Books / Journals /
Specialty Products, with parallel access routes (Open Access, and separate paths for
Authors, Academic Societies and Librarians, plus a dedicated "Accessing Brill
Products" page).

---

## Outstanding — only the Author can settle these

1. **Make the codex repo private.** Asked for; not done. I stopped mid-flow when the
   Chrome viewport reported 0×0 and I was operating blind next to a *Delete
   repository* dialog. Nothing was changed; both branches verified intact afterwards.
   Settings → Danger Zone → Change visibility. The site stays up; Vercel deploys
   private repos normally.
2. **Six identifier decisions**, I-1 to I-6 in `IDENTIFIERS.md`. Nothing is published
   as citable until I-1 to I-4 are approved.
   **I-5 is the expensive one to defer**: 371 paragraphs are list fragments of 20
   words or fewer carrying their own paragraph number — 44% of Chapter 13. Rendering
   enumerations as lists removes them as citation targets. Cheap now; 371
   successions to record later.
3. **Name the 14 doctrine candidates.** Naming is an authorial act. Once named,
   their identifiers can be minted.
4. **Decide whether `codex-rebuild-2026-09` becomes `main`.** If it does, carry
   `favicon.svg` and `og.png` across from the live `main` — the rebuild has neither.

---

## New traps

- **Claude in Chrome reports viewport 0×0** when the window is minimised, and
  screenshots fail with "Cannot take screenshot with 0 width". `find` and
  `read_page` still work, which makes it tempting to continue. **Do not operate
  blind**, particularly in GitHub settings.
- **GitHub's repo Settings page holds every Danger Zone dialog in the DOM at once** —
  rename, switch default branch, make private, disable protection, archive, delete.
  `find` returned an *archive* confirmation while the *make-private* dialog was the
  one open. Verify which dialog you are in before typing any confirmation.
- **`git push` works without `gh auth`.** Git Credential Manager has cached
  credentials: `git -c credential.helper=manager -c credential.interactive=false push`.
  `gh` is installed (2.99.0) but still unauthenticated.
- **brill.com blocks the in-app browser** (CloudFront). Claude in Chrome reaches it.
- **Section titles already contain their own number.** Printing `§{num} {title}`
  duplicates it; `strip_num()` in `tools/build_doctrines.py` handles this.
- **Avoid complex quoting in bash heredocs.** A Python heredoc containing typographic
  quotes failed with "unexpected EOF". Write generators to a file instead.

---

## Build commands

```bash
python tools/build_apparatus.py    # authorities.html + search-index.json
python tools/build_map.py          # map.html
python tools/build_doctrines.py    # doctrines.html
python tools/unify_chrome.py       # one shared header on every platform page (run last)
python -m http.server 8767 --bind 127.0.0.1
```

Chapter regeneration is **two-pass**: build a section index across all 28 units
first, then render with `linkify()` so cross-references resolve against it.

**Verify every build on five counts** — paragraphs, footnotes, headings, images,
tables. Four is not enough; that is how 98 tables were once lost silently.
