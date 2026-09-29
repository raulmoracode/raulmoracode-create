import type { ProjectFramework } from "../frameworks/types.js";

export async function createProject(
  framework: ProjectFramework,
  name: string,
  cwd: string,
  verbose: boolean,
): Promise<string> {
  return framework.createProject(name, cwd, verbose);
}
