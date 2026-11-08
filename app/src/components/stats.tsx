import { tally } from "@/lib/orbstr/stats";
import { isSipRelay, relayLabel, useOrbstr, type RelayNote } from "@/lib/orbstr/store";

export function NetworkStats() {
  const snap = useOrbstr();
  const human = snap.voice === "human";
  const stats = tally(snap);
  const tiles: Array<[string, string | number]> = [
    [human ? "Listed" : "Catalog", stats.listings],
    [human ? "From Nostr" : "Announced", stats.onNostr],
    [human ? "AI agents" : "DVMs", stats.dvms],
    [human ? "Web pages" : "SIP pages", stats.pages],
    [human ? "Publishers" : "Pubkeys", stats.publishers],
    [human ? "Free" : "Free", stats.free],
    [human ? "Priced per job" : "Metered", stats.metered],
    [human ? "Yours" : "Local", stats.yours],
    [human ? "SIP relays" : "SIP up", stats.sip === 0 ? "0" : `${stats.sipUp}/${stats.sip}`],
    [human ? "Relays up" : "Relays up", stats.relays === 0 ? "0" : `${stats.relaysUp}/${stats.relays}`],
    [human ? "Crawlers" : "Crawlers", stats.crawlers],
  ];
  const notes = snap.live.notes.length > 0 ? snap.live.notes : snap.relays.map((url) => ({ url, state: "idle" as const, detail: "" }));

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface px-3 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 font-display text-3xl leading-none">{value}</p>
          </div>
        ))}
      </div>
      {stats.roleLine && <p className="text-sm text-muted">{stats.roleLine}</p>}
      <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {notes.map((note) => (
          <RelayPill key={note.url} note={note} />
        ))}
      </div>
    </section>
  );
}

function RelayPill({ note }: { note: RelayNote }) {
  const tone =
    note.state === "ok"
      ? "border-phosphor text-phosphor"
      : note.state === "fail"
        ? "border-danger text-danger"
        : "border-border text-muted";
  return (
    <span className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs ${tone}`}>
      <span>{isSipRelay(note.url) ? "SIP" : "Relay"}</span>
      <span>{relayLabel(note.url)}</span>
    </span>
  );
}
