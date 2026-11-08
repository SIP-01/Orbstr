import { buildCapabilityEvent, parseCapabilityEvent, WEB_INDEX_KIND, HANDLER_KIND, CAPABILITY_KIND, type CapabilityInput } from "./protocol";
import { parseAnnouncedAgent, DVM_KIND_LIST, jobKinds } from "./dvm";
import { currentRelays, DIRECTORY_RELAYS, setLive, upsertLocal, writableRelays, type HandlerHit, type ObservationHit, type RelayNote } from "./store";

export interface SignedEvent {
  id: string;
  sig: string;
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
}

export interface DraftEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

type EventSigner = (draft: DraftEvent) => Promise<SignedEvent>;

let eventSigner: EventSigner | null = null;

export function setEventSigner(signer: EventSigner | null) {
  eventSigner = signer;
}

async function poolLib() {
  const { SimplePool } = await import("nostr-tools/pool");
  return SimplePool;
}

async function publishEvent(event: DraftEvent) {
  const signer = eventSigner;
  if (!signer) throw new Error("Log in with Nostr before publishing.");
  const relays = writableRelays(currentRelays());
  const SimplePool = await poolLib();
  const signed = await signer(event);
  const pool = new SimplePool();
  const notes: RelayNote[] = [];
  await Promise.all(
    relays.map(async (url) => {
      try {
        await Promise.race([
          Promise.any(pool.publish([url], signed)),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 7000)),
        ]);
        notes.push({ url, state: "ok", detail: "accepted" });
      } catch (error) {
        notes.push({ url, state: "fail", detail: error instanceof Error ? error.message : "rejected" });
      }
    }),
  );
  pool.destroy();
  return { signed, pubkey: signed.pubkey, notes };
}

export async function publishCapability(input: CapabilityInput) {
  if (!eventSigner) return { error: "Log in with Nostr first. Publishing does not create a new key.", notes: [] as RelayNote[], pubkey: "" };
  const draft = buildCapabilityEvent(input);
  if (!draft) return { error: "Check the id, name, summary, role, and endpoint." as string, notes: [] as RelayNote[], pubkey: "" };
  try {
    const { signed, pubkey, notes } = await publishEvent(draft);
    const parsed = parseCapabilityEvent(signed, "local");
    if (parsed) upsertLocal({ ...parsed, pubkey, source: "local" });
    return { error: null as string | null, notes, pubkey, id: input.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign.", notes: [] as RelayNote[], pubkey: "" };
  }
}

const SEARCH_RELAYS = new Set(["wss://relay.nostr.band", "wss://relay.ditto.pub", "wss://relay.noswhere.com"]);

let inflight: Promise<{ capabilities: number; handlers: number; observations: number }> | null = null;

export function scanRelays() {
  if (inflight) return inflight;
  inflight = runScan().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runScan() {
  const relays = currentRelays();
  setLive({ capabilities: [], handlers: [], observations: [], notes: [], scanning: true, scannedAt: null, crawlers: 0 });
  const SimplePool = await poolLib();
  const pool = new SimplePool();
  try {
    const settled = await Promise.all(
      relays.map(async (url) => {
        try {
          await pool.ensureRelay(url, { connectionTimeout: 5000 });
        } catch (error) {
          const detail = error instanceof Error ? error.message : "unreachable";
          return { note: { url, state: "fail" as const, detail }, events: [] };
        }
        const filters: Array<{ kinds: number[]; limit: number; search?: string; "#k"?: string[] }> = [
          { kinds: [CAPABILITY_KIND], limit: 40 },
          { kinds: [WEB_INDEX_KIND], limit: 12 },
          { kinds: [16919], limit: 12 },
        ];
        if (DIRECTORY_RELAYS.includes(url)) {
          filters.push({ kinds: [HANDLER_KIND], "#k": DVM_KIND_LIST, limit: 40 });
        }
        if (SEARCH_RELAYS.has(url)) {
          filters.push({ kinds: [HANDLER_KIND], search: "DVM", limit: 20 });
        }
        const events: Array<{ id?: string; kind: number; content: string; tags: string[][]; created_at: number; pubkey: string }> = [];
        let failed = 0;
        await Promise.all(
          filters.map(async (filter) => {
            try {
              const batch = await pool.querySync([url], filter, { maxWait: 6000 });
              events.push(...batch);
            } catch {
              failed += 1;
            }
          }),
        );
        const note: RelayNote =
          failed === filters.length
            ? { url, state: "fail", detail: "no reply" }
            : { url, state: "ok", detail: events.length > 0 ? `${events.length} events` : "connected" };
        return { note, events };
      }),
    );

    const seen = new Set<string>();
    const capabilities = [];
    const handlers: HandlerHit[] = [];
    const observations: ObservationHit[] = [];
    const crawlerKeys = new Set<string>();

    for (const { events } of settled) {
      for (const event of events) {
        const dedupe = event.id || `${event.pubkey}:${event.kind}:${event.created_at}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        if (event.kind === CAPABILITY_KIND) {
          const parsed = parseCapabilityEvent(event, "relay");
          if (parsed) capabilities.push(parsed);
          continue;
        }
        if (event.kind === 16919 && /^[0-9a-f]{64}$/.test(event.pubkey)) {
          crawlerKeys.add(event.pubkey);
          continue;
        }
        if (event.kind === HANDLER_KIND) {
          const agent = parseAnnouncedAgent(event);
          if (agent) {
            capabilities.push(agent);
            continue;
          }
          if (event.kind !== HANDLER_KIND || jobKinds(event.tags).length > 0) continue;
          let name = "Nostr app";
          let about = "";
          try {
            const content = JSON.parse(event.content) as { name?: string; display_name?: string; about?: string };
            name = content.display_name || content.name || name;
            about = content.about || "";
          } catch {
            about = event.content.slice(0, 180);
          }
          handlers.push({
            pubkey: event.pubkey,
            id: event.tags.find((tag) => tag[0] === "d")?.[1] || event.pubkey.slice(0, 8),
            name,
            about: about.slice(0, 220),
            kinds: event.tags.filter((tag) => tag[0] === "k").map((tag) => tag[1]),
            web: event.tags.find((tag) => tag[0] === "web")?.[1],
          });
          continue;
        }
        if (event.kind === WEB_INDEX_KIND) {
          let title = "";
          let summary = "";
          try {
            const content = JSON.parse(event.content) as { title?: string; description?: string };
            title = content.title || "";
            summary = content.description || "";
          } catch {
            continue;
          }
          const pageUrl = event.tags.find((tag) => tag[0] === "u")?.[1];
          const d = event.tags.find((tag) => tag[0] === "d")?.[1];
          if (title && pageUrl && d) {
            observations.push({ pubkey: event.pubkey, d, title, url: pageUrl, summary: summary.slice(0, 180) });
          }
        }
      }
    }

    setLive({
      capabilities,
      handlers: handlers.slice(0, 12),
      observations: observations.slice(0, 24),
      notes: settled.map((item) => item.note),
      scanning: false,
      scannedAt: Date.now(),
      crawlers: crawlerKeys.size,
    });
    return { capabilities: capabilities.length, handlers: handlers.length, observations: observations.length };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unavailable";
    setLive({
      capabilities: [],
      handlers: [],
      observations: [],
      notes: relays.map((url) => ({ url, state: "fail", detail })),
      scanning: false,
      scannedAt: Date.now(),
      crawlers: 0,
    });
    return { capabilities: 0, handlers: 0, observations: 0 };
  } finally {
    pool.destroy();
  }
}
