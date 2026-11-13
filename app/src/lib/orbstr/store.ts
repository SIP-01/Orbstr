import { useSyncExternalStore } from "react";
import { REFERENCE_CATALOG } from "./catalog";
import { listingKey, type Capability } from "./protocol";

const STORAGE_KEY = "orbstr.v2";

/**
 * Same pool Indexstr publishes to. SIP-01 index relays stay first and cannot
 * be removed. Directory relays are where NIP-89 / NIP-90 agent announcements live.
 * Source: SIP-01/indexstr relay pool (clearnet only; the Tor twin is skipped).
 */
export const SIP_RELAYS = [
  "wss://relay-na1.metanomalist.com",
  "wss://test-sip-relay.sip-01test.workers.dev",
  "wss://sip-relay-2.sip-booster-relay.workers.dev",
  "wss://sip-relay-3.uncaged-sip.workers.dev",
  "wss://sip-relay-4.sip-relay-4.workers.dev",
];

export const DIRECTORY_RELAYS = [
  "wss://relay.nostr.band",
  "wss://relay.ditto.pub",
  "wss://relay.noswhere.com",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://jskitty.cat/nostr",
  "wss://nostr.hifish.org",
];

/** Read-only in the Indexstr pool. Queried, never published to. */
export const READ_ONLY_RELAYS = ["wss://search.nos.today"];

export const DEFAULT_RELAYS = [...SIP_RELAYS, ...DIRECTORY_RELAYS, ...READ_ONLY_RELAYS];

export function writableRelays(relays: string[]): string[] {
  return relays.filter((url) => !READ_ONLY_RELAYS.includes(url));
}

export function relayLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^wss:\/\//, "");
  }
}

export function isSipRelay(url: string): boolean {
  return SIP_RELAYS.includes(url);
}

export type Voice = "agent" | "human";
export type Signer = "nsec" | "nip07" | "bunker";

/** One saved Nostr login. Same shape Dsearch stores (nsec, bunker, extension). */
export interface SavedLogin {
  id: string;
  type: string;
  pubkey: string;
  createdAt: string;
  data: unknown;
}

interface Persisted {
  relays: string[];
  secretHex: string | null;
  pubkey: string | null;
  npub: string | null;
  signer: Signer | null;
  voice: Voice;
  local: Capability[];
  logins: SavedLogin[];
}

export interface HandlerHit {
  pubkey: string;
  id: string;
  name: string;
  about: string;
  kinds: string[];
  web?: string;
}

export interface ObservationHit {
  pubkey: string;
  d: string;
  title: string;
  url: string;
  summary: string;
}

export interface RelayNote {
  url: string;
  state: "idle" | "ok" | "fail";
  detail: string;
}

interface Live {
  capabilities: Capability[];
  handlers: HandlerHit[];
  observations: ObservationHit[];
  notes: RelayNote[];
  scanning: boolean;
  scannedAt: number | null;
  crawlers: number;
}

const serverPersisted: Persisted = {
  relays: DEFAULT_RELAYS,
  secretHex: null,
  pubkey: null,
  npub: null,
  signer: null,
  voice: "agent",
  local: [],
  logins: [],
};

let persisted: Persisted = serverPersisted;
let live: Live = { capabilities: [], handlers: [], observations: [], notes: [], scanning: false, scannedAt: null, crawlers: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function withStandard(relays: string[]): string[] {
  const extras = relays.filter((relay) => !DEFAULT_RELAYS.includes(relay) && relay.startsWith("wss://"));
  return [...DEFAULT_RELAYS, ...extras];
}

function signerFor(type: string): Signer | null {
  if (type === "nsec") return "nsec";
  if (type === "extension") return "nip07";
  if (type === "bunker") return "bunker";
  return null;
}

function storageSafeState(state: Persisted): Persisted {
  // Signer credentials are session-only. Never serialize NSEC, NIP-46 client
  // secrets, or a restorable authenticated session into browser storage.
  return {
    ...state,
    secretHex: null,
    pubkey: null,
    npub: null,
    signer: null,
    logins: [],
  };
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      persisted = { ...serverPersisted };
      return;
    }
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    persisted = {
      relays: Array.isArray(parsed.relays) && parsed.relays.length > 0 ? withStandard(parsed.relays) : DEFAULT_RELAYS,
      // Older versions persisted credentials. Discard them on hydration and
      // require the user to authenticate again with their chosen signer.
      secretHex: null,
      pubkey: null,
      npub: null,
      signer: null,
      voice: parsed.voice === "human" ? "human" : "agent",
      local: Array.isArray(parsed.local) ? parsed.local : [],
      logins: [],
    };
    // Rewrite legacy storage immediately so secrets are not left at rest.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageSafeState(persisted)));
  } catch {
    persisted = { ...serverPersisted };
  }
}
function persist() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storageSafeState(persisted)));
  }
  rebuild();
  emit();
}

