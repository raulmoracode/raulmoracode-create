import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { ExecError, exec } from "../utils/exec.js";
import {
  joinPath,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";

/**
 * Thrown when the GitHub CLI is missing or not authenticated. Defined here
 * instead of reusing `PreflightError` from `src/cli/run.ts` so that
 * `src/github/` stays free of CLI/Clack dependencies.
 */
export class GhAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhAuthError";
  }
}

export interface CreatePullRequestOptions {
  cwd: string;
  base: string;
  head: string;
  title: string;
  body: string;
  verbose: boolean;
}

export function ghAuthStatusArgs(): string[] {
  return ["auth", "status"];
}

export function ghPrListArgs(head: string): string[] {
  return [
    "pr",
    "list",
    "--head",
    head,
    "--state",
    "open",
    "--json",
    "url",
    "--limit",
    "1",
  ];
}

export function ghPrCreateArgs(params: {
  base: string;
  head: string;
  title: string;
  bodyFile: string;
}): string[] {
  return [
    "pr",
    "create",
    "--base",
    params.base,
    "--head",
    params.head,
    "--title",
    params.title,
    "--body-file",
    params.bodyFile,
  ];
}

export function ghRepoViewArgs(): string[] {
  return [
    "repo",
    "view",
    "--json",
    "defaultBranchRef",
    "-q",
    ".defaultBranchRef.name",
  ];
}

export async function requireGhAuth(verbose: boolean): Promise<void> {
  try {
    await exec("gh", ghAuthStatusArgs(), { verbose });
  } catch (error) {
    if (error instanceof ExecError && error.spawnError) {
      throw new GhAuthError(
        "La CLI de GitHub (gh) no está instalada o no está disponible en el PATH.\n" +
          "Instálala: https://cli.github.com",
      );
    }
    throw new GhAuthError(
      "La CLI de GitHub (gh) no está autenticada.\nEjecuta: gh auth login",
    );
  }
}

/** URL of the open pull request whose head is `head`, or null. */
export async function findOpenPullRequest(
  cwd: string,
  head: string,
  verbose: boolean,
): Promise<string | null> {
  let stdout = "";
  try {
    const result = await exec("gh", ghPrListArgs(head), { cwd, verbose });
    stdout = result.stdout;
  } catch {
    return null;
  }
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const first = parsed[0] as { url?: unknown } | undefined;
    const url = first?.url;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

/** Creates a ready-for-review (never draft) pull request and returns its URL. */
export async function createPullRequest(
  options: CreatePullRequestOptions,
): Promise<string> {
  const bodyFile = joinPath(
    tmpdir(),
    `raulmoracode-pr-body-${randomUUID()}.md`,
  );
  await writeTextFile(bodyFile, options.body);
  try {
    const result = await exec(
      "gh",
      ghPrCreateArgs({
        base: options.base,
        head: options.head,
        title: options.title,
        bodyFile,
      }),
      { cwd: options.cwd, verbose: options.verbose },
    );
    const url = extractUrl(result.stdout);
    if (url === null) {
      throw new Error(
        `gh pr create no devolvió la URL del pull request.\n${result.stdout.trim() || result.stderr.trim()}`,
      );
    }
    return url;
  } finally {
    await removeIfExists(bodyFile);
  }
}

/** Default branch of the repository in `cwd`, or null when it cannot be read. */
export async function repoDefaultBranch(
  cwd: string,
  verbose: boolean,
): Promise<string | null> {
  try {
    const result = await exec("gh", ghRepoViewArgs(), { cwd, verbose });
    const branch = result.stdout.trim();
    return branch.length > 0 ? branch : null;
  } catch {
    return null;
  }
}

function extractUrl(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^https:\/\/\S+$/.exec(line.trim());
    if (match) {
      return match[0];
    }
  }
  return null;
}
