import { SITE_CONFIG_PATH, siteConfigTs, siteValues } from "../config/site.js";
import type { PackageJson } from "../frameworks/types.js";
import { joinPath, readJsonFile, writeTextFile } from "../utils/filesystem.js";

/**
 * Writes `src/config/site.ts`, the only file a generated project has to edit
 * to change its tab title, favicon, description or social preview. Both
 * frameworks read it, so the values never have to be repeated per framework.
 */
export async function configureSite(
  projectDir: string,
  projectName: string,
): Promise<void> {
  const packageJson = await readJsonFile<PackageJson>(
    joinPath(projectDir, "package.json"),
  );
  await writeTextFile(
    joinPath(projectDir, SITE_CONFIG_PATH),
    siteConfigTs(siteValues({ projectName, packageJson })),
  );
}
