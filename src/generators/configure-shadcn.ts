import {
  componentsJson,
  utilsTs,
  withRegistryAliases,
} from "../config/components.js";
import type { ProjectFramework } from "../frameworks/types.js";
import {
  joinPath,
  parseJsonc,
  readTextFile,
  writeTextFile,
} from "../utils/filesystem.js";

const TSCONFIG_FILES = ["tsconfig.app.json", "tsconfig.json"];

/**
 * Adds the `@raulmoracode` registry path aliases to every tsconfig present.
 * Missing files are skipped; existing mappings and comments are preserved.
 */
export async function ensureRegistryAliases(projectDir: string): Promise<void> {
  for (const file of TSCONFIG_FILES) {
    const tsconfigPath = joinPath(projectDir, file);
    let raw: string | null = null;
    try {
      raw = await readTextFile(tsconfigPath);
    } catch {
      continue;
    }
    const tsconfig = parseJsonc<{
      compilerOptions?: Record<string, unknown>;
    }>(raw);
    const compilerOptions = tsconfig.compilerOptions ?? {};
    const existingPaths = (compilerOptions.paths ?? {}) as Record<
      string,
      string[]
    >;
    compilerOptions.paths = withRegistryAliases(existingPaths);
    tsconfig.compilerOptions = compilerOptions;
    await writeTextFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
  }
}

export async function configureShadcn(
  projectDir: string,
  framework: ProjectFramework,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, "components.json"),
    componentsJson(framework.componentsJsonOptions()),
  );
  await writeTextFile(
    joinPath(projectDir, "src", "lib", "utils.ts"),
    utilsTs(),
  );
  await ensureRegistryAliases(projectDir);
}
