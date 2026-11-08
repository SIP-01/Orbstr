import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/remoteloginsuccess")({
  component: RemoteLoginSuccess,
});

function RemoteLoginSuccess() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void navigate({ to: "/" });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-4xl">Signer approved</h1>
      <p className="mt-3 text-muted">
        The connection is saved on this device. Taking you back.
      </p>
      <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full border border-primary bg-primary px-4 text-sm text-primary-ink">
        Back to search
      </Link>
    </div>
  );
}
