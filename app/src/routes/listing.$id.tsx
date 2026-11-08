import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { listingKey } from "@/lib/orbstr/protocol";
import { useOrbstr } from "@/lib/orbstr/store";
import { Chip, Panel } from "@/components/ui";

export const Route = createFileRoute("/listing/$id")({ component: Listing });

function Listing() {
  const { id } = Route.useParams();
  const snap = useOrbstr();
  const item = snap.catalog.find((entry) => listingKey(entry) === decodeURIComponent(id));
  const [echo, setEcho] = useState("hello orbstr");
  if (!item) {
    return (
      <Panel>
        <h1 className="font-display text-3xl">Listing missing</h1>
        <p className="mt-2 text-muted">That key is not in the reference catalog, this browser, or the last relay scan.</p>
        <Link to="/market" search={{ q: "" }} className="mt-4 inline-flex h-11 items-center text-primary">
          Back to the market
        </Link>
      </Panel>
    );
  }
  return (
    <article className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip active>{item.role}</Chip>
          {item.protocols.map((proto) => (
            <Chip key={proto}>{proto}</Chip>
          ))}
          <Chip>{item.price}</Chip>
        </div>
        <h1 className="mt-3 font-display text-5xl leading-none">{item.name}</h1>
        <p className="mt-4 text-lg text-muted">{item.summary}</p>
        {item.about && <p className="mt-4 max-w-2xl leading-relaxed">{item.about}</p>}
        {item.id === "echo" && item.source === "reference" && (
          <form className="mt-6 flex flex-col gap-3" onSubmit={(event) => event.preventDefault()}>
            <label className="text-sm text-muted" htmlFor="echo">
              Try the local echo. This does not leave the page.
            </label>
            <input
              id="echo"
              value={echo}
              onChange={(event) => setEcho(event.target.value)}
              className="h-12 rounded-full border border-border bg-surface px-4 outline-none focus:border-primary"
            />
            <output className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-phosphor">{echo}</output>
          </form>
        )}
      </div>
      <Panel className="h-fit">
        <h2 className="font-display text-2xl">Provenance</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Source</dt>
            <dd>
              {item.via === "dvm" ? "Nostr DVM" : item.via === "ai" ? "Nostr announcement" : item.source}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Publisher</dt>
            <dd className="break-all">{item.pubkey}</dd>
          </div>
          <div>
            <dt className="text-muted">Capabilities</dt>
            <dd>{item.capabilities.join(", ") || "none"}</dd>
          </div>
          {item.homepage && (
            <div>
              <dt className="text-muted">Homepage</dt>
              <dd>
                <a className="break-all text-primary" href={item.homepage} target="_blank" rel="noreferrer">
                  {item.homepage}
                </a>
              </dd>
            </div>
          )}
          {item.endpoint && (
            <div>
              <dt className="text-muted">Endpoint</dt>
              <dd className="break-all">{item.endpoint}</dd>
            </div>
          )}
          {item.priceNote && (
            <div>
              <dt className="text-muted">Price note</dt>
              <dd>{item.priceNote}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-sm text-muted">ORBSTR does not call remote endpoints and does not pay anyone.</p>
      </Panel>
    </article>
  );
}
