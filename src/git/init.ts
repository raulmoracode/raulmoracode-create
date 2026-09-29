import { exec } from "../utils/exec.js";

export function initArgs(): string[] {
  return ["init"];
}

export function branchArgs(): string[] {
  return ["branch", "-M", "main"];
}

export async function initRepository(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", initArgs(), { cwd: projectDir, verbose });
  await exec("git", branchArgs(), { cwd: projectDir, verbose });
}
