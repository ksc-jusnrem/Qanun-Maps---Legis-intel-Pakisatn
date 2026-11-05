# Pakistan Case Law integration

Qanun Maps `/case-law-search` offers on-demand keyword, question and citation searches, landmark judgments, individual judgment reading, paragraph selection and citation traversal. `/case-law` links to live research; all 1,728 stored-law readers supply their title as an editable starting point. Following a link does not send a query until the visitor submits it.

The browser calls the same-origin POST `/api/case-law`. The server invokes seven allowlisted read-only tools at the provider's documented public MCP endpoint, `https://pakistancaselaw.com/mcp`. No account, secret, ChatGPT session or API key is copied or required. A new MCP session is initialized per request and closed afterward. Search responses are not persisted or included in builds. No judgments are bulk imported. Existing reviewed comparisons and discovery records remain independent.

The interface preserves citations, recorded outcomes, provider attribution and source links. Headnotes/questions are labeled research aids; citation relationships do not establish judicial treatment. Results are rendered as text, never provider HTML. Searches are bounded to ten records per page and offset 200; narrow the query for further research. Upstream errors, timeouts and rate limits stay errors. Retry-After is observed. A bounded per-instance burst guard supplements the provider limit; it is not a distributed application-wide quota.

## Validation

- `node --test tools/pakistan-case-law/provider.test.mjs`
- The existing release builder runs transport/security tests alongside the framework/MCP checks.
- `node tools/qanun-release/release-build.mjs` in a disposable checkout builds all pages and checks inventory, source text preservation and exact script CSP hashes.
- Manually verify live keyword/question/citation searches, a headnote and judgment passage, both citation directions, empty results and mobile layout after deployment. Unit fixtures do not prove provider availability.

Provider documentation: https://pakistancaselaw.com/for-ai
Provider terms: https://pakistancaselaw.com/terms
Provider privacy: https://pakistancaselaw.com/privacy
