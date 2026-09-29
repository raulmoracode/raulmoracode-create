import { readmeMd } from "../config/readme.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../config/tech.js";
import type { PackageJson, ProjectFramework } from "../frameworks/types.js";
import { joinPath, readJsonFile, writeTextFile } from "../utils/filesystem.js";
import {
  devDependencies,
  PNPM_VERSION,
  runtimeDependencies,
} from "./configure-project.js";

/**
 * Overwrites the scaffold's default README with the raulmoracode one.
 * Must run after `patchPackageJson` so the scripts table matches
 * the final `package.json`.
 */
export async function configureReadme(
  projectDir: string,
  framework: ProjectFramework,
  projectName: string,
  githubUrl: string,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  const pkg = await readJsonFile<PackageJson>(
    joinPath(projectDir, "package.json"),
  );
  const versions: Record<string, string> = {
    ...framework.pinnedDependencies(),
    ...framework.pinnedDevDependencies(),
    ...runtimeDependencies(selection),
    ...devDependencies(framework, selection),
  };
  await writeTextFile(
    joinPath(projectDir, "README.md"),
    readmeMd({
      projectName,
      githubUrl,
      frameworkId: framework.id,
      frameworkLabel: framework.label,
      scripts: pkg.scripts ?? {},
      versions,
      pnpmVersion: PNPM_VERSION,
      selection,
    }),
  );
}
