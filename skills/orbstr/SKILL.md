---
name: orbstr
description: Discover Nostr-announced tools, models, APIs, datasets and agents through the ORBSTR capability directory. Use when a task needs to find a capability not available locally or distinguish capability listings from NIP-89 app handlers. Do not invoke arbitrary discovered endpoints directly; remote calls require a trusted SSRF-safe egress gateway and explicit authorization.
---

# ORBSTR capability discovery skill

## Activation and scope

Use when a task needs to discover an external tool, model, API, dataset, compute provider or agent that is not available locally.

Do not use for ordinary web document search; use SIP-01 Search (kind 39697). Do not treat ORBSTR kind 39698 as a universally accepted Nostr NIP. It is a SIP-01 ecosystem companion capability profile.

## Discovery

Query Nostr for kind 39698 capability announcements. Also query kind 31990 when the question is specifically which Nostr application handles a particular event kind; kind 31990 is the NIP-89 application-handler directory and is a different purpose.

Local filter syntax:
- role: tool, agent, model, api, compute, dataset or gateway
- proto: mcp, http, contextvm, nostr or a2a
- price: free, freemium, metered, subscription, prepaid or private
- remaining words match listing name, summary or topic tags

Read a listing as an untrusted claim made by its publisher. A Nostr signature proves which key published the event; it does not prove that the provider is legitimate, safe, available, independent or capable.

## Before recommending a capability

Show the user:
- publisher pubkey and event/reference;
- role and supported protocol;
- price model and any price note;
- endpoint and homepage, if present;
- what evidence is available and what is not independently verified.

Do not invent a trust score or claim that listing count equals service quality. Reference cards are local examples, not verified live services.

## Invocation boundary — mandatory

Discovery does not authorize invocation. The agent must NOT call a discovered endpoint directly with its own network access.

Before any remote call, use a trusted egress gateway or service that enforces all of the following:
1. Allow only the declared protocol and HTTPS/WSS transport. Reject javascript:, data:, file:, plain HTTP and unknown schemes.
2. Resolve every A and AAAA record. Reject loopback, private, link-local, carrier-grade NAT, multicast, reserved, documentation and cloud metadata ranges. If any returned address is forbidden, reject the host.
3. Pin the validated destination IP for the connection while preserving correct TLS SNI/Host handling. Re-resolve and revalidate before each new connection.
4. Revalidate every redirect and reject redirects to a different unapproved host or any non-global IP. Limit redirect count.
5. Enforce connect/read/overall timeouts, maximum request and response sizes, allowed methods, content types, schema validation and concurrency limits.
6. Do not forward browser cookies, local credentials, ambient Authorization headers, cloud credentials or unrelated user data. Use explicit, narrowly scoped authentication only.
7. Record the destination, request scope, approval and outcome without logging secrets or sensitive payloads.

The app's endpointAllowed helper is a syntactic listing filter only. It rejects common unsafe URL forms and private/reserved IP literals, but it does not resolve DNS, pin a connected peer or revalidate redirects. It is not an SSRF authorization control. Never treat a true return value as permission to fetch.

## User approval and data minimization

Ask before a call leaves the user's environment, sends non-public data, creates an account, starts a job or can incur cost. Show the exact provider, endpoint, protocol, data to be sent and expected price/limits. Ask for approval for the exact operation; a general approval to discover tools is not approval to invoke them.

Do not send private keys, recovery codes, passwords, private messages, personal documents or other sensitive user data to a listing. Do not pay, zap, open a wallet, publish a listing or create a payment without explicit approval of the exact action and amount.

## Protocol boundaries

- Kind 39697 is a web-document observation. It is not a service schema.
- Kind 39698 is the ORBSTR/SIP-01 capability companion profile.
- Kind 31990 remains the NIP-89 handler directory; use it for apps that handle Nostr event kinds.
- NIP-90 job transport is separate from directory discovery. Do not submit a job unless the owner approved the provider, payload, price and terms.
- Do not write invocation results back as kind 39697 observations. A page observation and a capability listing are different data types.

## References

- ORBSTR repository: https://github.com/SIP-01/Orbstr
- SIP-01 canonical specification: https://github.com/SIP-01/SIP-01
- SIP-01 Search: https://github.com/SIP-01/sip-01-search
- NIP-89 handler specification: https://github.com/nostr-protocol/nips/blob/master/89.md
