import { exec } from "../utils/exec.js";
import { addArgs, commitArgs } from "./commit.js";

export function showTopLevelArgs(): string[] {
  return ["rev-parse", "--show-toplevel"];
}

export function porcelainArgs(): string[] {
  return ["status", "--porcelain"];
}

export function currentBranchArgs(): string[] {
  return ["rev-parse", "--abbrev-ref", "HEAD"];
}

export function originHeadArgs(): string[] {
  return ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"];
}

export function fetchOriginArgs(): string[] {
  return ["fetch", "origin"];
}

export function switchCreateArgs(branch: string, startPoint: string): string[] {
  return ["switch", "-c", branch, startPoint];
}

export function switchArgs(branch: string): string[] {
  return ["switch", branch];
}

export function branchDeleteArgs(branch: string): string[] {
  return ["branch", "-D", branch];
}

export function addPathsArgs(paths: string[]): string[] {
  return ["add", "--", ...paths];
}

export function unstagePathsArgs(paths: string[]): string[] {
  return ["restore", "--staged", "--", ...paths];
}

export function restorePathsArgs(paths: string[]): string[] {
  return ["restore", "--", ...paths];
}

export function pushBranchArgs(branch: string): string[] {
  return ["push", "-u", "origin", branch];
}

export async function repositoryRoot(
  projectDir: string,
  verbose: boolean,
): Promise<string> {
  const result = await exec("git", showTopLevelArgs(), {
    cwd: projectDir,
    verbose,
  });
  return result.stdout.trim();
}

export async function workingTreeChanges(
  projectDir: string,
  verbose: boolean,
): Promise<string[]> {
  const result = await exec("git", porcelainArgs(), {
    cwd: projectDir,
    verbose,
  });
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function currentBranch(
  projectDir: string,
  verbose: boolean,
): Promise<string> {
  const result = await exec("git", currentBranchArgs(), {
    cwd: projectDir,
    verbose,
  });
  return result.stdout.trim();
}

export async function originHeadBranch(
  projectDir: string,
  verbose: boolean,
): Promise<string | null> {
  try {
    const result = await exec("git", originHeadArgs(), {
      cwd: projectDir,
      verbose,
    });
    const ref = result.stdout.trim();
    if (ref.length === 0) {
      return null;
    }
    return ref.replace(/^origin\//, "");
  } catch {
    return null;
  }
}

export async function fetchOrigin(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", fetchOriginArgs(), { cwd: projectDir, verbose });
}

export async function createBranch(
  projectDir: string,
  branch: string,
  startPoint: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", switchCreateArgs(branch, startPoint), {
    cwd: projectDir,
    verbose,
  });
}

export async function switchToBranch(
  projectDir: string,
  branch: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", switchArgs(branch), { cwd: projectDir, verbose });
}

export async function deleteLocalBranch(
  projectDir: string,
  branch: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", branchDeleteArgs(branch), { cwd: projectDir, verbose });
}

export async function stageAll(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", addArgs(), { cwd: projectDir, verbose });
}

export async function stagePaths(
  projectDir: string,
  paths: string[],
  verbose: boolean,
): Promise<void> {
  await exec("git", addPathsArgs(paths), { cwd: projectDir, verbose });
}

export async function unstagePaths(
  projectDir: string,
  paths: string[],
  verbose: boolean,
): Promise<void> {
  await exec("git", unstagePathsArgs(paths), { cwd: projectDir, verbose });
}

/**
 * Restores the working tree copies of `paths` from the index. Only ever used
 * to undo the files this run wrote, and only after the clean-tree preflight,
 * so the content replaced is exactly the user's.
 */
export async function restorePaths(
  projectDir: string,
  paths: string[],
  verbose: boolean,
): Promise<void> {
  await exec("git", restorePathsArgs(paths), { cwd: projectDir, verbose });
}

export async function commitWithMessage(
  projectDir: string,
  message: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", commitArgs(message), { cwd: projectDir, verbose });
}

export async function pushBranch(
  projectDir: string,
  branch: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", pushBranchArgs(branch), { cwd: projectDir, verbose });
}
