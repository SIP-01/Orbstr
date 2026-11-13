# SIP-01 and ORBSTR: Agent interoperability and Nostr standards

**Research checkpoint:** 2026-11-13  
**Scope:** SIP-01 decentralized search, ORBSTR agent discovery, relay profiles, identity, payments and private execution.

This document is an implementation guide, not a claim that every listed NIP is mandatory or fully implemented. NIPs are optional possibilities; implement only the subset each relay/client actually supports.

## 1. The architectural rule

Keep four concerns separate:

1. **Discovery:** how a client finds an agent endpoint.
2. **Identity and authenticity:** which key/domain controls that endpoint and who signed its Nostr announcements.
3. **Capability and authorization:** what the agent can do, what the caller permits, and what data may leave the device.
4. **Execution and settlement:** how a job runs, how costs are bounded, and how payment is verified.

A signed Nostr listing proves that a key published a claim. It does not prove that the endpoint is safe, that the operator is reputable, that a model is competent, or that the caller has authorized execution.

SIP-01 should remain the shared web observation/index protocol. ORBSTR should remain the agent/capability layer. Neither should redefine core Nostr event semantics.

## 2. Agent Community AID: integrate it as the first discovery hop

Agent Community's AID v2.1.1 is a useful complement to Nostr. It solves **where is the endpoint, which protocol does it speak, and how can the endpoint prove it controls the published key?** It does not try to be the capability directory or trust-ranking system.

An AID v2 DNS record is published at the _agent subdomain and uses fields such as:

- **v=aid2** — record version.
- **u=** — endpoint URL.
- **p=** — protocol such as MCP, A2A, OpenAPI, gRPC or WebSocket.
- **a=** — authentication method, for example none.
- **k=** — optional Ed25519 public key for Proof of Key (PKA).
- **s=** — short service label.
- **d=** — documentation URL.

When DNS lookup is unavailable, AID defines GET https://example.com/.well-known/agent as a JSON fallback mirroring the TXT record.

**Important key distinction:** AID's optional k field is an endpoint PKA key, not automatically the agent's Nostr public key. If a record publishes k, clients must verify the nonce-bound HTTP Message Signature and domain-bound proof; they must not silently skip verification.

### ORBSTR's proposed binding profile

1. Resolve and validate AID, including the protocol, authentication mode, endpoint and PKA proof where present.
2. Resolve the same domain's NIP-05 identifier and verify that it maps to the Nostr pubkey signing the agent's NIP-89 handler event.
3. Fetch the NIP-89 kind 31990 handler event and verify its event hash and Schnorr signature.
4. Compare its supported k job kinds with the actual advertised MCP/A2A capabilities.
5. Show separate evidence states: **Nostr signature verified**, **NIP-05 domain match**, **AID endpoint verified**, **capability schema inspected**, **endpoint health checked**, and **payment method verified**.

Do not compress these into one green “trusted agent” badge. The AID/NIP-05 cross-binding is an ORBSTR integration profile to specify and test; it is not a universal Nostr standard today.

Agent Community's published work items say AID v2 is published and TypeScript, Python and Go SDKs, AID Doctor and the DMV CLI are available. Further agent verification, inter-agent protocols and safety frameworks are listed as future work. Its product MCP endpoint exposes exactly four tools: exact lookup_member, roughly-live get_community_stats, register_agent (a non-binding .agent pre-registration requiring explicit human authorization), and verify_certificate. It is not a bulk member API or a universal trust authority. The .agent TLD is pending ICANN approval; a pre-registration or certificate is not proof of current domain ownership.

