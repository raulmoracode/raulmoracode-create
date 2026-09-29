import { exec } from "../utils/exec.js";

export function pushArgs(): string[] {
  return ["push", "-u", "origin", "main"];
}

export function fetchArgs(): string[] {
  return ["fetch", "origin"];
}

export function revParseArgs(ref: string): string[] {
  return ["rev-parse", ref];
}

export function mergeBaseIsAncestorArgs(
  ancestor: string,
  descendant: string,
): string[] {
  return ["merge-base", "--is-ancestor", ancestor, descendant];
}

export async function push(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", pushArgs(), { cwd: projectDir, verbose });
}

export async function fetchRemote(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", fetchArgs(), { cwd: projectDir, verbose });
}

export async function resolveSha(
  projectDir: string,
  ref: string,
  verbose: boolean,
): Promise<string | null> {
  try {
    const result = await exec("git", revParseArgs(ref), {
      cwd: projectDir,
      verbose,
    });
    const sha = result.stdout.trim();
    return sha.length > 0 ? sha : null;
  } catch {
    return null;
  }
}

export async function isAncestor(
  projectDir: string,
  ancestor: string,
  descendant: string,
  verbose: boolean,
): Promise<boolean> {
  try {
    await exec("git", mergeBaseIsAncestorArgs(ancestor, descendant), {
      cwd: projectDir,
      verbose,
    });
    return true;
  } catch {
    return false;
  }
}

export async function remoteHasDivergentCommits(
  projectDir: string,
  verbose: boolean,
): Promise<boolean> {
  await fetchRemote(projectDir, verbose);
  const remoteSha = await resolveSha(projectDir, "origin/main", verbose);
  if (!remoteSha) {
    return false;
  }
  const localSha = await resolveSha(projectDir, "HEAD", verbose);
  if (!localSha) {
    return false;
  }
  if (remoteSha === localSha) {
    return false;
  }
  return !(await isAncestor(projectDir, remoteSha, "HEAD", verbose));
}
