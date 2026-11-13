import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button, Panel } from "@/components/ui";
import { suggestCapabilities } from "@/lib/orbstr/suggest";
import { useOrbstr } from "@/lib/orbstr/store";
import { DVM_KIND_LIST } from "@/lib/orbstr/dvm";

const REQ = JSON.stringify([
  { kinds: [39698], limit: 40 },
  { kinds: [31990], "#k": DVM_KIND_LIST, limit: 40 },
], null, 2);

export const Route = createFileRoute("/agents")({ component: Agents });

function Agents() {
  const snap = useOrbstr();
  const human = snap.voice === "human";
  const [task, setTask] = useState(human ? "Find a free tool that can echo text" : "Find a free tool that can echo text");
  const [copied, setCopied] = useState("");
  const hits = useMemo(() => suggestCapabilities(task, snap.catalog), [task, snap.catalog]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl">{human ? "Ask in plain words" : "Agent cable"}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {human
            ? "Describe what you need. ORBSTR matches it to tools it knows, including AI agents found on Nostr. It will not run them or spend money."
            : "An agent searches kind 39698 and any DVM rows from the last scan, reads the signed listing, and asks its owner before any call. ORBSTR never spends and never treats a listing as permission."}
        </p>
      </header>
      <Panel>
        <label className="text-sm text-muted" htmlFor="task">
          {human ? "What do you need?" : "Match a task against the catalog"}
        </label>
        <textarea
          id="task"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-border bg-bg p-3 outline-none focus:border-primary"
        />
        <ul className="mt-4 space-y-3">
          {hits.length === 0 && <li className="text-muted">{human ? "No overlap yet. Try a word like echo, image, or search." : "No overlap yet. Name a role or a capability word."}</li>}
          {hits.map((hit) => (
            <li key={hit.key} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3">
              <Link to="/listing/$id" params={{ id: hit.key }} className="font-display text-xl">
                {hit.name}
              </Link>
              <span className="text-sm text-muted">
                {hit.role} · {hit.why}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">{human ? "For a program" : "Nostr filters (OR)"}</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-bg p-3 text-sm text-phosphor">{REQ}</pre>
          <Button
            className="mt-3"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(REQ).then(() => setCopied("Filter copied."));
            }}
          >
            {human ? "Copy the filters" : "Copy filters"}
          </Button>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">{human ? "What this will not do" : "Rules for the caller"}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            {human ? (
              <>
                <li>Read what the listing says it is, what it costs, and where it lives.</li>
                <li>Show who signed it. Do not mix that with web-page notes.</li>
                <li>Ask before anything leaves this device, even if the tool is free.</li>
                <li>Talk to the tool on its own address. Nostr only carried the announcement.</li>
                <li>Keep a note of what happened. Do not write that note into the web index.</li>
              </>
            ) : (
              <>
                <li>Read role, proto, price, and endpoint from the signed event.</li>
                <li>Show the pubkey. Do not merge it with crawler observations.</li>
                <li>Ask before a remote call. Free still needs permission if it leaves the machine.</li>
                <li>Invoke on the service's own transport. Nostr only carried the announcement.</li>
                <li>Record provider, price model, and result. Do not write that record back into kind 39697.</li>
              </>
            )}
          </ol>
        </Panel>
      </div>
      {copied && <p className="text-sm text-phosphor">{copied}</p>}
    </div>
  );
}
