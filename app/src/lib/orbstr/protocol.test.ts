import assert from "node:assert/strict";
import test from "node:test";
import { assertRelayAcceptance, buildCapabilityEvent, endpointAllowed, matches, parseCapabilityEvent, parseQuery } from "./protocol.ts";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
import { isVerifiedAndUnexpiredNostrEvent } from "./dvm.ts";
import { suggestCapabilities } from "./suggest.ts";
import type { Capability } from "./protocol.ts";

test("round-trips a capability without touching kind 39697", () => {
  const draft = buildCapabilityEvent({
    id: "echo-tool",
    name: "Echo",
    summary: "Returns text",
    role: "tool",
    protocols: ["mcp"],
    capabilities: ["echo", "text"],
    price: "free",
    endpoint: "https://example.com/mcp",
    homepage: "https://example.com",
  });
  assert.ok(draft);
  assert.equal(draft.kind, 39698);
  assert.equal(draft.tags.find((tag) => tag[0] === "u"), undefined);
  const parsed = parseCapabilityEvent({ ...draft, pubkey: "a".repeat(64) }, "relay");
  assert.ok(parsed);
  assert.equal(parsed?.name, "Echo");
  assert.equal(parsed?.role, "tool");
  assert.deepEqual(parseQuery("role:tool proto:mcp echo"), {
    text: "echo",
    role: "tool",
    proto: "mcp",
    price: undefined,
    capabilities: [],
  });
  assert.equal(matches(parsed!, parseQuery("role:model")), false);
  assert.equal(matches(parsed!, parseQuery("role:tool echo")), true);
});

test("rejects a bad id and a javascript endpoint", () => {
  assert.equal(
    buildCapabilityEvent({
      id: "bad id",
      name: "X",
      summary: "Y",
      role: "tool",
      protocols: ["http"],
      capabilities: [],
      price: "free",
    }),
    null,
  );
  assert.equal(
    buildCapabilityEvent({
      id: "ok",
      name: "X",
      summary: "Y",
      role: "tool",
      protocols: ["http"],
      capabilities: [],
      price: "free",
      endpoint: "javascript:alert(1)",
    }),
    null,
  );
});


test("endpoint URL gate rejects credentials, local names and private/reserved IP literals", () => {
  assert.equal(endpointAllowed("https://example.com/mcp"), true);
  assert.equal(endpointAllowed("wss://relay.example.com"), true);
  assert.equal(endpointAllowed("https://user:pass@example.com"), false);
  assert.equal(endpointAllowed("https://localhost"), false);
  assert.equal(endpointAllowed("https://service.local"), false);
  assert.equal(endpointAllowed("https://127.0.0.1"), false);
  assert.equal(endpointAllowed("https://10.2.3.4"), false);
  assert.equal(endpointAllowed("https://172.16.0.5"), false);
  assert.equal(endpointAllowed("https://192.168.1.1"), false);
  assert.equal(endpointAllowed("https://169.254.169.254"), false);
  assert.equal(endpointAllowed("https://100.64.0.10"), false);
  assert.equal(endpointAllowed("https://192.0.2.10"), false);
  assert.equal(endpointAllowed("https://198.18.0.1"), false);
  assert.equal(endpointAllowed("https://224.0.0.1"), false);
  assert.equal(endpointAllowed("https://[::1]"), false);
  assert.equal(endpointAllowed("http://example.com"), false);
});

test("local built-in endpoints require an explicit local allow flag", () => {
  assert.equal(endpointAllowed("local://echo"), false);
  assert.equal(endpointAllowed("local://echo", true), true);
  assert.equal(endpointAllowed("local://echo?url=https://example.com", true), false);
});

test("relay-discovered Nostr events require valid signatures", () => {
  const secretKey = generateSecretKey();
  const valid = finalizeEvent({
    kind: 31990,
    created_at: 1_800_000_000,
    tags: [["d", "test"], ["k", "5302"]],
    content: JSON.stringify({ name: "Search agent" }),
  }, secretKey);
  assert.equal(isVerifiedAndUnexpiredNostrEvent(valid, 1_800_000_001), true);
  assert.equal(isVerifiedAndUnexpiredNostrEvent({ ...valid, content: "tampered" }, 1_800_000_001), false);
  assert.equal(isVerifiedAndUnexpiredNostrEvent({ ...valid, sig: "0".repeat(128) }, 1_800_000_001), false);
  assert.equal(isVerifiedAndUnexpiredNostrEvent({ ...valid, id: undefined }, 1_800_000_001), false);
});

