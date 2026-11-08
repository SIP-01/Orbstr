import { Link, useRouterState } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoginBridge, LoginPanel } from "@/components/login-sheet";
import { tally } from "@/lib/orbstr/stats";
import { scanRelays } from "@/lib/orbstr/nostr";
import { hydrateStore, setVoice, useOrbstr, type Voice } from "@/lib/orbstr/store";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border font-medium transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      tone: {
        primary: "border-primary bg-primary text-primary-ink hover:brightness-105",
        quiet: "border-border bg-surface text-fg hover:border-primary",
        ghost: "border-transparent bg-transparent text-muted hover:text-fg",
      },
      size: {
        md: "h-11 px-4 text-sm",
        sm: "h-9 px-3 text-sm",
      },
    },
    defaultVariants: { tone: "quiet", size: "md" },
  },
);

export function Button({
  tone,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={buttonStyles({ tone, size, className })} {...props} />;
}

const NAV = [
  { to: "/", agent: "Search", human: "Find" },
  { to: "/market", agent: "Market", human: "Browse" },
  { to: "/publish", agent: "Publish", human: "Add" },
  { to: "/agents", agent: "Agents", human: "Help" },
  { to: "/protocol", agent: "Protocol", human: "How" },
  // The SIP-01 web search client — the other half of the search story (kind 39697).
  { to: "https://sipstr.vercel.app", agent: "Web", human: "Web search", external: true },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const snap = useOrbstr();
  const human = snap.voice === "human";
  const stats = tally(snap);

  useEffect(() => {
    hydrateStore();
    const timer = window.setTimeout(() => {
      void scanRelays();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <LoginBridge />
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center gap-2 py-2">
            <Link to="/" className="flex min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden">
              <img src="/favicon.svg" alt="" className="size-8 shrink-0" />
              <span className="truncate font-display text-lg leading-none tracking-tight">ORBSTR</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <VoiceToggle voice={snap.voice} />
              <LoginControl npub={snap.npub} human={human} />
            </div>
          </div>
          <nav className="-mx-4 flex gap-1 overflow-x-auto border-t border-border px-4 py-2" aria-label="Sections">
            {NAV.map((item) => {
              const label = human ? item.human : item.agent;
              if ("external" in item) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    target="_blank"
                    rel="noreferrer"
                    title="SIP-01 web index search (kind 39697)"
                    className="inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm text-muted hover:text-fg"
                  >
                    {label}
                  </a>
                );
              }
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm " +
                    (active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")
                  }
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <p className="truncate pb-2 text-xs text-muted">
            {stats.listings} {human ? "listed" : "catalog"}
            {" · "}
            {stats.dvms} {human ? "AI agents" : "DVMs"}
            {" · "}
            {human ? "SIP" : "SIP"} {stats.sipUp}/{stats.sip}
            {" · "}
            {stats.pages} {human ? "pages" : "pages"}
            {" · "}
            {stats.relaysUp}/{stats.relays} {human ? "relays" : "relays"}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function VoiceToggle({ voice }: { voice: Voice }) {
  return (
    <div className="flex h-11 shrink-0 items-center rounded-full border border-border p-1" role="group" aria-label="How the site talks">
      {(["agent", "human"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={voice === option}
          className={
            "h-9 rounded-full px-3 text-sm capitalize " +
            (voice === option ? "bg-primary text-primary-ink" : "text-muted")
          }
          onClick={() => setVoice(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function LoginControl({ npub, human }: { npub: string | null; human: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className={
          "h-11 max-w-36 truncate rounded-full border px-3 text-sm " +
          (npub ? "border-border text-phosphor" : "border-primary bg-primary text-primary-ink")
        }
        onClick={() => setOpen((value) => !value)}
      >
        {npub ? `${npub.slice(0, 8)}…` : human ? "Sign in" : "Log in"}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-30 cursor-default bg-bg/40" type="button" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 bottom-3 z-40 sm:absolute sm:inset-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:w-80">
            <LoginPanel human={human} onDone={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs uppercase tracking-wide " +
        (active ? "border-primary text-primary" : "border-border text-muted")
      }
    >
      {children}
    </span>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</section>;
}
