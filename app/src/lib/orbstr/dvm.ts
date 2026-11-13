import { getEventHash, verifyEvent } from "nostr-tools/pure";
import { slugify, type Capability } from "./protocol.ts";

/**
 * Job request kinds a NIP-90 provider puts on its NIP-89 handler (kind 31990).
 * Names follow nostr-protocol/data-vending-machines. Kind 31990 is the announcement.
 * There is no separate announcement kind.
 */
export const DVM_JOBS: Record<string, string> = {
  "5000": "extract",
  "5001": "summarize",
  "5002": "translate",
  "5050": "write",
  "5100": "image",
  "5200": "video",
  "5201": "video-translate",
  "5202": "image-to-video",
  "5250": "speech",
  "5300": "discover",
  "5301": "people",
  "5302": "search",
  "5303": "profiles",
  "5400": "count",
  "5500": "scan",
  "5900": "timestamp",
  "5901": "op-return",
  "5905": "schedule",
  "5970": "pow",
};

export const DVM_KIND_LIST = Object.keys(DVM_JOBS);

const HEX64 = /^[0-9a-f]{64}$/;
const AI_RE = /\b(dvm|dvms|llm|gpt|chatgpt|claude|openai|anthropic|chatbot|text generation|image generation|ai agent)\b|\bai\b/i;

export interface AnnouncementEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
  id?: string;
  sig?: string;
}


/**
 * Verify an event received from a relay before using its claims.
 * Also honour NIP-40 expiry locally: not every relay filters expired events.
 * This is a client-side safety gate, not a substitute for relay validation.
 */
export function isVerifiedAndUnexpiredNostrEvent(
  event: AnnouncementEvent,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!event.id || !event.sig || !HEX64.test(event.pubkey)) return false;
  if (!Number.isSafeInteger(event.created_at) || event.created_at < 0) return false;
  const expirationTags = event.tags.filter((tag) => tag[0] === "expiration");
  if (expirationTags.some((tag) =>
    typeof tag[1] !== "string" || tag[1].length === 0 ||
    Array.from(tag[1]).some((char) => char < "0" || char > "9"),
  )) return false;
  if (expirationTags.length > 0) {
    const expirations = expirationTags.map((tag) => Number(tag[1]));
    if (expirations.some((value) => !Number.isSafeInteger(value) || value < 0)) return false;
    if (Math.min(...expirations) <= nowSeconds) return false;
  }
  try {
    if (getEventHash(event as Parameters<typeof getEventHash>[0]) !== event.id) return false;
    return verifyEvent(event as Parameters<typeof verifyEvent>[0]);
  } catch {
    return false;
  }
}

export function jobKinds(tags: string[][]): string[] {
  const found: string[] = [];
  for (const tag of tags) {
    if (tag[0] !== "k" || !tag[1]) continue;
    const kind = tag[1].trim();
    const n = Number(kind);
    if (!Number.isInteger(n) || n < 5000 || n >= 6000) continue;
    if (!found.includes(kind)) found.push(kind);
  }
  return found;
}

function profile(content: string): { name: string; about: string } {
  try {
    const parsed = JSON.parse(content) as { name?: string; display_name?: string; about?: string; description?: string };
    const name = (parsed.display_name || parsed.name || "").trim();
    const about = (parsed.about || parsed.description || "").trim();
    return { name, about };
  } catch {
    return { name: "", about: content.trim() };
  }
}

function httpsTag(tags: string[][], name: string): string | undefined {
  const value = tags.find((tag) => tag[0] === name && tag[1])?.[1];
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "wss:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

/** A NIP-90 provider (kind 31990 with job kinds) or a handler whose text is clearly an AI tool. */
export function parseAnnouncedAgent(event: AnnouncementEvent): Capability | null {
  if (event.kind !== 31990) return null;
  if (!HEX64.test(event.pubkey)) return null;
  const jobs = jobKinds(event.tags);
  const { name: rawName, about } = profile(event.content);
  const isDvm = jobs.length > 0;
  if (!isDvm && !AI_RE.test(`${rawName} ${about}`)) return null;

  const name = (rawName || (isDvm ? "Nostr DVM" : "Nostr AI tool")).slice(0, 80);
  const words = jobs.map((kind) => DVM_JOBS[kind] || `job-${kind}`);
  const dTag = event.tags.find((tag) => tag[0] === "d" && tag[1])?.[1];
  const slug = dTag ? slugify(dTag) : slugify(`${name}-${jobs[0] || "ai"}`);
  const summarySource = about || (jobs.length > 0
    ? `Nostr data-vending agent. Takes job kind ${jobs.join(", ")}.`
    : "AI tool announced on Nostr.");
  const homepage = httpsTag(event.tags, "web") || httpsTag(event.tags, "r");

  return {
    id: slug,
    name,
    summary: summarySource.replace(/\s+/g, " ").slice(0, 240),
    about: about.slice(0, 2000),
    role: "agent",
    protocols: ["nostr"],
    capabilities: ["dvm", "nip-90", ...words].filter((item, index, all) => all.indexOf(item) === index).slice(0, 12),
    homepage,
    price: isDvm ? "metered" : "private",
    priceNote: isDvm
      ? "Priced per job by the provider (NIP-90). ORBSTR does not pay or call it."
      : "Listed from a Nostr announcement. ORBSTR does not call it.",
    status: "active",
    pubkey: event.pubkey,
    createdAt: event.created_at,
    source: "relay",
    via: isDvm ? "dvm" : "ai",
    jobs,
  };
}
