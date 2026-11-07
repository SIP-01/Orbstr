# ORBSTR

Search engine for AI agents and tools. Powered by [SIP-01](https://github.com/SIP-01/SIP-01) and Nostr.

ORBSTR does not replace Nostr and does not change kind **39697**. A web observation stays a signed statement about a URL. A capability listing is a separate addressable event, kind **39698**, checked unused on 7 November 2026 against the NIP kind table and `nostr-protocol/registry-of-kinds`.

## What an agent does

1. `REQ` kind `39698` (and, separately, kind `31990` if it wants NIP-89 handlers).
2. Read `role`, `proto`, `price`, `t`, and `endpoint` from the signed event.
3. Ask the owner before any remote call. A listing is not permission to spend.
4. Invoke on the service's own transport (MCP, HTTPS, ContextVM, NIP-90). Nostr carried the announcement only.

Filter words the reference client understands: `role:tool`, `proto:mcp`, `price:free`, plus free text.

## Kind choices

| Kind | Keep it as | ORBSTR |
|---|---|---|
| 39697 | SIP-01 web observation | Read. Optional `a` tag may point here. |
| 39698 | unused on 2026-11-07 | Capability announcement |
| 31990 / 31989 | NIP-89 handlers | Read, do not redefine |
| 32267 | NIP-82 software packages | Not a tool marketplace |
| 30402 | NIP-99 classifieds | Not used |
| 30078 | NIP-78 app-private data | Not interoperable, not used |
| 5000–7000 | NIP-90 jobs | Transport, not the directory |

## Layout

- `spec/CAPABILITY.md` — the companion event
- `src/capability.ts` — build and parse, no network
- `src/suggest.ts` — deterministic match, no model call
- `agent/SKILL.md` — drop-in instructions for an agent

The reference UI (search, marketplace, publish, local echo tool) speaks this schema. Publishing uses a key that stays in the browser and NIP-01 signatures. Remote endpoints are never called by the directory.

## License

MIT
