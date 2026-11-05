# Qanun evidence-based rule framework

Original Qanun Maps implementation. No LAWLIA source, prompts or adapted code included.

## Implemented

- Source-bound structured research propositions derived from the existing reviewed rule-case relationships. Authority recital, exact version, case passages, qualifications and separate review statuses are retained.
- A public `/rule-workbench` page with source links and local-only fact checklists. Facts are neither transmitted nor persisted. Checklists are editorial aids awaiting legal review, not complete encoded tests. Legal outcomes remain UNDETERMINED even when every user-supplied fact is marked supported.
- Nine read-only research operations: find_legislation, find_provisions, get_provision, find_cases, get_rule, get_mapping_evidence, compare_versions, coverage_gaps, assess_rule.
- A local MCP stdio server implementing initialization, ping, tools/list and tools/call using protocol 2025-06-18. This is an executable local component, not a remotely connectable ChatGPT service.
- Default-deny local entitlement policy for individual and institutional grants, expiry, revocation, tool permissions, seat assignments and a per-process session call cap.
- Supplied Drive section candidates retained as unsigned drafts. Source IDs and titles match the held catalogue; underlying AKN and statute text were absent from the archive. Source bytes, member hashes and archive hash are recorded separately from legal review.

## Execute

From the repository root:

```powershell
node --test tools/qanun-framework/framework.test.mjs tools/qanun-framework/mcp.test.mjs
node tools/qanun-framework/mcp.mjs
```

The second command reads newline-delimited JSON-RPC on stdin and writes only protocol messages to stdout. It denies all tool calls unless a private operator-managed entitlement registry and access token are supplied through environment variables. Never put credentials on a command line or in the repository.

Configuration names: `QANUN_PUBLIC_DIR` (defaults to landing-pages/qanun-maps), `QANUN_ENTITLEMENTS_FILE` (absolute path outside public assets), `QANUN_ACCESS_TOKEN` (at least 32 characters, matched to a SHA-256 hash in the registry). Protect the registry with OS permissions; the local operator can edit it and is therefore trusted. The registry is reread on each call so revocation/expiry and seat changes apply immediately.

Grant fields: token_sha256, subject, plan (individual_monthly, individual_annual, institutional), status=active, expires_at (ISO timestamp), tools (explicit list), session_call_limit (positive integer), revoked_at (null or absent), institution_id for institutional grants. Institutional account fields: id, status, expires_at, seat_limit, active_subjects (unique assigned subjects), permitted_tools. These are operator-configured development grants; no real subscription or legal licence is created automatically.

## Commercial release boundary

US$5/month and US$50/year are the approved individual prices; institutional pricing remains by quotation. Payoneer and other payment methods remain coming soon. This code does not collect payments, auto-issue licences, or claim merchant approval.

Before remote paid access: integrate a supported identity/OAuth service and remote MCP transport, durable entitlement storage and atomic account-wide quotas, billing confirmation, institutional administration and approved licence terms. The local session limit resets when the process restarts and is not a production billing quota. The local registry is not a tamper-resistant licensing mechanism for software distributed to subscribers. Do not expose this stdio process as a public service by wrapping it without these controls.

## Evidence and rights

Current legal force, binding effect, later treatment and commercial source reuse clearance remain unknown unless individually established. Headings are discovery aids. Different publisher records are never silently merged as versions. A requested unavailable version yields COMPARISON_UNAVAILABLE. Review the exact source passage before relying on any proposition.

Official MCP reference used: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports and its tools/lifecycle specifications.
