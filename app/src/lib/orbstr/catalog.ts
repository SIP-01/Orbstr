import type { Capability } from "./protocol";

const REFERENCE = "reference";

function ref(partial: Omit<Capability, "pubkey" | "createdAt" | "source" | "status" | "about"> & { about?: string }): Capability {
  return {
    about: "",
    status: "active",
    pubkey: REFERENCE,
    createdAt: 1762500000,
    source: "reference",
    ...partial,
  };
}

/**
 * Unsigned reference cards so the catalog is usable before relays have
 * kind 39698 events. They are not claimed as network observations.
 */
export const REFERENCE_CATALOG: Capability[] = [
  ref({
    id: "echo",
    name: "Echo tool",
    summary: "Returns the text you give it. Runs in this browser. Nothing is sent.",
    about: "The first vertical slice: a harmless local tool. ORBSTR can find it, show its price and protocol, and invoke it without a relay round-trip or a payment.",
    role: "tool",
    protocols: ["mcp"],
    capabilities: ["echo", "text"],
    endpoint: "local://echo",
    price: "free",
  }),
  ref({
    id: "sip01-index",
    name: "SIP-01 web index",
    summary: "Signed observations of public web pages. Kind 39697. Many indexers, one document id.",
    about: "Search nodes group events by the d tag and count distinct pubkeys. ORBSTR reads this index. It does not rewrite it. A page about a service can carry a normal NIP-01 a tag pointing at a kind 39698 announcement.",
    role: "agent",
    protocols: ["nostr"],
    capabilities: ["web-search", "kind-39697", "index"],
    homepage: "https://github.com/SIP-01/SIP-01",
    price: "free",
  }),
  ref({
    id: "crawlstr",
    name: "Crawlstr",
    summary: "Browser crawler that publishes SIP-01 observations under its own indexer key.",
    about: "Crawlstr is a publisher of kind 39697, not a capability schema. Heartbeats stay kind 16919. Point it at public MCP directories later; do not fold service records into the observation event.",
    role: "agent",
    protocols: ["nostr"],
    capabilities: ["crawl", "observe", "kind-39697"],
    homepage: "https://github.com/SIP-01/Crawlstr-v3",
    price: "free",
  }),
  ref({
    id: "nip89-handlers",
    name: "Nostr app handlers",
    summary: "Kind 31990 already lists software that can open Nostr events. ORBSTR reads it. It does not replace it.",
    about: "NIP-89 is the handler directory: d, k, and platform URL templates. Use it when a service handles Nostr kinds or speaks NIP-90. Use kind 39698 when the service is an MCP tool, model, API, or other agent capability that is not an event handler.",
    role: "gateway",
    protocols: ["nostr"],
    capabilities: ["nip-89", "handlers", "discovery"],
    homepage: "https://github.com/nostr-protocol/nips/blob/master/89.md",
    price: "free",
  }),
  ref({
    id: "contextvm-transport",
    name: "ContextVM transport",
    summary: "Candidate path for carrying MCP over Nostr. Discovery does not require it.",
    about: "ORBSTR may link a listing at a ContextVM endpoint. Invocation stays on that transport. A client that only speaks MCP over HTTPS must still be describable.",
    role: "gateway",
    protocols: ["contextvm", "mcp"],
    capabilities: ["mcp", "transport"],
    price: "free",
  }),
  ref({
    id: "open-model-slot",
    name: "Model endpoint pattern",
    summary: "How a metered inference endpoint should announce itself without hiding inside a web observation.",
    about: "Publish kind 39698 with role model, proto http, and a price tag. Put the base URL in endpoint. Do not send prompts through Nostr. ORBSTR will not call the endpoint for you.",
    role: "model",
    protocols: ["http"],
    capabilities: ["inference", "openai-compatible"],
    price: "metered",
    priceNote: "Pattern only. No provider is implied and nothing is billed here.",
  }),
  ref({
    id: "public-dataset",
    name: "Dataset card pattern",
    summary: "A signed pointer at a public dataset: license, role, and homepage. Bytes stay on the host.",
    about: "The announcement is metadata. The file transfer is not a Nostr event. Pair it with a kind 39697 observation of the dataset's public page if you want the web index to find the same URL.",
    role: "dataset",
    protocols: ["http"],
    capabilities: ["dataset", "metadata"],
    price: "free",
  }),
  ref({
    id: "gpu-slot",
    name: "Compute listing pattern",
    summary: "GPU or job capacity with an explicit price model. Payment rails stay optional adapters.",
    about: "NIP-90 already moves paid Nostr jobs. Lightning and Cashu can be adapters later. This card only shows how capacity should be discovered. No job is submitted.",
    role: "compute",
    protocols: ["http", "nostr"],
    capabilities: ["gpu", "jobs"],
    price: "prepaid",
    priceNote: "No invoice is created by this reference card.",
  }),
];

export function isReference(item: Capability): boolean {
  return item.source === "reference";
}
