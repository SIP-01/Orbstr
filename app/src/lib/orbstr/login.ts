import { NPool, NRelay1 } from "@nostrify/nostrify";
import {
  NLogin,
  NUser,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectStatus,
} from "@nostrify/react/login";
import { getActiveLogin, getSecretHex, listLogins, logout, rememberLogin, type SavedLogin } from "./store";
import { setEventSigner, type DraftEvent, type SignedEvent } from "./nostr";

/** Same handshake relays Dsearch uses for NIP-46. One relay both sides can reach. */
export const HANDSHAKE_RELAYS = ["wss://relay.nsec.app/", "wss://relay.ditto.pub/"];

let pool: NPool | null = null;

export function getPool(): NPool {
  if (!pool) {
    pool = new NPool({
      open: (url) => new NRelay1(url),
      reqRouter: (filters) => new Map(HANDSHAKE_RELAYS.map((url) => [url, filters])),
      eventRouter: () => HANDSHAKE_RELAYS,
      eoseTimeout: 4000,
    });
  }
  return pool;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function asSaved(login: { toJSON: () => SavedLogin }): SavedLogin {
  return login.toJSON();
}

export async function adoptLogin(login: { toJSON: () => SavedLogin } | SavedLogin) {
  const saved = "toJSON" in login ? asSaved(login) : login;
  const { npubEncode } = await import("nostr-tools/nip19");
  rememberLogin(saved, npubEncode(saved.pubkey));
  refreshSigner();
}

export async function signOut() {
  const queued = listLogins()[1];
  logout();
  if (queued) await adoptLogin(queued);
  else refreshSigner();
}

export async function loginWithExtension(): Promise<string | null> {
  if (typeof window === "undefined" || !("nostr" in window)) {
    return "No browser signer here. Open Amber, or paste an nsec or bunker link.";
  }
  try {
    const login = await NLogin.fromExtension();
    await adoptLogin(login);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "The browser signer declined.";
  }
}

export async function loginWithSecret(input: string): Promise<string | null> {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith("bunker://")) {
      const login = await NLogin.fromBunker(sanitizeBunkerUri(trimmed), getPool());
      await adoptLogin(login);
      return null;
    }
    if (/^nsec1[0-9a-z]+$/i.test(trimmed)) {
      const login = NLogin.fromNsec(trimmed);
      await adoptLogin(login);
      return null;
    }
    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      const { nsecEncode } = await import("nostr-tools/nip19");
      const login = NLogin.fromNsec(nsecEncode(hexToBytes(trimmed.toLowerCase())));
      await adoptLogin(login);
      return null;
    }
    return "Paste an nsec, 64 hex characters, or a bunker:// link. Nothing new is generated.";
  } catch (error) {
    return error instanceof Error ? error.message : "Could not use that key.";
  }
}

export function extensionAvailable(): boolean {
  return typeof window !== "undefined" && "nostr" in window;
}

export function startNostrConnect(
  onStatus: (status: NostrConnectStatus) => void,
  signal?: AbortSignal,
): { uri: string; done: Promise<string | null> } {
  const params = generateNostrConnectParams(HANDSHAKE_RELAYS);
  const mobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const uri = generateNostrConnectURI(params, {
    name: "ORBSTR",
    callback: mobile ? `${window.location.origin}/remoteloginsuccess` : undefined,
  });
  const done = NLogin.fromNostrConnect(params, getPool(), { signal, onStatus })
    .then(async (login) => {
      await adoptLogin(login);
      return null;
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return "Cancelled.";
      return error instanceof Error ? error.message : "The signer did not answer.";
    });
  return { uri, done };
}

function sanitizeBunkerUri(uri: string): string {
  try {
    const url = new URL(uri);
    const relays = url.searchParams.getAll("relay");
    if (relays.length === 0) return uri;
    url.searchParams.delete("relay");
    for (const relay of relays) {
      const next = new URL(relay);
      if (next.protocol === "ws:") next.protocol = "wss:";
      url.searchParams.append("relay", next.toString());
    }
    return url.toString();
  } catch {
    return uri;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function refreshSigner() {
  const login = getActiveLogin();
  if (!login) {
    setEventSigner(null);
    return;
  }
  try {
    const sign = (user: NUser) => async (draft: DraftEvent) => (await user.signer.signEvent(draft)) as SignedEvent;
    if (login.type === "nsec" && isRecord(login.data) && typeof login.data.nsec === "string") {
      setEventSigner(sign(NUser.fromNsecLogin(login as never)));
      return;
    }
    if (
      login.type === "bunker" &&
      isRecord(login.data) &&
      typeof login.data.bunkerPubkey === "string" &&
      typeof login.data.clientNsec === "string" &&
      Array.isArray(login.data.relays)
    ) {
      setEventSigner(sign(NUser.fromBunkerLogin(login as never, getPool())));
      return;
    }
    if (login.type === "extension") {
      setEventSigner(sign(NUser.fromExtensionLogin(login as never)));
      return;
    }
    setEventSigner(null);
  } catch {
    setEventSigner(null);
  }
}

export async function migrateLegacyKey() {
  const hex = getSecretHex();
  if (!hex || getActiveLogin()) return;
  const { nsecEncode } = await import("nostr-tools/nip19");
  const login = NLogin.fromNsec(nsecEncode(hexToBytes(hex)));
  await adoptLogin(login);
}
