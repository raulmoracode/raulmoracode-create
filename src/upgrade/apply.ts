import { getFramework } from "../frameworks/index.js";
import type { PackageJson } from "../frameworks/types.js";
import { formatProject } from "../generators/configure-biome.js";
import {
  normalizePackageJson,
  pnpmInstallArgs,
  refreshPnpmWorkspaceExcludes,
} from "../generators/configure-project.js";
import {
  commitWithMessage,
  createBranch,
  fetchOrigin,
  restorePaths,
  stageAll,
  stagePaths,
  unstagePaths,
} from "../git/upgrade.js";
import { exec } from "../utils/exec.js";
import {
  joinPath,
  makeExecutable,
  readTextFile,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";
import {
  EXECUTABLE_MANAGED_FILES,
  managedDependencyPins,
  managedFiles,
  managedPackageJson,
} from "./managed-files.js";
import { hashContent, serializeManifest } from "./manifest.js";
import { patchManagedPackageJson } from "./package-json.js";
import type { UpgradePlan } from "./plan.js";
import {
  type AppliedMigration,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  type MigrationContext,
  type ProjectManifest,
} from "./types.js";

export function upgradeCommitMessage(toVersion: string): string {
  return `chore: upgrade raulmoracode-create to ${toVersion}`;
}

export const OVERWRITE_COMMIT_MESSAGE =
  "chore: overwrite locally modified files";

export interface PrepareBranchParams {
  projectDir: string;
  plan: UpgradePlan;
  verbose: boolean;
  detectBase: () => Promise<string>;
}

export async function prepareUpgradeBranch(
  params: PrepareBranchParams,
): Promise<{ base: string }> {
  const { projectDir, plan, verbose, detectBase } = params;
  await fetchOrigin(projectDir, verbose);
  const base = await detectBase();
  await createBranch(projectDir, plan.branch, `origin/${base}`, verbose);
  return { base };
}

export interface ApplyUpgradeParams {
  projectDir: string;
  plan: UpgradePlan;
  verbose: boolean;
}

async function writeManagedFiles(
  projectDir: string,
  plan: UpgradePlan,
): Promise<void> {
  for (const file of plan.files) {
    const target = joinPath(projectDir, file.path);
    if (file.status === "removed" || file.nextContent === null) {
      await removeIfExists(target);
      continue;
    }
    await writeTextFile(target, file.nextContent);
    if (EXECUTABLE_MANAGED_FILES.includes(file.path)) {
      await makeExecutable(target);
    }
  }
}

async function runMigrations(
  projectDir: string,
  plan: UpgradePlan,
  verbose: boolean,
): Promise<AppliedMigration[]> {
  const context: MigrationContext = {
    projectDir,
    manifest: plan.manifest,
    verbose,
  };
  const applied: AppliedMigration[] = [];
  for (const migration of plan.migrations) {
    await migration.run(context);
    applied.push({
      id: migration.id,
      version: migration.version,
      description: migration.description,
      why: migration.why,
    });
  }
  return applied;
}

async function patchProjectPackageJson(
  projectDir: string,
  plan: UpgradePlan,
): Promise<void> {
  const packageJsonPath = joinPath(projectDir, "package.json");
  const pkg = JSON.parse(await readTextFile(packageJsonPath)) as PackageJson;
  const patched = patchManagedPackageJson(
    pkg,
    managedPackageJson(plan.framework, plan.selection),
    plan.dependencies,
  );
  await writeTextFile(packageJsonPath, `${JSON.stringify(patched, null, 2)}\n`);
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readTextFile(path);
  } catch {
    return null;
  }
}

/**
 * Rewrites the manifest with the CLI version just applied and the hashes of
 * the files **as they are on disk after formatting**: the next upgrade must
 * compare against what this CLI left, not against the raw template, otherwise
 * Biome's own formatting would look like a local edit.
 */
