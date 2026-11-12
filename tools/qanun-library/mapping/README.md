# Law-library relationship extraction

`mapping.mjs` is a dependency-free ESM module. `buildLibraryGraph(records, options)` returns JSON-serializable nodes, exact citation occurrences, internal provision references, unresolved instrument titles, inbound/outbound coverage and statistics. Optional `reviewedStatutes` and `reviewedCases` preserve links to the existing separately reviewed evidence panels; they are never confused with the newly extracted citations.

`renderLawRelationships(record, graph)` returns the per-law panel at `#library-relationships`. `renderLibraryMap(graph)` returns the complete alphabetic library index at `#library-map`. Load `mappingCss` with the page stylesheet and `mappingScript` as an external same-origin script or with its exact CSP hash. Search, incoming `?law=` selection, clear and no-JavaScript browsing are supported.

`external_references` is a separate array for an explicit adjacent phrase such as `section 12(1)(a) of the Companies Act 2017`. The instrument citation remains in `citations`; this array adds source provision wording and a target heading only when a unique exact instrument edition, provision kind and operative number match. `target_evidence.record_id` is the target law, unlike the source `evidence`, `instrument_evidence` and `context_evidence`. Coverage includes `external_outgoing` and `external_incoming` IDs. Missing, ambiguous, wrong-kind and amending-instrument targets remain unresolved. A target section-heading match does not certify a cited subsection/paragraph chain: `resolution_scope` and `subprovision_status` state that boundary explicitly.

## Evidence rules

- A matched title is exact after punctuation/spacing, optional definite articles, catalogue review annotations and the explicitly tested catalogue abbreviations PPC, HEC, CPC and CrPC are normalized. The year remains part of the identity when present. Every other parenthetical, including territorial qualifiers such as FATA, PATA and AJK, remains part of the name.
- Identical title aliases in multiple source records are displayed as ambiguous source editions. No target is selected and no incoming edge is manufactured.
- Repeated own-title text does not create self relationships.
- References to other provisions are linked only when a unique operative heading with a heading/body separator was identified. Contents-only and duplicate schedule/quoted headings do not pass that rule. Unresolved references remain visible.
- “Citation near repeal/amendment/authority wording” describes the bounded source context. It is deliberately not a holding that an instrument repeals, amends or authorizes another instrument. Such legal-effect claims require the separate reviewed evidence.
- Every occurrence stores the exact source substring, zero-based Unicode code-point range, SHA-256, source version and existing reader fragment. `verifyLibraryGraph` fails on changed text, hashes, unknown records, unknown passage anchors or missing inverse relationships.
- Original-source comparison, subsequent amendment history, legal force and full legal interpretation are separate checks. These citation maps do not certify them.

Run `node --test --test-reporter=tap tools/qanun-library/mapping/mapping.test.mjs` for the adversarial fixtures. Run `node tools/qanun-library/mapping/audit-library.mjs` from the repository root for all-record extraction, evidence verification and owned `graph.json` / `coverage-report.json` outputs.
