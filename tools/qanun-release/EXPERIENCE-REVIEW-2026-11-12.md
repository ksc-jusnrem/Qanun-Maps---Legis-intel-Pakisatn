# Platform experience review — 12 November 2026

Implementation leaf, frozen for parent build and release review. No commit, push, deployment, account operation or corpus rewrite was performed.

## S1 evidence

Bundled Node 24.22.1: `node --test tools/qanun-release/experience-enhancements.test.mjs` completed with 10 tests passed, 0 failed, approximately 3.5 seconds on the final run. `git diff --check` passed.

The tests cover all 1,732 held identities, deterministic human-readable routes, all colliding titles, reversed input order, malformed/duplicate IDs, long-title years, all legacy reader and `.html` routes, exact encoded query retention, fragment semantics, download/version/API exclusions, unknown-ID rejection, every source-status class, representative static alias byte equality, opaque anchors, canonical metadata, source notices, client setup targets, the diagram and policy-copy preservation. The heavy raw-source hashes and actual 40,922 historical passage anchors plus restored section anchors remain in S2. `verify-library.mjs` now additionally checks every actual early summary and byte-for-byte equality between old and canonical HTML readers.

## Four review passes

1. Implement: added the early client chooser, stable setup targets, four-stage explanatory path, source-backed reader summary, dedicated information pages and canonical reader migration. Existing five primary navigation groups and pilot authentication remain.
2. Expert review: checked edition versus snapshot/currency, comparison/collation versus current legal force, facsimile/restored/notice distinctions, research versus executable outcomes, underlying-source rights, and URL identity versus corpus/version identity.
3. Defect hunt: caught and fixed trailing-year loss in very long slugs; checked deterministic title collisions and unknown-record handling; kept optional trailing slash inside the middleware matcher capture; corrected the stale statement about absent historical source versions. Current copy now recognises selected historical versions while retaining incomplete comprehensive comparison.
4. Polish: the chooser is before the benefit explanation, its six targets are named and keyboard-focusable; the diagram is a semantic ordered list with text labels and explicit development status; early metadata is a definition list with links to detailed evidence; dedicated rights text is open by default. Existing contact/privacy/terms anchors remain usable.

## S3 manual code and generated-component evidence

- The setup page has a labelled navigation region with six valid targets, existing downloads and direct client-specific official-documentation links. It retains operator-issued pilot status, the nine read-only tools, `UNDETERMINED` legal outcomes and browser-chat OAuth limitations. No credential appears in a generated page.
- The new figure follows the six-concept explanation and precedes the existing JUS.automica principles. It illustrates a representation path and does not redefine either authorial scheme. Four distinct text stages and the final development label do not rely on colour. CSS reduces four columns to two, then one.
- Every reader uses `record.version` and the actual source-comparison result. Unknown edition remains explicit. Snapshot dates are labelled as snapshots; no retrieval date becomes an edition or legal-currency assertion. Original facsimiles, restored readings, visually collated readings and source notices remain distinguishable.
- Canonical aliases contain identical HTML, source text and anchors. Only HTML links and head URL metadata change. TXT/JSON filenames, source registers, record IDs, version IDs, evidence graphs and MCP output are untouched. Old fragment targets remain in the canonical document.
- Contact, privacy and rights pages reuse existing factual public copy. Additional download guidance distinguishes a held representation from current law and retains source/version attribution without creating a blanket third-party licence or paid-access promise.
- Existing unique head metadata, static law HTML, robots and sitemap generation remain. The sitemap gains three information routes and replaces reader URLs, while excluding all four source notices.

This is semantic/code and generated-component QA. A tiny temporary local component server was started and stopped without browser interaction; no visual/browser acceptance is claimed. Parent owns S2 full build and corpus checks, and S4 desktop/mobile journeys and production verification.

## Routing basis and production checks

Official [Vercel middleware setup](https://vercel.com/docs/routing-middleware/getting-started) supports the root `middleware.js` convention independently of a framework and native `Response` redirects. The implementation uses no external package and matches only legacy ID-shaped reader paths. Canonical pages, API/MCP and downloadable files bypass it. Unknown matched IDs return 404. The platform's actual middleware discovery, matcher acceptance and ordering relative to `cleanUrls` must be checked by the parent build/deployment; unit execution cannot establish CDN routing order.

[RFC 9110, section 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#name-location) establishes fragment inheritance when the redirect location has no fragment. Fragments do not arrive in an HTTP request. The middleware changes only the pathname, retaining the supplied search string; the canonical HTML retains the old anchors. Production browser checks must verify a real bookmarked passage after the redirect.

No `vercel.json` redirect array or new dependency was necessary. No final or withdrawn policy PDF was added or re-published.

## Parent integration review — 13 November 2026

Preserved production045904e by fast-forwarding from61d74aa; its exact provision search,20-result pagination,keyboard focus and matching CSP remain. The18 combined remediation/experience tests pass. The parent caught the raw duplicated-year Balochistan title and corrected route validation to use the independently reviewed display title, with a raw-title regression fixture. The framework release checker now distinguishes1732 unique records from3464 legacy/canonical HTML files and validates the exact file/identity sets. Whole-library verification passed for all records,40922 legacy passage anchors,597 restored section anchors and all originals; current/historical connector retrieval passed. Final browser, current-candidate release checks and deployment remain pending at this record update.

Final local acceptance: all11current-candidate release checks and whole-library verification pass after the production-reader refresh. Enhanced flows and all13 original library journeys pass at1440x1000 and390x844, without browser/CSP errors. Scope ownership expanded to include the canonical-aware framework inventory checker. Production deployment remains the final pending gate.

Hosted clean-checkout correction: the first preview exposed a test dependency on ignored catalogue.json. Tests now project small identity metadata directly from the committed law JSON inputs. All18 relevant tests passed with the generated catalogue temporarily absent; source records and application output are unchanged.
