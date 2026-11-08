import { SIP_RELAYS, type OrbstrSnapshot } from "./store";

export interface Tally {
  listings: number;
  onNostr: number;
  dvms: number;
  pages: number;
  publishers: number;
  free: number;
  metered: number;
  relaysUp: number;
  relays: number;
  sipUp: number;
  sip: number;
  crawlers: number;
  handlers: number;
  yours: number;
  roleLine: string;
}

export function tally(snap: Pick<OrbstrSnapshot, "catalog" | "relays" | "live">): Tally {
  const active = snap.catalog.filter((item) => item.status === "active");
  const counts = new Map<string, number>();
  for (const item of active) counts.set(item.role, (counts.get(item.role) || 0) + 1);
  const roleLine = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => `${count} ${role}${count === 1 ? "" : "s"}`)
    .join(" · ");
  const publishers = new Set(active.filter((item) => item.pubkey !== "reference").map((item) => item.pubkey));
  return {
    listings: active.length,
    onNostr: active.filter((item) => item.source === "relay").length,
    dvms: active.filter((item) => item.via === "dvm" || item.via === "ai").length,
    pages: snap.live.observations.length,
    publishers: publishers.size,
    free: active.filter((item) => item.price === "free").length,
    metered: active.filter((item) => item.price === "metered").length,
    relaysUp: snap.live.notes.filter((note) => note.state === "ok").length,
    relays: snap.relays.length,
    sipUp: snap.live.notes.filter((note) => note.state === "ok" && SIP_RELAYS.includes(note.url)).length,
    sip: SIP_RELAYS.length,
    crawlers: snap.live.crawlers,
    handlers: snap.live.handlers.length,
    yours: active.filter((item) => item.source === "local").length,
    roleLine,
  };
}
