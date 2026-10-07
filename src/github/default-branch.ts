import { originHeadBranch } from "../git/upgrade.js";
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
 * Base branch of the pull request. `gh` answers authoritatively; when it is
 * unavailable the local `origin/HEAD` symbolic ref is used instead. Injectable
 * so the orchestrator can be tested without the network.
 */
export async function detectDefaultBranch(
  projectDir: string,
  verbose: boolean,
): Promise<string> {
  try {
    const result = await exec("gh", ghRepoViewDefaultBranchArgs(), {
      cwd: projectDir,
      verbose,
    });
    const fromGh = parseDefaultBranch(result.stdout);
    if (fromGh) {
      return fromGh;
    }
  } catch {
    // Fall through to the local symbolic ref.
  }
  const fromOrigin = await originHeadBranch(projectDir, verbose);
  return fromOrigin ?? "main";
}
