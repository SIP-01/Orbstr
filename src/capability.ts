/**
 * ORBSTR capability announcements.
 *
 * Kind 39698 is a SIP-01 companion, not a change to kind 39697.
 * Checked unused on 2026-11-07 against nostr-protocol/nips README and
 * nostr-protocol/registry-of-kinds schema.yaml (39xxx already taken there:
 * 39000–39005, 39067, 39089, 39092, 39701). 39697 remains Web Index Observations.
 *
 * Reused, not reinvented: NIP-01 addressable events, `d` / `t` / `a` / `p`,
 * NIP-31 `alt`, NIP-40 `expiration`, NIP-19 for display. NIP-89 kind 31990
 * stays the handler directory. NIP-82 kind 32267 stays software packages.
 * NIP-90 stays job transport. NIP-99 stays classifieds.
 */

export const CAPABILITY_KIND = 39698;
export const WEB_INDEX_KIND = 39697;
export const HANDLER_KIND = 31990;
export const CAPABILITY_SCHEMA = "1";

export const ROLES = ["agent", "tool", "model", "api", "compute", "dataset", "gateway"] as const;
export const PROTOS = ["mcp", "http", "contextvm", "nostr", "a2a"] as const;
export const PRICES = ["free", "freemium", "metered", "subscription", "prepaid", "private"] as const;

export type Role = (typeof ROLES)[number];
export type Proto = (typeof PROTOS)[number];
export type Price = (typeof PRICES)[number];
export type ListingSource = "reference" | "local" | "relay";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TOPIC_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;
const HEX64 = /^[0-9a-f]{64}$/;

export interface CapabilityInput {
  id: string;
  name: string;
  summary: string;
  about?: string;
  role: Role;
  protocols: Proto[];
  capabilities: string[];
  endpoint?: string;
  homepage?: string;
  price: Price;
  priceNote?: string;
  nip89?: string;
  expiration?: number;
}

export interface Capability {
  id: string;
  name: string;
  summary: string;
  about: string;
  role: Role;
  protocols: Proto[];
  capabilities: string[];
  endpoint?: string;
  homepage?: string;
  price: Price;
  priceNote?: string;
  nip89?: string;
  expiration?: number;
  status: "active" | "withdrawn";
  pubkey: string;
  createdAt: number;
  source: ListingSource;
  relay?: string;
  raw?: UnsignedEvent;
}

export interface UnsignedEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey?: string;
}

export interface QueryParts {
  text: string;
  role?: Role;
  proto?: Proto;
  price?: Price;
  /** Required capability tags. Every requested tag must be present. */
  capabilities?: string[];
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
export function isProto(value: string): value is Proto {
  return (PROTOS as readonly string[]).includes(value);
}
export function isPrice(value: string): value is Price {
  return (PRICES as readonly string[]).includes(value);
}

export function parseQuery(input: string): QueryParts {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const free: string[] = [];
  const capabilities: string[] = [];
  let role: Role | undefined;
  let proto: Proto | undefined;
  let price: Price | undefined;
  for (const part of parts) {
    const separator = part.indexOf(":");
    if (separator < 1) {
      free.push(part);
      continue;
    }
    const key = part.slice(0, separator).toLowerCase();
    const value = part.slice(separator + 1).toLowerCase();
    if (key === "role" && isRole(value)) role = value;
    else if (key === "proto" && isProto(value)) proto = value;
    else if (key === "price" && isPrice(value)) price = value;
    else if ((key === "cap" || key === "capability") && TOPIC_RE.test(value)) {
      if (!capabilities.includes(value)) capabilities.push(value);
    } else free.push(part);
  }
  return { text: free.join(" "), role, proto, price, capabilities };
}

function forbiddenIpv4Literal(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2) || (b === 88 && c === 99))) return true;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

export function endpointAllowed(value: string, allowLocal = false): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "local:") {
      return allowLocal && Boolean(url.hostname) && !url.search && !url.hash;
    }
    if (url.protocol !== "https:" && url.protocol !== "wss:") return false;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || hostname === "localhost" ||
        hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
        hostname.endsWith(".lan") || hostname.endsWith(".internal") ||
        hostname.endsWith(".home.arpa") || hostname.endsWith(".test") ||
        hostname === "metadata.google.internal" || hostname === "metadata") return false;
    // A trusted egress gateway must validate the actual destination IP.
    if (hostname.startsWith("[") || hostname.includes(":") || forbiddenIpv4Literal(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function homepageAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && endpointAllowed(value);
  } catch {
    return false;
  }
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return ID_RE.test(slug) ? slug : "service";
}

