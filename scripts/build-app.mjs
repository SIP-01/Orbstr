#!/usr/bin/env node
/**
 * Build the ORBSTR reference app (app/) as this repository's Vercel build.
 *
 * The `orbstr` Vercel project is linked to this repository and deploys every
 * push to `main`. The project has no framework preset or root-directory
 * override, so this script is the build command: it installs and builds the
 * app in app/, then moves the resulting Build Output API directory
 * (app/.vercel/output) to the repository root, where Vercel picks it up.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, "app");

function run(cmd, args, cwd) {
  console.log(`[build-app] $ ${cmd} ${args.join(" ")} (cwd: ${cwd})`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.error) {
    console.error(`[build-app] failed to run ${cmd}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[build-app] ${cmd} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], appDir);
run("npm", ["run", "build"], appDir);

const built = join(appDir, ".vercel", "output");
if (!existsSync(built)) {
  console.error(`[build-app] expected build output at ${built} but it is missing`);
  process.exit(1);
}
console.log(`[build-app] app build output: ${readdirSync(built).join(", ")}`);

const target = join(root, ".vercel", "output");
rmSync(target, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
cpSync(built, target, { recursive: true });
console.log(`[build-app] build output ready at ${target}`);
