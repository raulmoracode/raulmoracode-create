import type { PackageJson } from "../frameworks/types.js";
import { joinPath, readTextFile } from "../utils/filesystem.js";
import { managedFiles } from "./managed-files.js";
import type { ProjectDiskState } from "./plan.js";
import type { ProjectManifest } from "./types.js";

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readTextFile(path);
  } catch {
    return null;
  }
}

/**
 * Reads everything the plan needs from the project: the current content of
 * every managed path (missing files are `null`, never an error) and the
 * installed dependency versions.
 */
export async function readProjectState(
  projectDir: string,
  manifest: ProjectManifest,
): Promise<ProjectDiskState> {
  const templates = managedFiles(manifest.framework, manifest.selection);
  const files: Record<string, string | null> = {};
  for (const path of new Set([
    ...Object.keys(templates),
    ...Object.keys(manifest.files),
  ])) {
    files[path] = await readIfExists(joinPath(projectDir, path));
  }

  let pkg: PackageJson = {};
  try {
    const raw = await readIfExists(joinPath(projectDir, "package.json"));
    pkg = raw === null ? {} : (JSON.parse(raw) as PackageJson);
  } catch {
    pkg = {};
  }

  return {
    files,
    dependencies: {
      dependencies: { ...(pkg.dependencies ?? {}) },
      devDependencies: { ...(pkg.devDependencies ?? {}) },
    },
  };
}
