import { REGISTRY_THEME_SPEC, SHADCN_VERSION } from "../config/components.js";
import type { ProjectFramework } from "../frameworks/types.js";
import { exec } from "../utils/exec.js";
import {
  joinPath,
  removeEmptyDir,
  removeIfExists,
} from "../utils/filesystem.js";
import { ensureRegistryAliases } from "./configure-shadcn.js";

export function themeAddArgs(): string[] {
  return [
    "dlx",
    `shadcn@${SHADCN_VERSION}`,
    "add",
    REGISTRY_THEME_SPEC,
    "--yes",
    "--overwrite",
  ];
}

const THEME_JUNK_FILES = [
  "package.json",
  "tsconfig.json",
  "postcss.config.mjs",
];

/**
 * Applies the `@raulmoracode` nature theme via the shadcn CLI and leaves
 * the scaffold clean and working:
 * - On Vite, the theme's Next-oriented leftovers (`src/package.json`,
 *   `src/tsconfig.json`, `src/postcss.config.mjs`, `src/app/globals.css`)
 *   are removed; the tokens already landed in `src/index.css`.
 * - On Next, the root configs are untouched by the CLI, so only the same
 *   `src/`-prefixed junk is removed.
 * - tsconfig registry aliases are restored afterwards in both cases.
 * Must run before `patchPackageJson` (the theme overwrites `package.json`).
 */
export async function applyRegistryTheme(
  projectDir: string,
  framework: ProjectFramework,
  verbose: boolean,
): Promise<void> {
  await exec("pnpm", themeAddArgs(), { cwd: projectDir, verbose });
  const srcDir = joinPath(projectDir, "src");
  for (const file of THEME_JUNK_FILES) {
    await removeIfExists(joinPath(srcDir, file));
  }
  if (framework.id === "vite") {
    await removeIfExists(joinPath(srcDir, "app", "globals.css"));
    await removeEmptyDir(joinPath(srcDir, "app"));
  }
  await ensureRegistryAliases(projectDir);
}
