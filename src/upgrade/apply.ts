import { getFramework } from "../frameworks/index.js";
import type { PackageJson } from "../frameworks/types.js";
import { formatProject } from "../generators/configure-biome.js";
import { collectManagedFileHashes } from "../generators/configure-manifest.js";
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
  stagePaths,
  unstagePaths,
  workingTreeEntries,
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
  managedPackageJson,
} from "./managed-files.js";
import { serializeManifest } from "./manifest.js";
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

/**
 * The exact set of project-relative paths the upgrade commit stages: every
 * managed file the plan writes (including the ones it removes), the
 * non-managed files the flow itself updates (`package.json`, the lockfile,
 * `pnpm-workspace.yaml`, `raulmoracode.json` — the same list the rollback
 * restores) and the paths the applied migrations actually wrote or removed.
 * Sorted and de-duplicated so the `git add` command is deterministic and so
 * the branch can never pick up a file the upgrade did not touch.
 */
export function upgradeCommitPaths(
  plan: UpgradePlan,
  migrationPaths: string[] = [],
): string[] {
  return [
    ...new Set([
      ...plan.files.map((file) => file.path),
      ...REVERT_EXTRA_FILES,
      ...migrationPaths,
    ]),
  ].sort();
}

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

export interface MigrationRunResult {
  migrations: AppliedMigration[];
  /**
   * POSIX project-relative paths the applied migrations actually wrote or
   * removed, de-duplicated and in run order. Managed files are reported only
   * when the migration really wrote them (patchProjectFile skips absent,
   * unrecognizable and already-current files), so the commit scope stays exact.
   */
  touchedPaths: string[];
}

async function runMigrations(
  projectDir: string,
  plan: UpgradePlan,
  verbose: boolean,
): Promise<MigrationRunResult> {
  const context: MigrationContext = {
    projectDir,
    manifest: plan.manifest,
    verbose,
  };
  const applied: AppliedMigration[] = [];
  const touchedPaths: string[] = [];
  for (const migration of plan.migrations) {
    const result = await migration.run(context);
    applied.push({
      id: migration.id,
      version: migration.version,
      description: migration.description,
      why: migration.why,
    });
    for (const path of [...result.touched, ...result.removed]) {
      if (!touchedPaths.includes(path)) {
        touchedPaths.push(path);
      }
    }
  }
  return { migrations: applied, touchedPaths };
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

/**
 * Rewrites the manifest with the CLI version just applied and the hashes of
 * the files **as they are on disk after formatting**: the next upgrade must
 * compare against what this CLI left, not against the raw template, otherwise
 * Biome's own formatting would look like a local edit. Managed files that are
 * not on disk (deleted locally and left alone, or removed by a migration) are
 * omitted, the same rule `collectManagedFileHashes` applies when the project is
 * created: recording a template hash for an absent file would make the next
 * upgrade classify it as `new` instead of `deleted-locally`.
 */
export async function writeProjectManifest(
  projectDir: string,
  plan: UpgradePlan,
): Promise<ProjectManifest> {
  const files = await collectManagedFileHashes(
    projectDir,
    getFramework(plan.framework),
    plan.selection,
  );
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

export interface ApplyUpgradeResult {
  migrations: AppliedMigration[];
  /**
   * POSIX project-relative paths the applied migrations actually wrote or
   * removed: the commit must stage them alongside the plan files.
   */
  migrationPaths: string[];
}

export async function applyUpgradeFiles(
  params: ApplyUpgradeParams,
): Promise<ApplyUpgradeResult> {
  const { projectDir, plan, verbose } = params;

  await writeManagedFiles(projectDir, plan);
  const { migrations, touchedPaths } = await runMigrations(
    projectDir,
    plan,
    verbose,
  );
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
  await restoreNonPlanChanges(projectDir, plan, touchedPaths, verbose);
  await writeProjectManifest(projectDir, plan);

  return { migrations, migrationPaths: touchedPaths };
}

/**
 * Discards the formatting side effects the run caused on files that are NOT
 * part of the upgrade: `formatProject` runs Biome over the whole project, so a
 * file the plan does not touch can be reformatted, and `pnpm install` can
 * touch `pnpm-lock.yaml` (owned) but nothing else. The PR body promises that
 * nothing else is modified, and leaving those files reformatted would dirty
 * the user's working tree the moment the CLI switches back to their branch.
 *
 * Only tracked files can be restored from the index (`git restore`); Biome
 * rewrites existing files and never creates new ones, so everything it
 * reformatted is tracked. Untracked leftovers (if any) are left alone rather
 * than deleted (`git clean` is forbidden here). Safe because the preflight
 * proved the working tree was clean: the content being replaced is exactly
 * what this run itself changed, never user work.
 */
async function restoreNonPlanChanges(
  projectDir: string,
  plan: UpgradePlan,
  migrationPaths: string[],
  verbose: boolean,
): Promise<void> {
  const owned = new Set(upgradeCommitPaths(plan, migrationPaths));
  const toRestore: string[] = [];
  for (const { status, path } of await workingTreeEntries(
    projectDir,
    verbose,
  )) {
    if (status === "??" || status === "!!") {
      continue;
    }
    if (owned.has(path)) {
      continue;
    }
    toRestore.push(path);
  }
  if (toRestore.length === 0) {
    return;
  }
  await restorePaths(projectDir, toRestore, verbose);
}

export interface CommitUpgradeParams {
  projectDir: string;
  plan: UpgradePlan;
  verbose: boolean;
  onCommit?: (message: string) => void;
  /**
   * POSIX paths the applied migrations actually wrote or removed, forwarded
   * from `applyUpgradeFiles` so the commit stages them alongside the plan.
   */
  migrationPaths?: string[];
}

/**
 * Two Conventional Commits, staged separately: the first carries every change
 * except the managed files the user had modified, the second carries those
 * files alone so the overwrite is reviewable on its own.
 *
 * The staging is scoped to `upgradeCommitPaths()` — never `git add .` — so the
 * branch contains exactly what this upgrade wrote and nothing else, which is
 * what the pull request body claims.
 */
export async function commitUpgrade(
  params: CommitUpgradeParams,
): Promise<string[]> {
  const { projectDir, plan, verbose, onCommit, migrationPaths = [] } = params;
  const overwritten = plan.files
    .filter((file) => file.status === "overwritten")
    .map((file) => file.path);

  const commitPaths = upgradeCommitPaths(plan, migrationPaths);
  if (commitPaths.length > 0) {
    await stagePaths(projectDir, commitPaths, verbose);
  }
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
