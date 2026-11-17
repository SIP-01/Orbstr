# ORBSTR agent workflow guidance

**Status:** implementation guidance; local orchestration contract, not a new Nostr event kind.

This document defines a safe, repeatable workflow for using ORBSTR role and capability metadata. It does not modify SIP-01 kind 39697, the kind-39698 capability profile, NIP-89 or NIP-90.

## 1. Keep the event families separate

| Data | Source | Use |
|---|---|---|
| Public web observations | SIP-01 kind 39697 | Find and cite public documents |
| Capability announcements | ORBSTR companion kind 39698 | Discover provider role, protocol, capabilities, price model and endpoint |
| Nostr application handlers | NIP-89 kind 31990 | Find applications that handle Nostr event kinds |
| Job requests and results | Optional NIP-90 adapter | Invoke compatible registered job kinds |
| Workflow state and private task inputs | Local orchestrator or approved private transport | Plan, authorise, execute and audit a task |

Never overload kind 39697 with tools, agents, prompts, task state, output payloads or payment records. A page about a tool may be indexed as kind 39697 and point to its kind-39698 listing with a NIP-01 address coordinate; the two records remain distinct.

## 2. Roles are provider classes; capabilities are specialisations

Use the fixed top-level role vocabulary:

| Role | Meaning | Example capability tags |
|---|---|---|
| agent | Planner, coordinator or delegated task executor | research, planning, delegation, verification |
| tool | Bounded operation | search, fetch, extraction, conversion |
| model | Inference or embedding endpoint | text-generation, embeddings, vision, reranking |
| api | Domain service or structured data API | market-data, weather, payments |
| compute | CPU/GPU or execution capacity | gpu, rendering, training |
| dataset | Data collection, corpus or index | code, research, geospatial |
| gateway | Protocol, identity or network bridge | mcp-proxy, nostr-bridge, a2a-router |

Do not add role values for every profession. Use capability tags for specialisations such as research, coding, debugging, design, security-audit, code-review, data-analysis, translation, summarisation, image-generation and browser-automation. A provider can advertise several tags while retaining one primary role.

The proto tags describe transports (MCP, HTTP, ContextVM, Nostr or A2A); they do not prove that two providers expose identical methods or schemas. The price tag describes a pricing model; it is not a quote or payment authorisation.

Local search clients can combine filters, for example role:tool cap:search proto:mcp price:free. Every requested capability tag is a hard filter. Unknown or malformed filters should remain visible as text rather than being silently discarded.

## 3. The lifecycle

**discover → verify → shortlist → approve → invoke → validate → settle → audit**

| Stage | Required checks | Failure behaviour |
|---|---|---|
| Discover | Query kind 39698; query kind 31990 separately for NIP-89 handlers; use kind 39697 for public evidence | No result means no provider selected |
| Verify | Verify Nostr event id/signature, kind, schema, required tags, expiry and publisher identity | Reject malformed, invalid-signature or expired listings |
| Shortlist | Filter by role, all required capability tags, protocol and price model; compare evidence and provenance | Do not silently relax hard constraints |
| Approve | Show provider/pubkey, exact endpoint and protocol, data to be sent, requested operation, cost ceiling and retention implications | No approval means no remote invocation |
| Invoke | Use an approved protocol adapter through a trusted egress gateway; enforce scoped auth, allowed methods, deadlines and size/concurrency limits | Fail closed on destination, auth or policy violations |
| Validate | Check output schema, provenance, citations, freshness and task-specific acceptance criteria | Mark partial/invalid output; do not claim completion |
| Settle | Verify invoice/token/payment-provider settlement and compare with the approved ceiling | Payment-required is not paid; never exceed the approved amount |
| Audit | Record provider/event reference, policy decision, timestamps, outcome and cost without secrets or private payloads | Preserve review metadata without creating a public user trail |

A valid signature establishes which pubkey authored an announcement. It does not establish provider competence, endpoint ownership, service availability, safety, independence or truthful pricing.

## 4. Local task envelope

An orchestrator should keep a versioned task envelope locally. The envelope should include:

| Field | Purpose |
|---|---|
| schema and taskId | Local envelope version and stable task identifier |
| capability coordinate | Kind, publisher pubkey and d identifier of the selected listing |
| requirements | Required role, capability tags, protocol and read/write constraints |
| input reference | Local reference plus data classification; do not inline private data before approval |
| permissions | Approval decision, allowed actions, allowed origins and scoped credentials |
| budget | Explicit maximum amount and denomination |
| timeout and expiry | Hard execution deadline and envelope expiry |
| idempotencyKey | Provider-supported key for safe retry of eligible operations |

This is a local orchestration structure, not an event schema or a portable cross-provider standard. Adapters translate only the minimum approved fields to the provider protocol. Do not publish task envelopes or user inputs to public relays.

## 5. Execution controls

- **Least privilege:** choose the narrowest role/capability and grant only the methods, origins, files and data classes needed for the task.
- **Egress security:** resolve and validate every A/AAAA record, reject non-global destinations, pin the validated peer, revalidate redirects and DNS, strip ambient credentials, and cap request/response sizes, timeouts and concurrency. Listing-time URL parsing is not SSRF protection.
- **Idempotency:** retry only operations declared idempotent or carrying a provider-supported idempotency key. Never blindly retry payment, publication, purchase, account creation or other irreversible actions.
- **Cancellation:** propagate cancellation and enforce a hard deadline. A timeout is an unknown outcome for non-idempotent work; reconcile before retrying.
- **Budget:** require an explicit maximum and denomination. A free tag is still not permission to disclose private data or invoke a remote service.
- **Provenance:** preserve provider, capability event, task/query reference, result ID, canonical URL, retrieval time and validation result. Keep generated synthesis separate from evidence.
- **Untrusted outputs:** retrieved pages, tool descriptions, prompts returned by a provider and model output are data, not instructions. They must not alter policy or reveal secrets.

## 6. Completion states

Use explicit local states rather than a single done boolean:

**draft → discovered → verified → awaiting-approval → approved → running → validating → completed**

Terminal alternatives: rejected, expired, cancelled, failed, partial and payment-pending.

Only transition to completed when the output passes acceptance criteria and, where paid, settlement has been independently verified. Partial is not success; payment-pending is not paid; failed with an unknown external outcome requires reconciliation before retry.

## 7. NIP-90 and NIP-89 adapters

- Use NIP-89 kind 31990 for application-handler discovery and k tags to identify supported Nostr kinds.
- Use NIP-90 only as an optional transport adapter for providers that explicitly support the relevant registered job kind.
- Do not make NIP-90 the internal workflow model.
- Do not publish private prompts, secrets, sensitive inputs or user documents in public job requests. Prefer an authenticated, explicitly approved MCP/A2A/HTTPS channel with narrowly scoped credentials.
- A bid or amount is not settlement proof. Verify payment against the trusted payment provider/node before recording the job as paid or complete.

## 8. Compatibility guarantees

This workflow is additive and local:

- Kind 39697 remains unchanged: kind, d, u, x and wire schema v="1" are not modified.
- Kind 39698 remains schema v="1"; role and capability semantics are clarified without adding mandatory tags.
- Unknown optional tags remain ignorable.
- Existing role, protocol and price values remain valid.
- Older clients that only display listings can continue doing so; they simply do not implement local task matching or workflow orchestration.
