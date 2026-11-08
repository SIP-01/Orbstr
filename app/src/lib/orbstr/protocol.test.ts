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
