import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Panel } from "@/components/ui";
import { LoginPanel } from "@/components/login-sheet";
import { publishCapability } from "@/lib/orbstr/nostr";
import { PRICES, PROTOS, ROLES, slugify, type Price, type Proto, type Role } from "@/lib/orbstr/protocol";
import { DEFAULT_RELAYS, isSipRelay, relayLabel, setRelays, useOrbstr, type RelayNote } from "@/lib/orbstr/store";

export const Route = createFileRoute("/publish")({ component: Publish });

function Publish() {
  const snap = useOrbstr();
  const human = snap.voice === "human";
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [role, setRole] = useState<Role>("tool");
  const [proto, setProto] = useState<Proto>("mcp");
  const [price, setPrice] = useState<Price>("free");
  const [capabilities, setCapabilities] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [homepage, setHomepage] = useState("");
  const storedExtras = snap.relays.filter((relay) => !DEFAULT_RELAYS.includes(relay)).join("\n");
  const [draft, setDraft] = useState<string | null>(null);
  const extras = draft ?? storedExtras;
  const [message, setMessage] = useState(
    human ? "Sign in with your own Nostr key before adding something." : "Login required. Publishing does not generate an npub.",
  );
  const [notes, setNotes] = useState<RelayNote[]>([]);

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setRelays(extras.split("\n"));
          if (!snap.hasKey) {
            setMessage(human ? "Sign in first. ORBSTR will not create a key for you." : "No signer. Log in with an existing key.");
            return;
          }
          setMessage(human ? "Signing with your key…" : "Signing…");
          const result = await publishCapability({
            id: slugify(name),
            name,
            summary,
            role,
            protocols: [proto],
            price,
            capabilities: capabilities.split(",").map((item) => item.trim()),
            endpoint: endpoint.trim() || undefined,
            homepage: homepage.trim() || undefined,
          });
          setNotes(result.notes);
          setMessage(
            result.error ??
              (human ? `Added ${name || result.id} with your key.` : `Announced ${result.id} as ${result.pubkey.slice(0, 12)}…`),
          );
        }}
      >
        <header>
          <h1 className="font-display text-4xl">{human ? "Add something you run" : "Publish a capability"}</h1>
          <p className="mt-2 text-muted">
            {human
              ? "This tells the relays about a tool, using the Nostr key you signed in with. It does not make a new account."
              : "Writes kind 39698 from the signed-in key. It does not create a key and it does not write kind 39697."}
          </p>
        </header>
        <Field label={human ? "Name" : "Name"} value={name} onChange={setName} />
        <Field label={human ? "Short description" : "Summary"} value={summary} onChange={setSummary} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label={human ? "Kind of thing" : "Role"} value={role} options={ROLES} onChange={(value) => setRole(value as Role)} />
          <Select label={human ? "How to reach it" : "Protocol"} value={proto} options={PROTOS} onChange={(value) => setProto(value as Proto)} />
          <Select label={human ? "Cost" : "Price"} value={price} options={PRICES} onChange={(value) => setPrice(value as Price)} />
        </div>
        <Field label={human ? "Words that describe it, comma separated" : "Capability words, comma separated"} value={capabilities} onChange={setCapabilities} />
        <Field label={human ? "Address, https or wss, optional" : "Endpoint, https or wss, optional"} value={endpoint} onChange={setEndpoint} />
        <Field label={human ? "Website, optional" : "Homepage, https, optional"} value={homepage} onChange={setHomepage} />
        <Button tone="primary" type="submit" disabled={!snap.hasKey}>
          {human ? "Sign and add" : "Sign and publish"}
        </Button>
        <p className="text-sm text-muted">{message}</p>
        {notes.length > 0 && (
          <ul className="space-y-1 text-sm">
            {notes.map((note) => (
              <li key={note.url} className={note.state === "ok" ? "text-phosphor" : "text-danger"}>
                {relayLabel(note.url)}: {note.detail}
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="flex flex-col gap-4">
        <Panel>
          <h2 className="font-display text-2xl">{human ? "Your key" : "Signer"}</h2>
          {snap.npub ? (
            <>
              <p className="mt-2 break-all text-sm text-phosphor">{snap.npub}</p>
              <p className="mt-2 text-sm text-muted">
                {human
                  ? "Adding something uses this key again. Sign out from the top bar if it is the wrong one."
                  : `Signer is ${snap.signer === "nip07" ? "NIP-07" : snap.signer === "bunker" ? "NIP-46" : "the saved nsec"}. No fresh npub on submit.`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                {human
                  ? "Sign in with a key you already use. A browser Nostr app works, or paste your nsec. It stays on this device."
                  : "NIP-07, Amber via nostrconnect, a bunker link, or an nsec. Same key next time. No key is generated."}
              </p>
              <div className="mt-3">
                <LoginPanel human={human} />
              </div>
            </>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">{human ? "Relays that stay on" : "Standard pool"}</h2>
          <p className="mt-2 text-sm text-muted">
            {human
              ? "The SIP-01 index relays are always included, plus a few public relays where agent announcements show up."
              : "SIP-01 index relays are pinned. Directory relays carry kind 31990 and kind 39698."}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {DEFAULT_RELAYS.map((url) => (
              <li key={url} className="flex items-baseline justify-between gap-3">
                <span className="truncate">{relayLabel(url)}</span>
                <span className="shrink-0 text-xs text-phosphor">{isSipRelay(url) ? "SIP-01" : human ? "public" : "directory"}</span>
              </li>
            ))}
          </ul>
          <label className="mt-4 block text-sm text-muted" htmlFor="relays">
            {human ? "Extra relays, one wss address per line" : "Extra wss URLs, one per line"}
          </label>
          <textarea
            id="relays"
            value={extras}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-border bg-bg p-3 outline-none focus:border-primary"
          />
          <Button
            className="mt-3"
            type="button"
            onClick={() => {
              setRelays(extras.split("\n"));
              setDraft(null);
              setMessage(human ? "Extra relays saved. SIP-01 relays stay." : "Pool saved. SIP-01 relays remain pinned.");
            }}
          >
            {human ? "Save extra relays" : "Save relays"}
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-full border border-border bg-surface px-4 text-fg outline-none focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-full border border-border bg-surface px-3 text-fg"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
