# Hosted Qanun Maps research MCP

The authenticated Streamable HTTP endpoint is `https://www.jusnrem.legal/mcp`. It shares the nine read-only operations and evidence model with `tools/qanun-framework/service.mjs`. JSON responses and stateless requests work across serverless instances. No GET/SSE stream or server-initiated requests are advertised. Protocol versions 2025-06-18, 2025-03-26 and 2024-11-05 are negotiated.

## Operator pilot

`QANUN_MCP_GRANTS` is a sensitive production environment variable containing `{ "grants": [...] }`. Each grant has a SHA-256 token hash, distinct subject/client ID, exact endpoint audience, future expiry, active/revoked flags, and explicit tool allowlist. Only `operator_pilot` grants are accepted. Subscription entitlements in the local stdio connector remain separate. No subscription, OAuth service, durable usage quota or paid entitlement is created by this release.

Issue owner keys outside the repository with `node tools/qanun-mcp/issue-keys.mjs ABSOLUTE_PRIVATE_DIRECTORY`. This creates five independently revocable 30-day keys and a hash-only registry. Restrict directory permissions on the host OS. Never commit, publish, log or put keys in URLs. Configure the hash-only registry in the production environment. Removing a grant or setting `revoked: true` and deploying the updated configuration revokes it. Expiry is checked on every request. Do not sell pilot keys as subscriptions.

The hosted bundle contains the already-public law JSON/text files and public mapping evidence. It does not contain manuscript records or private entitlement files. Request bodies are limited to 64 KiB. Invalid origins/hosts, keys and protocol envelopes are rejected before corpus access. Tool output is bounded and errors omit filesystem details. The service does not make outbound network requests or log user-supplied facts.

## Multiple clients

See `/connectors` and `/client-setup/README.txt`. Claude Code and VS Code connect with Streamable HTTP and a private bearer key. The Claude and Grok Python examples use their provider APIs and environment-supplied credentials/model names. They are documentation examples, not claims that provider accounts were connected or tested. Other stdio clients can run the dependency-free Node bridge, which pins the canonical HTTPS endpoint, forbids redirects and reads credentials from a private file or environment variable. Keep one key per client; enable only the research tools you need.

Browser-chat OAuth, account administration, payment processing and durable subscription quotas require a further hosted identity/entitlement integration before commercial activation. The paid membership page continues to describe future access.

## Verification

Run `node --test tools/qanun-mcp/http.test.mjs tools/qanun-mcp/bridge.test.mjs tools/qanun-framework/framework.test.mjs tools/qanun-framework/mcp.test.mjs`. The release build also verifies the public setup files and corpus preservation. After deployment, verify unauthenticated rejection, initialize/list/call using each owner key, real source-linked output and the exact production commit. Inspect the public pages on desktop and mobile separately from API tests.

References: [MCP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), [Claude Code](https://code.claude.com/docs/en/mcp), [Claude API](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector), [xAI remote MCP](https://docs.x.ai/developers/tools/remote-mcp), [VS Code](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).