function topics(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const topic = value.toLowerCase().trim().replace(/\s+/g, "-");
    if (TOPIC_RE.test(topic) && !out.includes(topic)) out.push(topic);
  }
  return out.slice(0, 12);
}

export function buildCapabilityEvent(input: CapabilityInput, now = Math.floor(Date.now() / 1000)): UnsignedEvent | null {
  const id = input.id.trim().toLowerCase();
  const name = input.name.trim().slice(0, 80);
  const summary = input.summary.trim().slice(0, 240);
  if (!ID_RE.test(id) || !name || !summary) return null;
  if (!isRole(input.role) || !isPrice(input.price)) return null;
  const protocols = [...new Set(input.protocols.filter(isProto))];
  if (protocols.length === 0) return null;
  if (input.endpoint && !endpointAllowed(input.endpoint)) return null;
  if (input.homepage && !homepageAllowed(input.homepage)) return null;
  if (input.nip89 && !/^31990:[0-9a-f]{64}:[a-zA-Z0-9_-]+$/.test(input.nip89)) return null;
  if (input.expiration !== undefined &&
      (!Number.isSafeInteger(input.expiration) || input.expiration <= now)) return null;

  const content: Record<string, string> = { name, summary };
  if (input.about?.trim()) content.about = input.about.trim().slice(0, 2000);
  if (input.priceNote?.trim()) content.priceNote = input.priceNote.trim().slice(0, 240);

  const tags: string[][] = [
    ["d", id],
    ["v", CAPABILITY_SCHEMA],
    ["role", input.role],
    ...protocols.map((proto) => ["proto", proto]),
    ["price", input.price],
    ...topics(input.capabilities).map((topic) => ["t", topic]),
  ];
  if (input.endpoint) tags.push(["endpoint", input.endpoint]);
  if (input.homepage) tags.push(["r", input.homepage]);
  if (input.nip89) tags.push(["a", input.nip89]);
  if (input.expiration !== undefined) tags.push(["expiration", String(input.expiration)]);
  tags.push(["alt", `Capability: ${name}`]);

  return { kind: CAPABILITY_KIND, created_at: now, content: JSON.stringify(content), tags };
}

export function withdrawnEvent(id: string, now = Math.floor(Date.now() / 1000)): UnsignedEvent | null {
  const normalizedId = id.trim().toLowerCase();
  if (!ID_RE.test(normalizedId) || !Number.isSafeInteger(now) || now < 0) return null;
  return {
    kind: CAPABILITY_KIND,
    created_at: now,
    content: JSON.stringify({ name: normalizedId, summary: "Withdrawn" }),
    tags: [
      ["d", normalizedId],
      ["v", CAPABILITY_SCHEMA],
      ["status", "withdrawn"],
      ["alt", `Capability withdrawn: ${id}`],
    ],
  };
}

function tagEntries(tags: string[][], name: string): string[][] {
  return tags.filter((tag) => Array.isArray(tag) && tag[0] === name);
}

