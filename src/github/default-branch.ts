import { exec } from "../utils/exec.js";

export function ghRepoViewDefaultBranchArgs(): string[] {
  return ["repo", "view", "--json", "defaultBranchRef"];
}

/** Reads `defaultBranchRef.name` out of the `gh repo view --json` payload. */
export function parseDefaultBranch(stdout: string): string | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const ref = (parsed as { defaultBranchRef?: unknown }).defaultBranchRef;
    if (typeof ref !== "object" || ref === null) {
      return null;
    }
    const name = (ref as { name?: unknown }).name;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

/**
 * Base branch the platform reports for the repo. Only consults `gh`; when it
 * is unavailable or its payload carries no branch name the function returns
 * `null` and the orchestrator (src/cli/upgrade.ts) decides the fallback
 * (`origin/HEAD`, then "main").
 */
export async function detectDefaultBranchFromGh(
  projectDir: string,
  verbose: boolean,
): Promise<string | null> {
  try {
    const result = await exec("gh", ghRepoViewDefaultBranchArgs(), {
      cwd: projectDir,
      verbose,
    });
    return parseDefaultBranch(result.stdout);
  } catch {
    return null;
  }
}
