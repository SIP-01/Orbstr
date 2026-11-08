import { Link } from "@tanstack/react-router";
import { Chip } from "@/components/ui";
import { listingKey, type Capability } from "@/lib/orbstr/protocol";
import { useOrbstr } from "@/lib/orbstr/store";

function origin(item: Capability, human: boolean): string {
  if (item.via === "dvm") return human ? "Nostr agent" : "DVM";
  if (item.via === "ai") return human ? "On Nostr" : "Nostr";
  if (item.source === "relay") return human ? "From a relay" : "Relay";
  if (item.source === "local") return human ? "Yours" : "This browser";
  return human ? "Example" : "Reference";
}

export function ListingCard({ item }: { item: Capability }) {
  const human = useOrbstr().voice === "human";
  return (
    <Link
      to="/listing/$id"
      params={{ id: listingKey(item) }}
      className="flex min-h-44 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:border-primary"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip active>{item.role}</Chip>
        {item.protocols.map((proto) => (
          <Chip key={proto}>{proto}</Chip>
        ))}
        <Chip>{item.price}</Chip>
        <span className="ml-auto text-xs text-muted">{origin(item, human)}</span>
      </div>
      <h2 className="font-display text-2xl leading-tight">{item.name}</h2>
      <p className="text-sm leading-relaxed text-muted">{item.summary}</p>
    </Link>
  );
}
