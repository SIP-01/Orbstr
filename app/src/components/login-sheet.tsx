import { useEffect, useId, useState } from "react";
import {
  extensionAvailable,
  loginWithExtension,
  loginWithSecret,
  migrateLegacyKey,
  refreshSigner,
  signOut,
  startNostrConnect,
} from "@/lib/orbstr/login";
import { useOrbstr, type Signer } from "@/lib/orbstr/store";

function signerLabel(signer: Signer | null, human: boolean): string {
  if (signer === "nip07") return human ? "Browser signer" : "NIP-07";
  if (signer === "bunker") return human ? "Remote signer" : "NIP-46";
  if (signer === "nsec") return human ? "Saved key" : "nsec";
  return human ? "Not signed in" : "No signer";
}

export function LoginBridge() {
  const snap = useOrbstr();
  useEffect(() => {
    void migrateLegacyKey().then(() => refreshSigner());
  }, [snap.pubkey, snap.signer]);
  return null;
}

export function LoginPanel({ human, onDone }: { human: boolean; onDone?: () => void }) {
  const snap = useOrbstr();
  const fieldId = useId();
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);

  if (snap.npub) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted">{signerLabel(snap.signer, human)}</p>
        <p className="mt-2 break-all text-sm text-phosphor">{snap.npub}</p>
        <p className="mt-2 text-sm text-muted">
          {human
            ? "Adding something signs with this key again. ORBSTR will not make a new one."
            : "Same key on the next publish. No npub is generated."}
        </p>
        {snap.logins.length > 1 && (
          <p className="mt-2 text-sm text-muted">
            {human ? `${snap.logins.length} keys saved on this device.` : `${snap.logins.length} logins stored.`}
          </p>
        )}
        <button
          className="mt-3 h-11 w-full rounded-full border border-border text-sm"
          type="button"
          onClick={() => {
            void signOut().then(() => onDone?.());
          }}
        >
          {human ? "Sign out" : "Log out"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">
        {human
          ? "Use a key you already have. On a phone, Amber is the usual signer. Nothing here creates a new npub."
          : "Same paths as Dsearch: NIP-07, nostrconnect (Amber), bunker://, or an existing nsec. Publish never generates a key."}
      </p>
      <button
        className="mt-3 h-11 w-full rounded-full border border-primary bg-primary text-sm text-primary-ink disabled:opacity-50"
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setMessage("");
          const session = startNostrConnect((next) => {
            setStatus(next === "getting-public-key" ? (human ? "Signer answered. Reading your key." : "get_public_key") : human ? "Waiting for the signer." : "awaiting connect");
          });
          setUri(session.uri);
          const link = document.createElement("a");
          link.href = session.uri;
          link.click();
          void session.done.then((error) => {
            setBusy(false);
            setStatus("");
            setMessage(error ?? (human ? "Signed in. This key stays on this device." : "Remote signer linked."));
            if (!error) onDone?.();
          });
        }}
      >
        {human ? "Open Amber or another signer" : "nostrconnect"}
      </button>
      <button
        className="mt-2 h-11 w-full rounded-full border border-border text-sm disabled:opacity-50"
        type="button"
        disabled={busy || !extensionAvailable()}
        onClick={() => {
          void loginWithExtension().then((error) => {
            setMessage(error ?? (human ? "Signed in with this browser." : "NIP-07 session ready."));
            if (!error) onDone?.();
          });
        }}
      >
        {extensionAvailable() ? (human ? "Use this browser" : "NIP-07") : human ? "No browser signer here" : "No NIP-07"}
      </button>
      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void loginWithSecret(secret).then((error) => {
            setBusy(false);
            setMessage(error ?? (human ? "Signed in. This key stays on this device." : "Key stored in this browser."));
            if (!error) {
              setSecret("");
              onDone?.();
            }
          });
        }}
      >
        <label className="block text-sm text-muted" htmlFor={fieldId}>
          {human ? "nsec or bunker link" : "nsec or bunker://"}
        </label>
        <input
          id={fieldId}
          value={secret}
          type="password"
          autoComplete="off"
          onChange={(event) => setSecret(event.target.value)}
          className="mt-1 h-11 w-full rounded-full border border-border bg-bg px-3 text-fg outline-none focus:border-primary"
        />
        <button className="mt-3 h-11 w-full rounded-full border border-border text-sm" type="submit" disabled={busy}>
          {human ? "Sign in with this key" : "Sign in"}
        </button>
      </form>
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
      {uri && (
        <a className="mt-2 block truncate text-sm text-phosphor" href={uri}>
          {human ? "Open the signer link" : uri}
        </a>
      )}
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
    </div>
  );
}