export async function writeProjectManifest(
  projectDir: string,
  plan: UpgradePlan,
): Promise<ProjectManifest> {
  const templates = managedFiles(plan.framework, plan.selection);
  const files: Record<string, string> = {};
  for (const path of Object.keys(templates).sort()) {
    const onDisk = await readIfExists(joinPath(projectDir, path));
    files[path] =
      onDisk === null
        ? hashContent(templates[path] ?? "")
        : hashContent(onDisk);
  }
  const next: ProjectManifest = {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: plan.toVersion,
    framework: plan.framework,
    selection: plan.selection,
    projectName: plan.manifest.projectName,
    githubUrl: plan.manifest.githubUrl,
    files,
    dependencies: managedDependencyPins(plan.framework, plan.selection),
  };
  await writeTextFile(
    joinPath(projectDir, MANIFEST_FILE),
    serializeManifest(next),
  );
  return next;
}

export async function applyUpgradeFiles(
  params: ApplyUpgradeParams,
): Promise<AppliedMigration[]> {
  const { projectDir, plan, verbose } = params;

  await writeManagedFiles(projectDir, plan);
  const appliedMigrations = await runMigrations(projectDir, plan, verbose);
  await patchProjectPackageJson(projectDir, plan);
  await refreshPnpmWorkspaceExcludes(
    projectDir,
    getFramework(plan.framework),
    verbose,
    plan.selection,
  );
  await exec("pnpm", pnpmInstallArgs(), { cwd: projectDir, verbose });
  await normalizePackageJson(projectDir);
  if (plan.selection.biome) {
    await formatProject(projectDir, verbose);
  }
  await writeProjectManifest(projectDir, plan);

  return appliedMigrations;
}

export interface CommitUpgradeParams {
  projectDir: string;
  plan: UpgradePlan;
  verbose: boolean;
  onCommit?: (message: string) => void;
}

/**
 * Two Conventional Commits, staged separately: the first carries every change
 * except the managed files the user had modified, the second carries those
 * files alone so the overwrite is reviewable on its own.
 */
export async function commitUpgrade(
  params: CommitUpgradeParams,
): Promise<string[]> {
  const { projectDir, plan, verbose, onCommit } = params;
  const overwritten = plan.files
    .filter((file) => file.status === "overwritten")
    .map((file) => file.path);

  await stageAll(projectDir, verbose);
  if (overwritten.length > 0) {
    await unstagePaths(projectDir, overwritten, verbose);
  }
  const message = upgradeCommitMessage(plan.toVersion);
  await commitWithMessage(projectDir, message, verbose);
  onCommit?.(message);
  const commits = [message];

  if (overwritten.length > 0) {
    await stagePaths(projectDir, overwritten, verbose);
    await commitWithMessage(projectDir, OVERWRITE_COMMIT_MESSAGE, verbose);
    onCommit?.(OVERWRITE_COMMIT_MESSAGE);
    commits.push(OVERWRITE_COMMIT_MESSAGE);
  }

  return commits;
}

const REVERT_EXTRA_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  MANIFEST_FILE,
];

/**
 * Undoes, on the original branch, exactly the files this run wrote: files that
 * did not exist before are deleted, the rest are restored from the index.
 * Safe precisely because the preflight proved the working tree was clean, so
 * the indexed content is the user's own.
 */
export async function revertAppliedFiles(
  projectDir: string,
  plan: UpgradePlan,
  verbose: boolean,
): Promise<void> {
  const created: string[] = [];
  const restored: string[] = [];
  for (const file of plan.files) {
    if (file.previousContent === null) {
      created.push(file.path);
      continue;
    }
    restored.push(file.path);
  }
  if (created.length > 0) {
    for (const path of created) {
      await removeIfExists(joinPath(projectDir, path));
    }
  }
  const tracked = [...new Set([...restored, ...REVERT_EXTRA_FILES])];
  if (tracked.length === 0) {
    return;
  }
  try {
    await restorePaths(projectDir, tracked, verbose);
  } catch {
    // Best effort: a file that was never tracked cannot be restored, and the
    // real error has already been reported to the user.
  }
}
