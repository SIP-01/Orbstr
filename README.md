# ORBSTR

Discover tools, models, APIs, datasets, compute providers and agents announced on Nostr. ORBSTR uses the SIP-01 ecosystem's companion capability profile (kind **39698**) and keeps it separate from SIP-01 web observations (kind **39697**).

Kind 39698 is an ORBSTR/SIP-01 companion profile, not an accepted Nostr NIP or a change to kind 39697. The kind allocation was checked against upstream registries on 7 November 2026; re-check before relying on that claim in future protocol changes.

## What discovery means

1. Query kind 39698 for capability announcements.
2. Query kind 31990 separately when the task is finding NIP-89 handlers for Nostr event kinds.
3. Inspect publisher pubkey, role, protocol, price and endpoint as untrusted publisher claims.
4. Ask for approval before any remote call, data disclosure or cost-bearing operation.
5. Use a trusted SSRF-safe egress gateway for every remote invocation.

**A listing is not permission to invoke.** Nostr signatures establish who published a listing, not whether the endpoint is safe, truthful, available or independent.

## Endpoint safety

The app's `endpointAllowed()` helper is only a syntactic filter for listing creation/parsing. It rejects common dangerous URL forms and private/reserved IP literals, but it does not resolve DNS, validate all A/AAAA results, pin the actual connected peer or revalidate redirects.

Agents and servers must not call discovered endpoints directly. Remote invocation requires a trusted egress gateway that:
- resolves and rejects private, loopback, link-local, CGNAT, multicast, reserved and metadata destinations;
- pins the validated destination and revalidates DNS before each connection;
- revalidates every redirect and limits redirect count;
- enforces timeouts, response/request size limits, schema validation and concurrency bounds;
- strips ambient credentials and sends only narrowly scoped, explicitly authorized authentication.

## Kind choices

| Kind | Meaning | ORBSTR use |
|---|---|---|
| 39697 | SIP-01 web observation | Read; not a service schema |
| 39698 | ORBSTR/SIP-01 companion capability profile | Capability announcements |
| 31990 / 31989 | NIP-89 handlers | Read; do not redefine |
| 32267 | No current accepted NIP assignment verified | Do not use as a package standard |
| 30402 | NIP-99 classifieds | Not used |
| 30078 | NIP-78 app-specific data | Not a shared directory |
| 5000–7000 | NIP-90 job kinds | Optional compatibility adapter only; unrecommended in the current NIPs index |

## Layout

- `spec/CAPABILITY.md` — companion event profile
- `docs/AGENT-INTEROPERABILITY.md` — NIP/AID/DVM/payment and relay integration guidance
- `src/capability.ts` — build and parse functions
- `src/suggest.ts` — deterministic suggestion matcher; no model call
- `app/` — reference UI, deployed at https://orbstr.vercel.app
- `skills/orbstr/SKILL.md` — portable Agent Skill package

## Agent skill install

Install the package into a directory named `orbstr` so that the folder matches the frontmatter:

~~~bash
git clone https://github.com/SIP-01/Orbstr <skills-root>/orbstr
~~~

## Reference UI behavior

The reference UI supports local discovery and publishing with a browser signer. The directory itself does not call arbitrary remote endpoints. Future agent invocation should use the separate egress-gateway boundary described above.

## License

MIT
