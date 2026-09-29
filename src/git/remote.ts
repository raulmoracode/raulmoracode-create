import { exec } from "../utils/exec.js";

export function remoteAddArgs(url: string): string[] {
  return ["remote", "add", "origin", url];
}

export function remoteGetUrlArgs(): string[] {
  return ["remote", "get-url", "origin"];
}

export function lsRemoteArgs(url: string): string[] {
  return ["ls-remote", url];
}

export async function addRemote(
  projectDir: string,
  url: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", remoteAddArgs(url), { cwd: projectDir, verbose });
}

export async function remoteExists(
  projectDir: string,
  verbose: boolean,
): Promise<boolean> {
  try {
    await exec("git", remoteGetUrlArgs(), { cwd: projectDir, verbose });
    return true;
  } catch {
    return false;
  }
}

export async function lsRemote(url: string, verbose: boolean): Promise<string> {
  const result = await exec("git", lsRemoteArgs(url), { verbose });
  return result.stdout;
}

export async function isRemoteEmpty(
  url: string,
  verbose: boolean,
): Promise<boolean> {
  const output = await lsRemote(url, verbose);
  return output.trim() === "";
}
