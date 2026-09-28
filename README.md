# JUSNREM Codex

The published record of a continuing inquiry into legal authority, institutional
capability and remedy. Static site, deployed to **jusnrem.digital**.

Part of the KSC.JUSNREM ecosystem.

---

## What is in this repository

```
index.html                          Platform home — the libraries
code-law-and-capital/
  index.html                        Library home — Code, Law and Capital
  chapter-01.html                   Clean reading edition, Chapter 1
  assets/clc-cover.jpg              Cover plate
tools/
  build_clean_edition.py            Generator: editorial Reader → clean edition
```

Nothing here is generated at request time. Every page is a static file.

## Status

| | |
|---|---|
| Reading corpus | v0.25 |
| Doctrinal status | Candidate and working research; not established law |
| Chapters released | 1 of 26 |
| Citation scheme | **Provisional** — see below |

Paragraph numbering in released chapters is sequential (1–95 in Chapter 1) and
derives from the editorial Reader. It is **not yet a permanent citation scheme**:
inserting a paragraph renumbers everything after it. A section-anchored,
insertion-safe identifier scheme is to be fixed before any identifier is published
as citable.

## Editorial source and the one-source rule

Chapters are **generated**, never hand-edited in this repository.

```
Editorial Reader (13 stages, marking, history)
        │
        ▼  tools/build_clean_edition.py
Clean reading edition  ──►  this repository  ──►  jusnrem.digital
```

The generator reads only the READ pane of a Reader file and discards the editorial
apparatus: stage panes, history, the stage tab bar, per-paragraph
KEEP/REVISE/CUT/UNCERTAIN controls, the export bar, build stamps and the embedded
all-stage search index. It re-renders the prose with web reading mechanics —
sidebar contents, inline footnote popovers, scoped search — and a print stylesheet
that returns to the designed page.

Typical reduction is about 67%: Chapter 1 goes from 1.98 MB to 643 KB with every
paragraph, footnote, anchor and figure preserved.

```bash
python tools/build_clean_edition.py <reader.html> code-law-and-capital/chapter-NN.html
```

Editorial changes belong upstream in the Reader, so they flow through on the next
build. **Do not edit chapter HTML in this repository** — the next regeneration will
discard it.

### Verifying a build

After generating a chapter, confirm against its source Reader that the counts of
paragraphs, footnote references, footnote definitions, section anchors and figures
are unchanged, and that a word-level diff of the prose shows only intended edits.

## Publication rules

These are not stylistic preferences. They are the discipline the work is published
under, and they apply to this repository as much as to the text.

1. **Status is stated, not implied.** Publication does not convert a candidate
   proposition into established law or an institutional deployment.
2. **Sources are separated by rank.** Constitutions, enacted statutes, notified
   instruments and binding judgments are distinguished from policy, consultation
   history, guidance and empirical assertion.
3. **Nothing is silently overwritten.** Substantive updates carry a date, a version
   and an explanation of what changed and why.
4. **A work is listed when it can be cited**, not because it exists in draft.
5. **No capability is claimed that is not evidenced.** A domain does not create an
   institution, and a publication does not prove an operating capability.

## Design

The site sits in the KSC.JUSNREM ecosystem family: warm light ground for published
records, dark ground reserved for the applied engines.

| Token | Value | Use |
|---|---|---|
| Ground | `#F3EFE6` | Page |
| Surface | `#FFF8EF` | Cards, panels |
| Ink | `#18221F` | Body text |
| Gold | `#A8813C` | Codex accent, rules |
| CLC | `#233B2C` | Code, Law and Capital |
| JUS.automica | `#A5452F` | Library accent |
| Fiscal Order | `#086A70` | Library accent |

Body is Aptos/Segoe UI; display is Georgia. Chapter pages additionally use
Cormorant Garamond, Archivo and Spectral from the designed print edition, and the
print stylesheet restores Letter, 0.85 in margins and justified Spectral at
10.4 pt/1.62.

Chapters are linked with real `<a href>` elements so every chapter has a citable
URL, opens in a new tab, and is reachable by search engines.

## Deployment

Static hosting, no build step. Vercel serves the repository root.

## Licence and rights

© 2026 KSC.JUSNREM. All rights reserved. The text is not offered under an open
licence. Bulk extraction and use of this corpus for model training are not
permitted.

These publications are independent evidence-controlled analysis. They are not legal
advice to any person, a regulatory approval, an offer of investment, a prediction of
market performance, or a substitute for checking the law applicable to a particular
activity at the relevant time. Nothing here represents governmental authority.
