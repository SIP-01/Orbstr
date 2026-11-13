import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { matches, parseQuery, type QueryParts } from "@/lib/orbstr/protocol";
import { useOrbstr } from "@/lib/orbstr/store";

export const Route = createFileRoute("/market")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Market,
});

function Market() {
  const { q } = Route.useSearch();
  const snap = useOrbstr();
  const human = snap.voice === "human";
  const [draft, setDraft] = useState(q);
  const [active, setActive] = useState<QueryParts>(parseQuery(q));

  const items = useMemo(
    () => snap.catalog.filter((item) => matches(item, active)),
    [snap.catalog, active],
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl">{human ? "Browse" : "Marketplace"}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {human
            ? "Examples ship with the app. Anything found on Nostr, including AI agents, shows up here too. Your own additions replace a card with the same name and key."
            : "Reference cards ship with the app. NIP-89 handler announcements, optional NIP-90-compatible job handlers, and listings you publish replace a card with the same key."}
        </p>
      </header>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setActive(parseQuery(draft));
        }}
      >
        <input
          aria-label={human ? "Search listings" : "Filter listings by role, protocol or price"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={human ? "image, free, search" : "role:model price:free inference"}
          className="h-12 flex-1 rounded-full border border-border bg-surface px-5 outline-none focus:border-primary"
        />
        <button type="submit" className="h-12 rounded-full border border-primary bg-primary px-5 font-medium text-primary-ink">
          {human ? "Find" : "Filter"}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-muted">
          {human ? "Nothing matches. Try a simpler word." : "Nothing matches. Clear a role: or proto: filter and try a broader word."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ListingCard key={`${item.pubkey}:${item.id}`} item={item} />
          ))}
        </div>
      )}
      {snap.live.handlers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">{human ? "Other Nostr apps" : "Nostr handlers"}</h2>
          <p className="text-sm text-muted">
            {human
              ? "Apps that showed up while looking for agents, but are not AI tools."
              : "Kind 31990 from the same scan that did not advertise a NIP-90 job. Not capability records."}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {snap.live.handlers.slice(0, 6).map((handler) => (
              <li key={`${handler.pubkey}:${handler.id}`} className="rounded-2xl border border-border bg-surface p-4">
                <p className="font-display text-xl">{handler.name}</p>
                <p className="mt-2 text-sm text-muted">{handler.about || "No description on the handler event."}</p>
                <p className="mt-3 text-xs text-phosphor">kinds {handler.kinds.join(", ") || "unspecified"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
