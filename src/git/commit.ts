import { exec } from "../utils/exec.js";

export const INITIAL_COMMIT_MESSAGE = "chore: initial project setup";

export function addArgs(): string[] {
  return ["add", "."];
}

export function commitArgs(message: string = INITIAL_COMMIT_MESSAGE): string[] {
  return ["commit", "-m", message];
}

export async function createCommit(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("git", addArgs(), { cwd: projectDir, verbose });
  await exec("git", commitArgs(), { cwd: projectDir, verbose });
}
