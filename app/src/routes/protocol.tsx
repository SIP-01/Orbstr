import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/ui";
import { useOrbstr } from "@/lib/orbstr/store";

const ROWS = [
  ["39697", "SIP-01 web observation", "Unchanged. Still one URL, one indexer, tags d / u / x / v."],
  ["39698", "Capability announcement", "New companion. Checked unused on 7 Nov 2026 in the NIP kind table and registry-of-kinds."],
  ["31990", "NIP-89 handler", "Read, not redefined. App handlers and DVM announcements stay here."],
  ["31989", "NIP-89 recommendation", "People recommending a handler. Not a service schema."],
  ["32267", "NIP-82 software app", "Package metadata for installable software. Not an MCP listing."],
  ["5000–7000", "NIP-90 jobs", "Request, result, and feedback. Transport, not the directory."],
  ["30402", "NIP-99 classified", "Goods for sale. Left alone."],
  ["30078", "NIP-78 app data", "Explicitly not an interoperable format. Not used."],
];

export const Route = createFileRoute("/protocol")({ component: Protocol });

function Protocol() {
  const human = useOrbstr().voice === "human";
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl">{human ? "How this fits together" : "What was reused"}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {human
            ? "ORBSTR rides along with SIP-01. The web index is unchanged. Agent listings are a separate note, and AI agents that already live on Nostr are read from the announcements they already publish."
            : "Kind 39697 schema version stays \"1\". New optional tags on a web observation are role, proto, and a normal NIP-01 a tag that points at 39698:pubkey:id. Old clients ignore them. NIP-90 DVMs stay on kind 31990."}
        </p>
      </header>
      <div className="max-w-full overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Already means</th>
              <th className="px-4 py-3 font-medium">ORBSTR</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row[0]} className="border-t border-border">
                <td className="px-4 py-3 text-primary">{row[0]}</td>
                <td className="px-4 py-3">{row[1]}</td>
                <td className="px-4 py-3 text-muted">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">Listing tags</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>d — stable service id</li>
            <li>v — schema, currently 1</li>
            <li>role — agent, tool, model, api, compute, dataset, gateway</li>
            <li>proto — mcp, http, contextvm, nostr, a2a</li>
            <li>price — free through private</li>
            <li>t — capability words relays can filter</li>
            <li>endpoint — https or wss only</li>
            <li>r — public homepage</li>
            <li>expiration — NIP-40 unix time</li>
            <li>alt — NIP-31 description</li>
            <li>status=withdrawn replaces the addressable event</li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">{human ? "Relays that come with it" : "Standard relays"}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {human
              ? "Five SIP-01 index relays are always on, plus the public relays where agent announcements show up, including nostr.hifish.org. search.nos.today is read, never written. You can add more. You cannot drop the SIP-01 ones."
              : "Pinned from the Indexstr pool: relay-na1.metanomalist.com, the SIP worker relays, nostr.band, ditto, noswhere, damus, primal, jskitty, hifish. search.nos.today is read-only. The Tor twin is not used in a normal browser."}
          </p>
        </Panel>
      </div>
    </div>
  );
}