References: [AID specification](https://aid.agentcommunity.org), [AID overview](https://agentcommunity.org/docs/aid), [Agent Community onboarding](https://agentcommunity.org/docs/agent-onboarding), [work items](https://agentcommunity.org/docs/work-items).

## 3. Nostr event standards to use

| Purpose | NIP / event kinds | ORBSTR / SIP-01 usage |
|---|---|---|
| Search observations | SIP-01 kind **39697** | Canonical signed web observations; keep this schema unchanged |
| ORBSTR capability | App-specific kind **39698** | Companion capability profile; not an accepted NIP |
| NIP-89 handler discovery | **31990** handler information; **31989** user recommendations | Use k tags for supported event/job kinds; use recommendations from follows/trusted authors before unrestricted discovery |
| NIP-25 voting | **7** reactions; **17** external-content reactions | Raw vote counts, dedupe by voter and target, trust-weight separately |
| NIP-32 labels | **1985** | Namespaced L/l labels for quality, spam, phishing and content classification |
| NIP-56 reports | **1984** | Abuse reports as signals; do not let arbitrary reports automatically ban content |
| NIP-51 bookmarks | **10003**, **30003** | Public bookmark list and categorized bookmark sets; NIP-44 encrypted private content |
| NIP-73 identifiers | i with k=web | Canonical external URL references inside interoperable lists/reactions |
| NIP-B0 web bookmarks | **39701** | Optional editable per-URL bookmark event; keep NIP-51/NIP-73 as the broad list interoperability path |
| NIP-85 assertions | **10040**, **30382–30385** | Provider lists and provider-specific assertions; no universal trust score |
| NIP-40 expiry | expiration tag | Expire short-lived capabilities, jobs, quotes and results; clients must still filter expired events |
| NIP-66 relay discovery | **30166**, **10166** | Discover and monitor relays; cross-check monitors and Web of Trust |
| NIP-50 search | REQ search filter | Relay search; relevance-ranked results, not merely newest-first |
| NIP-45 count / NIP-77 sync | COUNT / negentropy | Efficient counts and synchronization between indexers/relays |
| NIP-31 unknown-event UX | alt tag | Give clients a human-readable fallback for unknown SIP/ORBSTR event kinds |

NIP-B0, NIP-32, NIP-40, NIP-89 and NIP-85 are draft/optional in the current specifications. Keep compatibility paths and do not assume every relay implements them.

### Bookmarks

- Use NIP-51 kinds 10003 and 30003 for interoperable saved lists and categories.
- Use NIP-73 i/k references for external web URLs in lists.
- Use NIP-44 encryption for private bookmark content. Keep decryption client-side; never index or publish private URLs.
- NIP-B0 kind 39701 can add a dedicated editable bookmark for one URI, but it is draft/optional and should not replace NIP-51 list support.
- In the ORBSTR/Savedd UI, “Saved Results” is acceptable presentation terminology; the wire protocol remains NIP-51 bookmarks.

### Voting, labels and Web of Trust

- Keep NIP-25 reactions separate from NIP-32 labels and NIP-56 reports. A vote is not a moderation label; a report is not a verdict.
- Preserve raw counts and compute trust-weighted ranking separately.
- Deduplicate by voter/target and apply a deterministic latest-vote policy. Do not let a client report success unless at least one relay accepted the signed event.
- Use NIP-85 provider assertions only with explicit provider selection and provenance. Providers can disagree and their scores are not globally comparable.
- Support platform trust, personal follow-graph trust, and a documented combined mode. Platform hard blocks must not be overridden by personal preferences.
- Use multiple relay monitors and trust sources; never accept a single NIP-66 monitor or one NIP-85 provider as universal truth.

## 4. DVMs and agent execution

NIP-90 reserves **5000–5999** for job requests, **6000–6999** for results (result kind = request kind + 1000), and **7000** for feedback. NIP-89 kind 31990 can advertise supported job kinds with k tags.

However, the current official NIP-90 file is tagged draft, unrecommended and optional, with an explicit warning to prefer use-case-specific microstandards. Therefore:

- Do not make NIP-90 the internal ORBSTR job model.
- Keep an internal versioned job envelope with a stable request ID, capability ID, input/output schema, expiry, idempotency key, budget ceiling, permission scope, cancellation and result provenance.
- Implement NIP-90 as an adapter for compatible providers only, and support only registered job kinds from the DVM kind registry.
- Use NIP-89 recommendations from the user's follows/trusted authors for default discovery. Directly querying every 31990 handler is a lower-trust fallback.
- Do not expose sensitive job input in public kind 5000 events. NIP-90's legacy encrypted-parameter convention is not a reason to publish secrets. Prefer authenticated MCP/A2A over HTTPS with NIP-98, or a separately specified private Nostr envelope.

NIP-90 bid is a maximum willingness-to-pay, not proof of payment. amount and a BOLT11 invoice in a result/feedback event are payment requests. payment-required feedback means the provider will not continue until paid. ORBSTR must verify settlement through a trusted payment backend before recording a paid job as complete.

## 5. Payments: separate job settlement, wallet control and relay admission

| Need | Standards | Use |
|---|---|---|
| User-controlled Lightning wallet | NIP-47, kinds **13194/23194/23195** | Nostr Wallet Connect; use a dedicated private relay and a per-app connection key with wallet-side spending limits |
| Social Lightning payment | NIP-57, zap request/receipt; receipt kind **9735** | Optional payment UX; verify the zap request/receipt against LNURL provider metadata and amount |
| Payment address discovery | NIP-A3 kind **10133** | Optional payto tags for provider payment targets; not a job invoice or settlement proof |
| Cashu wallet and ecash | NIP-60 / NIP-61 | User wallet state and Nutzaps; validate proofs with the mint and respect token/spend state |
| Mint discovery | NIP-87 kinds **38000**, **38172**, **38173** | Discover and recommend Cashu/Fedimint mints; recommendations are not mint security audits |
| Public compute funding | NIP-75 kind **9041** | Community pool or grant goal; tally zaps using the goal's specified relays |
| Paid/private relay membership | NIP-43 kinds **33534/13534/8000/8001/28934/28936** | Relay roles, member lists, invite claims and join/leave requests; not per-job payment |
| Relay administration | NIP-86 HTTP JSON-RPC with NIP-98 authorization | Admin-only bans, allowlists, roles and invite claims; never expose to ordinary agents |

A NIP-57 zap receipt is not itself cryptographic proof that a Lightning invoice settled. Verify the invoice/preimage or settlement state with the payment provider/node. For Cashu, verify the token against the mint. Never infer paid status from a payment-required or amount tag.

**Relay separation is mandatory:**
- Public SIP search relays: public observations, public votes/labels/reports, public bookmarks, handler announcements and public trust assertions.
- Agent job relays: only if the operator explicitly enables them, with authentication, quotas, expiry and job-kind policy.
- Wallet relays: private NIP-47 traffic, not indexed or mixed with public search events.
- Private message relays: NIP-17/NIP-59 gift-wrap traffic, AUTH-gated and recipient-filtered. Gift-wrap authors are one-time keys, so ordinary pubkey reputation/rate limits do not work.

Do not route wallet requests, private prompts, secrets or NIP-44/NIP-59 plaintext through the public SIP index.

## 6. Relay profile requirements

A public SIP relay should implement and advertise only what it actually supports:

- NIP-01 event validation, replaceable/addressable semantics and deletions (NIP-09).
- NIP-11 information, NIP-42 authentication where required, NIP-40 expiry, NIP-45 COUNT, NIP-50 search and NIP-77 synchronization.
- Generic NIP-01 storage/filtering for the public event families listed above.
- Tag indexing for e, p, a, d, i, k, L, l, t, x, v as applicable.
- Per-pubkey and per-kind quotas, payload limits, query complexity limits, deduplication and abuse telemetry.
- NIP-66 monitoring and NIP-11 verification before an engine trusts a relay announcement.

Do not accept all NIP-90 job kinds by default on a search relay. Enable them only on a dedicated agent/job profile with stricter admission, retention, cost and abuse controls. Do not accept NIP-47 wallet traffic on a public index relay.

NIP-43 is a membership/access convention. NIP-86 is an administrative HTTP API authenticated with NIP-98. Neither should be mistaken for a general payment API.

## 7. Current gaps to close

1. **ORBSTR AID integration:** AID DNS/PKA resolver and NIP-05 ↔ NIP-89 key/domain binding are not yet implemented.
2. **NIP-89 social discovery:** current ORBSTR discovery reads kind 31990 directly; add kind 31989 recommendations from follows/trusted authors as the preferred path.
3. **ORBSTR execution:** current UI is discovery and deterministic suggestion only. It does not execute arbitrary remote agents or perform real wallet payments. Keep this boundary until an SSRF-safe egress gateway, explicit capability permissions, per-call budgets and result verification exist.
4. **Payment adapter:** current payment flow is a mock/reference path, not production NWC/Cashu settlement.
5. **SIP-01 shared core distribution:** apps still carry local bookmark/vote logic. Publish a reproducible, pinned Git dependency or package and migrate one engine at a time with cross-repo tests before deleting local implementations.
6. **Relay conformance:** add NIP-32 label, NIP-56 report and NIP-89 handler storage to the SIP-focused relay profile; add NIP-40 expiry enforcement. Keep NIP-90 disabled by default.
7. **Trust ranking:** wire NIP-85 provider selection, personal/platform WoT modes, trusted labelers and explainable ranking into the shared core. Never convert a provider assertion into a global score.

## 8. Recommended implementation order

1. Finish relay NIP-40, NIP-32, NIP-56 and NIP-89 conformance plus tests.
2. Harden ORBSTR relay discovery: verify event hash/signature, honour expiry, then add NIP-89 recommendation filtering.
3. Add AID v2 DNS/PKA resolution and NIP-05/NIP-89 cross-binding with explicit evidence states.
4. Define the ORBSTR internal job envelope and MCP/A2A invocation boundary; add NIP-90 compatibility only where a provider already supports it.
5. Add NWC first for user-approved Lightning payments; add Cashu/Nutzaps and NIP-87 mint discovery as a separate optional adapter.
6. Migrate one search engine to the shared sip-01-core bookmark/vote/WoT package; prove interoperability, then repeat across Savedd, Dsearch, 0xSearchstr, 0xPresearchstr and UNCAGED.
7. Add browser/mobile UX, accessibility, security and end-to-end audits once the relevant live app/browser capture surface is available.

## Primary references

- [Official NIPs repository and status index](https://github.com/nostr-protocol/nips)
- [NIP-89](https://github.com/nostr-protocol/nips/blob/master/89.md)
- [NIP-90](https://github.com/nostr-protocol/nips/blob/master/90.md)
- [NIP-32](https://github.com/nostr-protocol/nips/blob/master/32.md) · [NIP-56](https://github.com/nostr-protocol/nips/blob/master/56.md) · [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md)
- [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md) · [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) · [NIP-61](https://github.com/nostr-protocol/nips/blob/master/61.md) · [NIP-87](https://github.com/nostr-protocol/nips/blob/master/87.md) · [NIP-A3](https://github.com/nostr-protocol/nips/blob/master/A3.md)
- [Agent Community AID v2](https://aid.agentcommunity.org) · [Agent Community work items](https://agentcommunity.org/docs/work-items)
