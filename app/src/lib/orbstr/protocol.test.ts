import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilityEvent, matches, parseCapabilityEvent, parseQuery } from "./protocol.ts";

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

import { endpointAllowed } from "./protocol.ts";

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
  assert.equal(endpointAllowed("https://[::1]"), false);
  assert.equal(endpointAllowed("http://example.com"), false);
});

test("local built-in endpoints require an explicit local allow flag", () => {
  assert.equal(endpointAllowed("local://echo"), false);
  assert.equal(endpointAllowed("local://echo", true), true);
  assert.equal(endpointAllowed("local://echo?url=https://example.com", true), false);
});
