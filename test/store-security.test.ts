import { test } from "node:test";
import assert from "node:assert/strict";

test("Nostr login credentials are never persisted in browser storage", async () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });

  const store = await import("../app/src/lib/orbstr/store.ts?security-test");
  const nsec = "nsec1" + "a".repeat(58);
  const clientNsec = "b".repeat(64);

  store.rememberLogin({
    id: "test-login",
    type: "nsec",
    pubkey: "c".repeat(64),
    createdAt: new Date().toISOString(),
    data: { nsec },
  }, "npub1test");

  const serialized = values.get("orbstr.v2") ?? "";
  assert.equal(serialized.includes(nsec), false, "raw nsec must not be stored");
  assert.equal(serialized.includes(clientNsec), false, "bunker client secrets must not be stored");
  const persisted = JSON.parse(serialized);
  assert.deepEqual(persisted.logins, [], "saved login credentials must not survive a reload");
  assert.equal(persisted.secretHex, null);
  assert.equal(persisted.pubkey, null);
  assert.equal(persisted.signer, null);

  const reloaded = await import("../app/src/lib/orbstr/store.ts?security-reload-test");
  assert.equal(reloaded.useOrbstr().pubkey, null, "the user must re-authenticate after reload");
  assert.equal(reloaded.useOrbstr().hasKey, false);
});
