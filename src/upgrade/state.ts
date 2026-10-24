import { agentsStructure } from "../config/agents.js";
import { structurePaths } from "../config/project-structure.js";
import type { PackageJson } from "../frameworks/types.js";
import { joinPath, pathExists, readTextFile } from "../utils/filesystem.js";
import {
  ADOPTION_MARKER_PATHS,
  AdoptionError,
  type AdoptionFacts,
  buildAdoptionManifest,
  inferFramework,
  inferTechSelection,
  projectNameFrom,
  RETIRED_MANAGED_PATHS,
} from "./adopt.js";
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

async function readPackageJsonFile(projectDir: string): Promise<PackageJson> {
  try {
    const raw = await readIfExists(joinPath(projectDir, "package.json"));
    return raw === null ? {} : (JSON.parse(raw) as PackageJson);
  } catch {
    return {};
  }
}

async function existingPaths(
  projectDir: string,
  paths: readonly string[],
): Promise<string[]> {
  const existing: string[] = [];
  for (const path of paths) {
    if (await pathExists(joinPath(projectDir, ...path.split("/")))) {
      existing.push(path);
    }
  }
  return existing;
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

  const pkg = await readPackageJsonFile(projectDir);

  return {
    files,
    dependencies: {
      dependencies: { ...(pkg.dependencies ?? {}) },
      devDependencies: { ...(pkg.devDependencies ?? {}) },
    },
    existingTreePaths: await collectExistingTreePaths(projectDir, manifest),
  };
}

/**
 * Builds the manifest a project created before 1.0.8 never received, from the
 * facts on disk. Reads only: the manifest is never written here, so a declined
 * confirmation or a failed preflight leaves the project untouched. Throws
 * `AdoptionError` when the project cannot be identified instead of guessing.
 */
export async function readAdoptionManifest(
  projectDir: string,
  githubUrl: string,
): Promise<ProjectManifest> {
  if (!(await pathExists(joinPath(projectDir, "package.json")))) {
    throw new AdoptionError(
      "No se encontró package.json en el proyecto: no se puede adoptar un directorio que no parece un proyecto.",
    );
  }

  const packageJson = await readPackageJsonFile(projectDir);
  const facts: AdoptionFacts = {
    paths: await existingPaths(projectDir, ADOPTION_MARKER_PATHS),
    packageJson,
  };

  const framework = inferFramework(facts);
  if (framework === null) {
    throw new AdoptionError(
      "No se pudo determinar el framework del proyecto (Next.js o React + Vite) a partir de package.json y de la configuración del bundler.\n" +
        "--adopt necesita reconocer el proyecto para construir su manifest; se ha detenido sin escribir nada.",
    );
  }

  const selection = inferTechSelection(facts);
  const contents: Record<string, string> = {};
  for (const path of [
    ...Object.keys(managedFiles(framework, selection)),
    ...RETIRED_MANAGED_PATHS,
  ]) {
    const content = await readIfExists(
      joinPath(projectDir, ...path.split("/")),
    );
    if (content !== null) {
      contents[path] = content;
    }
  }

  return buildAdoptionManifest({
    framework,
    selection,
    projectName: projectNameFrom(packageJson, githubUrl),
    githubUrl,
    contents,
    packageJson,
  });
}
