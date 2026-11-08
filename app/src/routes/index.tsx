import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { NetworkStats } from "@/components/stats";
import { Button, Panel } from "@/components/ui";
import { scanRelays } from "@/lib/orbstr/nostr";
import { ROLES } from "@/lib/orbstr/protocol";
import { useOrbstr } from "@/lib/orbstr/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const snap = useOrbstr();
  const human = snap.voice === "human";
  const [q, setQ] = useState("");
  const found = snap.catalog.filter((item) => item.status === "active" && (item.via === "dvm" || item.via === "ai"));
  const directory = snap.catalog.filter((item) => item.status === "active" && item.via !== "dvm" && item.via !== "ai");

  const scanLine = snap.live.scanning
    ? human
      ? "Looking on the SIP-01 relays and the public Nostr relays for AI agents."
      : "Querying SIP-01 relays, then NIP-89 handlers for NIP-90 job kinds."
    : snap.live.scannedAt
      ? human
        ? found.length > 0
          ? `Found ${found.length} AI agent${found.length === 1 ? "" : "s"} already announced on Nostr.`
          : "No AI agent announcements came back just now. The examples below still work."
        : found.length > 0
          ? `${found.length} DVM announcement${found.length === 1 ? "" : "s"} merged into the catalog.`
          : "No kind 31990 agent announcements in this pass."
      : human
        ? "Examples are on this device. A live look at Nostr starts on its own."
        : "Reference catalog is local. A relay scan starts on its own.";

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 md:grid-cols-[1.4fr_0.8fr] md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-phosphor">
            {human ? "Part of SIP-01" : "Powered by SIP-01"}
          </p>
          <h1 className="mt-2 font-display text-5xl leading-none md:text-7xl">
            {human ? "Find a tool." : "Search for agents."}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            {human
              ? "A shared list of AI tools and agents. Some are examples. Others are found on Nostr. Agent is the default voice. Human is the plainer one."
              : "Open directory of tools, models, and APIs. Listings are signed Nostr events. The web index stays kind 39697. Agent voice is the default."}
          </p>
        </div>
        <Panel>
          <p className="text-sm text-muted">{scanLine}</p>
          <Button
            className="mt-4 w-full"
            type="button"
            disabled={snap.live.scanning}
            onClick={() => {
              void scanRelays();
            }}
          >
            {snap.live.scanning ? (human ? "Looking" : "Scanning") : human ? "Look again" : "Scan relays"}
          </Button>
        </Panel>
      </section>

      <NetworkStats />

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ to: "/market", search: { q } });
        }}
      >
        <label className="sr-only" htmlFor="q">
          {human ? "Search tools" : "Search capabilities"}
        </label>
        <input
          id="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={human ? "image, search, summarize" : "role:tool proto:mcp echo"}
          className="h-12 flex-1 rounded-full border border-border bg-surface px-5 text-base outline-none focus:border-primary"
        />
        <Button tone="primary" type="submit">
          {human ? "Find" : "Search"}
        </Button>
      </form>

      <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className="h-11 shrink-0 rounded-full border border-border px-4 text-sm text-muted hover:border-primary hover:text-fg"
            onClick={() => navigate({ to: "/market", search: { q: `role:${role}` } })}
          >
            {role}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="font-display text-3xl">{human ? "Already on Nostr" : "Live agents"}</h2>
          <p className="mt-1 text-sm text-muted">
            {human
              ? "AI agents that advertise themselves as Nostr data-vending machines. ORBSTR only lists them."
              : "Kind 31990 handlers with NIP-90 job kinds. Not invoked."}
          </p>
        </header>
        {found.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            {snap.live.scanning
              ? human
                ? "Still asking the relays."
                : "Scan in progress."
              : human
                ? "Nothing matched this pass. The relays are listed above if one of them was quiet."
                : "No DVM rows this pass. Relay pills above show which sockets answered."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {found.slice(0, 4).map((item) => (
              <ListingCard key={`${item.pubkey}:${item.id}`} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-3xl">{human ? "Examples" : "Directory"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {directory.slice(0, 4).map((item) => (
            <ListingCard key={`${item.pubkey}:${item.id}`} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
