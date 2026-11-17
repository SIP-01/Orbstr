import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCapabilityEvent, matches, parseCapabilityEvent, parseQuery } from "../src/capability.ts";
import { suggestCapabilities } from "../src/suggest.ts";

test("capability schema remains kind 39698 and rejects expired or ambiguous listings", () => {
  const event = buildCapabilityEvent({
    id: "research-tool", name: "Research tool", summary: "Searches sources",
    role: "tool", protocols: ["mcp", "mcp"], capabilities: ["research", "search"],
    price: "free", expiration: 201,
  }, 100);
  assert.ok(event);
  assert.equal(event.kind, 39698);
  assert.equal(event.tags.filter((tag) => tag[0] === "proto").length, 1);
  const envelope = { ...event, pubkey: "a".repeat(64) };
  assert.ok(parseCapabilityEvent(envelope, "relay", undefined, 200));
  assert.equal(parseCapabilityEvent(envelope, "relay", undefined, 201), null);
  assert.equal(parseCapabilityEvent({
    ...envelope, tags: [...event.tags, ["role", "agent"]],
  }, "relay", undefined, 200), null);
});

test("role remains a provider class and cap filters target specialisations", () => {
  const event = buildCapabilityEvent({
    id: "search-tool", name: "Search tool", summary: "Search public pages",
    role: "tool", protocols: ["mcp"], capabilities: ["research", "search"],
    price: "free",
  }, 100);
  assert.ok(event);
  const item = parseCapabilityEvent({ ...event, pubkey: "b".repeat(64) }, "relay", undefined, 200);
  assert.ok(item);
  assert.deepEqual(parseQuery("role:tool cap:research cap:search proto:mcp price:free"), {
    text: "", role: "tool", proto: "mcp", price: "free", capabilities: ["research", "search"],
  });
  assert.equal(matches(item!, parseQuery("role:tool cap:research")), true);
  assert.equal(matches(item!, parseQuery("role:agent")), false);
});

test("capability suggestions are deterministic and respect hard filters", () => {
  const make = (id: string, role: "tool" | "agent", capabilities: string[]) => ({
    id, name: id, summary: "A tool", about: "", role, protocols: ["mcp"], capabilities,
    price: "free" as const, status: "active" as const, pubkey: id.padEnd(64, "0").slice(0, 64),
    createdAt: 100, source: "reference" as const,
  });
  const items = [make("research-agent", "agent", ["research"]), make("research-tool", "tool", ["research"])];
  assert.deepEqual(
    suggestCapabilities("role:tool cap:research proto:mcp", items),
    suggestCapabilities("role:tool cap:research proto:mcp", [...items].reverse()),
  );
  assert.equal(suggestCapabilities("role:tool cap:research", items)[0].role, "tool");
  assert.deepEqual(suggestCapabilities(" ", items), []);
});
