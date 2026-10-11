import { agentsStructure } from "../config/agents.js";
import { structurePaths } from "../config/project-structure.js";
import type { PackageJson } from "../frameworks/types.js";
import { joinPath, pathExists, readTextFile } from "../utils/filesystem.js";
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
 * The tree paths of `AGENTS.md` that exist on disk: the re-rendered project
 * tree must reflect the current repository, so files the user deleted are
 * left out instead of being resurrected by the upgrade.
 */
async function collectExistingTreePaths(
  projectDir: string,
  manifest: ProjectManifest,
): Promise<string[]> {
  const existing: string[] = [];
  for (const path of structurePaths(
    agentsStructure(manifest.framework, manifest.selection),
  )) {
    const bare = path.endsWith("/") ? path.slice(0, -1) : path;
    if (await pathExists(joinPath(projectDir, ...bare.split("/")))) {
      existing.push(bare);
    }
  }
  return existing;
}

/**
 * Reads everything the plan needs from the project: the current content of
 * every managed path (missing files are `null`, never an error), the installed
 * dependency versions and the tree paths that exist on disk.
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
    existingTreePaths: await collectExistingTreePaths(projectDir, manifest),
  };
}
