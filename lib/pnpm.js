import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Official pnpm version pinned by RaulMoraCode. See docs/pnpm.md. */
export const PNPM_VERSION = "12.5.1";

/** Lockfiles from other package managers. They must never remain in a generated project. */
export const FOREIGN_LOCKFILES = [
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
];

/**
 * Check whether pnpm is available on PATH.
 * Never installs pnpm silently: if missing, the caller must show
 * install instructions and exit.
 */
export function isPnpmAvailable() {
  const result = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  const version = String(result.stdout || "").trim();
  return version || null;
}

export function pnpmInstallInstructions() {
  return [
    "pnpm is required to create a RaulMoraCode project, but it was not found on your PATH.",
    "",
    "Install pnpm first, then run this command again:",
    "",
    "  Standalone installer (no Node.js required):",
    "    curl -fsSL https://get.pnpm.io/install.sh | sh -",
    "",
    "  With Node.js 22.13 or newer already installed:",
    "    npx get-pnpm",
    "",
    "  Docs: https://pnpm.io/installation",
    "",
    `Generated projects declare "packageManager": "pnpm@${PNPM_VERSION}".`,
    "See docs/pnpm.md for the full pnpm policy.",
  ].join("\n");
}

/**
 * Remove lockfiles from other package managers when they appear as a
 * side effect of an official Vite / Next.js scaffold.
 */
export function removeForeignLockfiles(projectDir) {
  const removed = [];
  for (const file of FOREIGN_LOCKFILES) {
    const full = join(projectDir, file);
    if (existsSync(full)) {
      rmSync(full, { force: true });
      removed.push(file);
    }
  }
  return removed;
}

/** Run a pnpm subcommand in a directory, inheriting stdio. Returns exit code. */
export function runPnpm(args, cwd) {
  const result = spawnSync("pnpm", args, { cwd, stdio: "inherit" });
  if (result.error) return 1;
  return result.status ?? 1;
}
