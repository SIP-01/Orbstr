---
name: og
description: Create and validate Open Graph, Twitter/X share-card, PWA identity and brand assets for apps built in this workspace. Use when an app needs a social preview card, custom brand identity, game card, X feed banner, favicon or share metadata. Do not use for ordinary feature UI or as a substitute for the browser-rendering QA workflow.
---

# Open Graph and brand assets

Use this skill for the app's public-facing preview identity. The implementation is enforced by scripts/brand-check.mjs and injected by the shared PWA/OG helper. Follow the repository's platform contract; do not invent alternate metadata names or paths.

## Brand-asset pass:

1. Read AGENTS.md and src/lib/og/site.json before changing assets. Inspect the existing application name, palette, art direction and assets. Keep the card recognizably tied to the product and use imagery already present where possible.
2. Decide whether a custom card is required:
   - **Required by default:** games of every kind (including DOM/board/word games), canvas/3D experiences, whimsical or creative tools, and brand-forward landing pages.
   - **Placeholder acceptable:** plain utilities such as converters, CRUD trackers and admin dashboards. Do not manufacture a generic custom card just to satisfy the check.
3. For a custom card, create public/og.jpg at 1200×630 (1.91:1). Use the product's name and visual identity, strong contrast, uncluttered composition, and safe margins for platform cropping. Prefer JPEG encoded with ffmpeg -q:v 4; keep it below 600 KB (roughly 150–300 KB is a useful target). A PNG at public/og.png is accepted when appropriate, but keep the file below the same 600 KB limit.
4. Update src/lib/og/site.json with "card": "custom" when a custom card is present. Set a concise, user-facing "title" and optional valid six-digit hex "color" only when it supports the brand. Do not put secrets, private user data, unlicensed third-party art or personal information into public assets or metadata.
5. For games/canvas experiences, also set "type": "x:game" and create public/x-banner.jpg at 1200×264 (50:11). Keep the banner below 600 KB. It is distinct from the 1200×630 OG card.
6. Use image-generation tools only when they are actually present in the session's available tools. Otherwise create a polished asset with existing licensed art, CSS/SVG/canvas/WebGL, or report the limitation honestly. Never invent tool names or claim an asset was generated when it was not.
7. If this work is running as the background brand subtask, create and maintain /workspace/.grok/og-pending while assets are actively being produced. The parent brand gate treats the marker as active for at most 10 minutes from its modification time. Refresh it only while genuinely working; remove it on completion or failure. Do not leave a stale marker to suppress a later validation.
   Never wait_tasks; never get_task_output.
   Do not wait_tasks or get_task_output while this delegated pass is active. Continue independent work and rely on the task completion notification.
8. Verify actual files and metadata; do not infer that a generated file is valid from its name. Confirm dimensions, format and size using available tools. If an asset is too large, re-encode or resize rather than silently accepting it. Read references/asset-handover.md for the required staged-write procedure and exact atomic hand-over commands.

## Required self-check

Run the brand checker from the app workspace after the assets and metadata are in place:

- For a game/canvas app: node scripts/brand-check.mjs --game
- For a normal brand-card pass: node scripts/brand-check.mjs
- For a plain utility pass that intentionally keeps the platform placeholder: node scripts/brand-check.mjs --placeholder-ok

The checker is deterministic and reports the files on disk. A zero exit code is necessary but not sufficient: visually inspect the resulting card and verify it renders at the published app URL when deployment is available. Do not weaken or bypass the checker to make a failed brand pass appear successful.

## Parallel-task boundary

When this is delegated as a background subtask, own only public/ brand assets and src/lib/og/site.json, unless the parent explicitly assigns another path. Do not overwrite unrelated source changes. The marker /workspace/.grok/og-pending is temporary state, not a permanent success flag.

Do not wait on the delegated task output. If the subtask fails, report that it failed and leave the app's placeholder in place rather than claiming a custom card exists.

## Completion report

State which files changed, the actual dimensions/format/size of each public asset, whether the brand checker passed, and whether the published page was visually verified. Distinguish local file verification from a deployed social-preview check. Report missing capabilities or unfinished work explicitly.
