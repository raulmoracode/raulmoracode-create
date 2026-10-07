import type { TechSelection } from "../config/tech.js";
import type { ProjectFramework } from "../frameworks/types.js";
import {
  managedDependencyPins,
  managedFiles,
} from "../upgrade/managed-files.js";
import { hashContent, serializeManifest } from "../upgrade/manifest.js";
import {
  MANIFEST_FILE,
  MANIFEST_VERSION,
  type ProjectManifest,
} from "../upgrade/types.js";
import {
  joinPath,
  pathExists,
  readTextFile,
  writeTextFile,
} from "../utils/filesystem.js";

export interface ManifestIdentity {
  framework: ProjectFramework;
  projectName: string;
  githubUrl: string;
  selection: TechSelection;
  cliVersion: string;
}

/** Pure: assembles the manifest from an already computed `files` map. */
export function buildProjectManifest(
  identity: ManifestIdentity,
  files: Record<string, string>,
): ProjectManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: identity.cliVersion,
    framework: identity.framework.id,
    selection: { ...identity.selection },
    projectName: identity.projectName,
    githubUrl: identity.githubUrl,
    files,
    dependencies: managedDependencyPins(
      identity.framework.id,
      identity.selection,
    ),
  };
}

/**
 * Hashes the managed templates from the content actually on disk and skips the
 * ones that do not exist (never applied by this selection). Callers must run
 * this after `formatProject`: Biome rewrites JSON and TS templates, so hashing
 * the pre-format bytes would make the very next `upgrade` see the CLI's own
 * formatting as a local edit.
 */
export async function collectManagedFileHashes(
  projectDir: string,
  framework: ProjectFramework,
  selection: TechSelection,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const paths = Object.keys(managedFiles(framework.id, selection)).sort();
  for (const path of paths) {
    const absolute = joinPath(projectDir, ...path.split("/"));
    if (!(await pathExists(absolute))) {
      continue;
    }
    files[path] = hashContent(await readTextFile(absolute));
  }
  return files;
}

/**
 * Writes `raulmoracode.json`, the record of what the CLI generated: identity
 * (framework, selection, name, remote), the CLI version and the sha256 of every
 * managed file it left on disk. `upgrade` uses it to tell the user's edits from
 * the CLI's, so it must be written before the initial commit.
 */
export async function configureManifest(
  projectDir: string,
  identity: ManifestIdentity,
): Promise<ProjectManifest> {
  const manifest = buildProjectManifest(
    identity,
    await collectManagedFileHashes(
      projectDir,
      identity.framework,
      identity.selection,
    ),
  );
  await writeTextFile(
    joinPath(projectDir, MANIFEST_FILE),
    serializeManifest(manifest),
  );
  return manifest;
}