let hydrated = false;
export function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  load();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface OrbstrSnapshot {
  relays: string[];
  pubkey: string | null;
  npub: string | null;
  signer: Signer | null;
  voice: Voice;
  hasKey: boolean;
  local: Capability[];
  live: Live;
  catalog: Capability[];
  logins: SavedLogin[];
}

function catalogFrom(state: Persisted, network: Live): Capability[] {
  const map = new Map<string, Capability>();
  for (const item of REFERENCE_CATALOG) map.set(listingKey(item), item);
  for (const item of network.capabilities) map.set(listingKey(item), item);
  for (const item of state.local) map.set(listingKey(item), item);
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}

let clientSnapshot: OrbstrSnapshot = {
  relays: DEFAULT_RELAYS,
  pubkey: null,
  npub: null,
  signer: null,
  voice: "agent",
  hasKey: false,
  local: [],
  live,
  catalog: REFERENCE_CATALOG,
  logins: [],
};

function rebuild() {
  clientSnapshot = {
    relays: persisted.relays,
    pubkey: persisted.pubkey,
    npub: persisted.npub,
    signer: persisted.signer,
    voice: persisted.voice,
    hasKey: Boolean(persisted.pubkey && persisted.signer),
    local: persisted.local,
    live,
    catalog: catalogFrom(persisted, live),
    logins: persisted.logins,
  };
}

const SERVER_SNAPSHOT: OrbstrSnapshot = {
  relays: DEFAULT_RELAYS,
  pubkey: null,
  npub: null,
  signer: null,
  voice: "agent",
  hasKey: false,
  local: [],
  live: { capabilities: [], handlers: [], observations: [], notes: [], scanning: false, scannedAt: null, crawlers: 0 },
  catalog: REFERENCE_CATALOG,
  logins: [],
};

function getServerSnapshot(): OrbstrSnapshot {
  return SERVER_SNAPSHOT;
}

function getClientSnapshot(): OrbstrSnapshot {
  return clientSnapshot;
}

export function useOrbstr(): OrbstrSnapshot {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function getSecretHex(): string | null {
  return persisted.signer === "nsec" && persisted.logins.length === 0 ? persisted.secretHex : persisted.secretHex;
}

export function getActiveLogin(): SavedLogin | null {
  return persisted.logins[0] ?? null;
}

export function listLogins(): SavedLogin[] {
  return persisted.logins;
}

export function getSigner(): Signer | null {
  return persisted.signer;
}

export function rememberLogin(login: SavedLogin, npub: string) {
  const method = signerFor(login.type);
  if (!method) return;
  const logins = [login, ...persisted.logins.filter((entry) => entry.pubkey !== login.pubkey && entry.id !== login.id)];
  persisted = {
    ...persisted,
    logins,
    secretHex: null,
    pubkey: login.pubkey,
    npub,
    signer: method,
  };
  persist();
}

export function focusLogin(login: SavedLogin, npub: string) {
  rememberLogin(login, npub);
}

export function setVoice(voice: Voice) {
  persisted = { ...persisted, voice };
  persist();
}

export function logout() {
  const rest = persisted.logins.slice(1);
  const next = rest[0];
  persisted = {
    ...persisted,
    logins: rest,
    secretHex: null,
    pubkey: next?.pubkey ?? null,
    npub: null,
    signer: next ? signerFor(next.type) : null,
  };
  persist();
}

export function setRelays(relays: string[]) {
  const clean = relays.map((relay) => relay.trim()).filter((relay) => relay.startsWith("wss://"));
  persisted = { ...persisted, relays: withStandard(clean) };
  persist();
}

export function upsertLocal(item: Capability) {
  const key = listingKey(item);
  const local = persisted.local.filter((entry) => listingKey(entry) !== key);
  persisted = { ...persisted, local: [item, ...local] };
  persist();
}

export function setLive(next: Live) {
  live = next;
  rebuild();
  emit();
}

export function currentRelays(): string[] {
  return persisted.relays;
}

if (typeof window !== "undefined") {
  load();
  hydrated = true;
}

rebuild();