test("relay-discovered Nostr events honour NIP-40 expiry", () => {
  const secretKey = generateSecretKey();
  const make = (tags: string[][]) => finalizeEvent({
    kind: 31990,
    created_at: 100,
    tags,
    content: "{}",
  }, secretKey);
  assert.equal(isVerifiedAndUnexpiredNostrEvent(make([]), 100), true);
  assert.equal(isVerifiedAndUnexpiredNostrEvent(make([["expiration", "101"]]), 100), true);
  assert.equal(isVerifiedAndUnexpiredNostrEvent(make([["expiration", "100"]]), 100), false);
  assert.equal(isVerifiedAndUnexpiredNostrEvent(make([["expiration", "soon"]]), 100), false);
});

test("publishing requires at least one relay acceptance", () => {
  assert.doesNotThrow(() => assertRelayAcceptance([{ state: "fail" }, { state: "ok" }]));
  assert.throws(() => assertRelayAcceptance([{ state: "fail" }, { state: "fail" }]), /No relay accepted/);
  assert.throws(() => assertRelayAcceptance([]), /No relay accepted/);
});


test("capability listings honour expiry and reject ambiguous singleton tags", () => {
  const future = buildCapabilityEvent({
    id: "research-tool",
    name: "Research Tool",
    summary: "Searches and fetches public sources",
    role: "tool",
    protocols: ["mcp", "mcp"],
    capabilities: ["research", "search"],
    price: "free",
    expiration: 201,
  }, 100);
  assert.ok(future);
  assert.equal(future.tags.filter((tag) => tag[0] === "proto").length, 1);
  assert.ok(parseCapabilityEvent({ ...future, pubkey: "b".repeat(64) }, "relay", undefined, 200));
  assert.equal(parseCapabilityEvent({ ...future, pubkey: "b".repeat(64) }, "relay", undefined, 201), null);
  assert.equal(parseCapabilityEvent({ ...future, pubkey: "b".repeat(64), tags: [...future.tags, ["role", "agent"]] }, "relay", undefined, 200), null);
  assert.equal(parseCapabilityEvent({ ...future, pubkey: "b".repeat(64), tags: future.tags.map((tag) => tag[0] === "expiration" ? ["expiration", "soon"] : tag) }, "relay", undefined, 200), null);
});

test("capability queries support task specialisations without expanding role taxonomy", () => {
  const draft = buildCapabilityEvent({
    id: "research-tool",
    name: "Research Tool",
    summary: "Searches public sources and fetches evidence",
    role: "tool",
    protocols: ["mcp"],
    capabilities: ["research", "search", "fetch"],
    price: "free",
  });
  assert.ok(draft);
  const item = parseCapabilityEvent({ ...draft, pubkey: "c".repeat(64) }, "relay", undefined, 2_000_000_000);
  assert.ok(item);
  assert.deepEqual(parseQuery("role:tool cap:research cap:search proto:mcp price:free"), {
    text: "",
    role: "tool",
    proto: "mcp",
    price: "free",
    capabilities: ["research", "search"],
  });
  assert.equal(matches(item!, parseQuery("role:tool cap:research proto:mcp")), true);
  assert.equal(matches(item!, parseQuery("role:tool cap:design")), false);
  assert.equal(matches(item!, parseQuery("role:agent")), false);
});

test("suggestions honour explicit filters, rank capabilities and stay deterministic", () => {
  const make = (id: string, role: "tool" | "agent", capabilities: string[]): Capability => ({
    id, name: id, summary: "A tool for tasks", about: "", role, protocols: ["mcp"],
    capabilities, price: "free" as const, status: "active" as const,
    pubkey: id.padEnd(64, "0").slice(0, 64), createdAt: 100, source: "reference" as const,
  });
  const items = [
    make("general-tool", "tool", ["fetch"]),
    make("research-agent", "agent", ["research", "search"]),
    make("research-tool", "tool", ["research", "search"]),
  ];
  const first = suggestCapabilities("role:tool cap:research proto:mcp", items);
  const second = suggestCapabilities("role:tool cap:research proto:mcp", [...items].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => item.key), [items[2].pubkey + ":research-tool"]);
  assert.equal(suggestCapabilities("role:agent", items)[0].role, "agent");
  assert.deepEqual(suggestCapabilities("   ", items), []);
  assert.deepEqual(suggestCapabilities("role:tool", items, 0), []);
});
