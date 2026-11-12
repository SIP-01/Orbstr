# Safe asset hand-over

The brand task must not write directly into public/ or src/lib/og/ while another agent may be building. Write each complete file to a staging path under /workspace/.grok/ (same filesystem, outside public/), validate it, then hand it over with the repository's atomic rename helper. Do not stage in /tmp or public/: cross-filesystem moves are refused and files in public/ can be copied into a deployment mid-write.

Create /workspace/.grok/ if it does not exist. Example hand-overs:

- OG image: node scripts/write-atomic.mjs /workspace/.grok/og.jpg.tmp public/og.jpg
- X banner: node scripts/write-atomic.mjs /workspace/.grok/x-banner.jpg.tmp public/x-banner.jpg
- OG site metadata: node scripts/write-atomic.mjs /workspace/.grok/site.json.tmp src/lib/og/site.json

The staged file must already be complete and validated before the command runs. The helper creates the target directory and renames the staged file atomically. It does not generate, resize, inspect or validate the asset for you; do those checks before hand-over. If the command fails, do not claim the target was updated. Inspect the error and keep the existing target intact.