function tagValues(tags: string[][], name: string): string[] {
  return tagEntries(tags, name)
    .map((tag) => tag[1])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function oneTag(tags: string[][], name: string): string | null {
  const entries = tagEntries(tags, name);
  if (entries.length !== 1 || typeof entries[0][1] !== "string" || !entries[0][1]) return null;
  return entries[0][1];
}

function optionalOneTag(tags: string[][], name: string): string | undefined | null {
  const entries = tagEntries(tags, name);
  if (entries.length > 1) return null;
  if (entries.length === 0) return undefined;
  if (typeof entries[0][1] !== "string" || !entries[0][1]) return null;
  return entries[0][1];
}

export function parseCapabilityEvent(
  event: {
    kind: number;
    content: string;
    tags: string[][];
    created_at: number;
    pubkey: string;
  },
  source: ListingSource,
  relay?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Capability | null {
  if (event.kind !== CAPABILITY_KIND || !HEX64.test(event.pubkey)) return null;
  if (!Number.isSafeInteger(event.created_at) || event.created_at < 0 ||
      !Number.isSafeInteger(nowSeconds) || nowSeconds < 0) return null;
  const id = oneTag(event.tags, "d");
  const version = oneTag(event.tags, "v");
  const alt = oneTag(event.tags, "alt");
  if (!id || !ID_RE.test(id) || version !== CAPABILITY_SCHEMA || !alt) return null;

  const status = optionalOneTag(event.tags, "status");
  if (status === null || (status !== undefined && status !== "withdrawn")) return null;
  if (status === "withdrawn") {
    if (tagEntries(event.tags, "role").length || tagEntries(event.tags, "proto").length ||
        tagEntries(event.tags, "price").length) return null;
    return {
      id, name: id, summary: "Withdrawn by the publisher.", about: "",
      role: "tool", protocols: ["nostr"], capabilities: [], price: "free",
      status: "withdrawn", pubkey: event.pubkey, createdAt: event.created_at, source, relay,
    };
  }

  const expirationTag = optionalOneTag(event.tags, "expiration");
  if (expirationTag === null) return null;
  let expiration: number | undefined;
  if (expirationTag !== undefined) {
    if (!/^\d+$/.test(expirationTag)) return null;
    expiration = Number(expirationTag);
    if (!Number.isSafeInteger(expiration) || expiration <= nowSeconds) return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(event.content) as Record<string, unknown>;
  } catch {
    return null;
  }
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const role = oneTag(event.tags, "role") ?? "";
  const price = oneTag(event.tags, "price") ?? "";
  const protoEntries = tagEntries(event.tags, "proto");
  if (!name || !summary || name.length > 80 || summary.length > 240 ||
      !isRole(role) || !isPrice(price) || protoEntries.length === 0 ||
      protoEntries.some((tag) => typeof tag[1] !== "string" || !tag[1])) return null;
  const protocols = [...new Set(tagValues(event.tags, "proto").filter(isProto))];
  if (protocols.length === 0) return null;

  const endpoint = optionalOneTag(event.tags, "endpoint");
  const homepage = optionalOneTag(event.tags, "r");
  if (endpoint === null || homepage === null) return null;
  if (endpoint && !endpointAllowed(endpoint)) return null;
  if (homepage && !homepageAllowed(homepage)) return null;
  const nip89 = tagValues(event.tags, "a").find((value) =>
    /^31990:[0-9a-f]{64}:[a-zA-Z0-9_-]+$/.test(value),
  );

  return {
    id, name, summary,
    about: typeof parsed.about === "string" ? parsed.about.slice(0, 2000) : "",
    role, protocols,
    capabilities: [...new Set(tagValues(event.tags, "t").filter((topic) => TOPIC_RE.test(topic)))].slice(0, 12),
    endpoint, homepage, price,
    priceNote: typeof parsed.priceNote === "string" ? parsed.priceNote.slice(0, 240) : undefined,
    nip89, expiration, status: "active", pubkey: event.pubkey, createdAt: event.created_at, source, relay,
  };
}

export function listingKey(item: Pick<Capability, "pubkey" | "id">): string {
  return item.pubkey + ":" + item.id;
}

export function matches(item: Capability, query: QueryParts, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (item.status !== "active") return false;
  if (item.expiration !== undefined && item.expiration <= nowSeconds) return false;
  if (query.role && item.role !== query.role) return false;
  if (query.proto && !item.protocols.includes(query.proto)) return false;
  if (query.price && item.price !== query.price) return false;
  if (query.capabilities?.some((capability) => !item.capabilities.includes(capability))) return false;
  if (!query.text) return true;
  const hay = [item.name, item.summary, item.about, item.role, ...item.protocols, ...item.capabilities]
    .join(" ")
    .toLowerCase();
  return query.text.toLowerCase().split(/\s+/).every((word) => hay.includes(word));
}

/** Standard NIP-01 `a` coordinates pointing at capability announcements. */
export function capabilityPointers(tags: string[][]): string[] {
  return tags
    .filter((tag) => tag[0] === "a" && tag[1]?.startsWith(`${CAPABILITY_KIND}:`))
    .map((tag) => tag[1]);
}
