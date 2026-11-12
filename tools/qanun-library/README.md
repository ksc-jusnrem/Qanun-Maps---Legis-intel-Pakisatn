# Legis-Intel Pakistan library repair — 12 November 2026

This release repairs the existing 1,732-record collection. It does not certify national legal completeness, current force, territorial application or later amendments.

## Reading and source editions

The 1,728 law records have identified original-source reading routes; four other records remain source notices. There are 1,719 complete normalized-text or character-stream comparisons of existing transcriptions, four separately hashed complete source-restored readings, one six-page independently collated Railways reading, and four original-facsimile readings. The Income Tax source spans 822 PDF pages and the Companies Act source 401 pages. Earlier JSON/TXT records and passage identifiers remain available separately.

The four facsimile readers contain 133 complete selected pages. The Representation of the People Act is the identified 59-page Act range in a 281-page ECP volume; its earlier 2002 transcription is explicitly a different, unverified edition. It is not silently substituted or certified.

The image census screened 30,293 scoped pages across the identified original records, including small images and images behind OCR layers. The frozen inventory retains 282 supplemental original pages across 88 records. Every selected image is tied to its original PDF and physical page; independent re-rendered pixels match. Only reviewed publisher marks, decoded official publisher cover-navigation URLs and proven blank non-content rasters were excluded. Uncertain content is retained. Full source-body transcription is not asserted for image content.

## Relationships

Every record has an evidence download and a relationship panel, linked to the whole-library map. The current graph contains 7,398 resolved instrument citations, 19,262 resolved internal references and 1,124 resolved external numbered headings. Ambiguous editions, unmatched instruments and unresolved provisions remain visible. Citation links do not assert a repeal, legal effect or current force. Seven selected original-page relationships carry separate visual-page evidence, including unresolved printed citation discrepancies.

## Versions and compatibility

Raw law JSON/TXT bytes and all 40,922 legacy passage links are preserved. The old section generator is used to preserve earlier provision links for the five restored/collated text versions. MCP title results expose the current reading version and available earlier versions; passage retrieval requires the exact requested version. Image-body records explicitly distinguish archived machine text from original-page readings. Authentication and the nine read-only tool boundaries are retained.

The existing policy-PDF route continues to the KSC.JUSNREM policy-papers collection. The older local PDF is not redistributed by this release.

## Reproduce and verify

From the repository root, the hosted entry point is:

    node tools/qanun-release/release-build.mjs

It operates in a disposable build workspace, validates the committed public-safe source register, runs regression tests, generates the site and verifies the whole collection, connector version behavior, source evidence, navigation and output inventory before replacing the disposable output directory. Original-source re-verification on the source workstation is:

    node tools/qanun-library/sources/verify-sources.mjs

That check requires the identified local original archive and ignored acquisition cache. It rehashes original sources and current reading editions, independently checks the primary facsimiles and validates the supplementary pixel proof and actual assets. The 19 MB compressed reading-input bundle contains only public legislation text and source identity proofs; it has no local path dependency.

The release target is www.jusnrem.legal, explicitly confirmed by the user. jusnrem.digital remains the separate Codex site. A deployment receipt is recorded after hosted build and production verification; this source document alone is not a deployment assertion.
