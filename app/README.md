# ORBSTR reference app (v0.1)

The ORBSTR reference UI — search, market, publish, agents, protocol — built
with TanStack Start (Vite + Nitro). It speaks the kind 39698 capability
schema from `../spec/CAPABILITY.md`, keeps signing keys in the browser, and
never calls remote endpoints from the directory itself.

Deployed to Vercel as the `orbstr` project → https://orbstr.vercel.app

## Local development

    npm ci
    npm run dev        # dev server on 0.0.0.0:8080

## Build & preview

    npm ci --omit=dev
    npm run build      # emits .vercel/output (Build Output API)
    npm run preview    # serves the built output on 127.0.0.1:8081

On Vercel, the repository root's `scripts/build-app.mjs` (wired as the build
command in `../vercel.json`) runs the same build and places the output at the
repository root for deployment.
