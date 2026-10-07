import type { TechSelection } from "../config/tech.js";
import type { Framework } from "../utils/validation.js";
import { managedFiles, managedPackageJson } from "./managed-files.js";
import { hashContent } from "./manifest.js";
import { migrationHandledPaths, selectMigrations } from "./migrations/index.js";
import { notesBetween } from "./notes.js";
import type {
  DependencyChange,
  DependencyType,
  FileChange,
  KeptDependency,
  Migration,
  ProjectManifest,
  SkippedFile,
  UpgradeNotes,
} from "./types.js";
import { compareVersions } from "./version.js";

export interface ProjectDiskState {
  /** Managed path → current content, or `null` when the file is missing. */
  files: Record<string, string | null>;
  dependencies: Record<DependencyType, Record<string, string>>;
}

export interface UpgradePlan {
  manifest: ProjectManifest;
  fromVersion: string;
  toVersion: string;
  framework: Framework;
  selection: TechSelection;
  branch: string;
  notes: UpgradeNotes[];
  files: FileChange[];
  skippedFiles: SkippedFile[];
  dependencies: DependencyChange[];
  keptDependencies: KeptDependency[];
  migrations: Migration[];
  /** Managed files the CLI no longer renders and no migration deletes. */
  needsAttention: string[];
}

export type UpgradeOutcome = "up-to-date" | "cli-outdated" | "upgrade";

export function upgradeBranchName(toVersion: string): string {
  return `chore/raulmoracode-update-${toVersion}`;
}

export function upgradeOutcome(from: string, to: string): UpgradeOutcome {
  const comparison = compareVersions(from, to);
  if (comparison === 0) {
    return "up-to-date";
  }
  return comparison > 0 ? "cli-outdated" : "upgrade";
}

const DEPENDENCY_TYPES: DependencyType[] = ["dependencies", "devDependencies"];

/**
 * Decides what to do with every managed file by comparing three hashes: the
 * template the CLI would write today, the hash the CLI recorded in the
 * manifest, and the hash of what is on disk. Pure: the caller passes the
 * on-disk state, so it can be tested without touching the filesystem.
 *
 * `deleted-locally` is only reported when there is nothing new to write: a
 * managed file the user deleted and whose template did not change stays
 * deleted. When the template did change, the file is recreated as `new`.
 */
export function classifyManagedFiles(params: {
  manifestFiles: Record<string, string>;
  templates: Record<string, string>;
  state: ProjectDiskState;
  handledRemovals: Set<string>;
}): {
  files: FileChange[];
  skippedFiles: SkippedFile[];
  needsAttention: string[];
} {
  const { manifestFiles, templates, state, handledRemovals } = params;
  const files: FileChange[] = [];
  const skippedFiles: SkippedFile[] = [];
  const needsAttention: string[] = [];
  const paths = [
    ...new Set([...Object.keys(templates), ...Object.keys(manifestFiles)]),
  ].sort();

  for (const path of paths) {
    const template = templates[path] ?? null;
    const recorded = manifestFiles[path] ?? null;
    const current = state.files[path] ?? null;
    const cliChanged =
      template !== null &&
      (recorded === null || hashContent(template) !== recorded);

    if (template === null) {
      if (current === null) {
        skippedFiles.push({ path, reason: "deleted-locally" });
        continue;
      }
      if (handledRemovals.has(path)) {
        files.push({
          path,
          status: "removed",
          previousContent: current,
          nextContent: null,
        });
        continue;
      }
      needsAttention.push(path);
      continue;
    }

    if (current === null) {
      if (recorded === null || cliChanged) {
        files.push({
          path,
          status: "new",
          previousContent: null,
          nextContent: template,
        });
        continue;
      }
      skippedFiles.push({ path, reason: "deleted-locally" });
      continue;
    }

    if (!cliChanged) {
      continue;
    }
    const locallyModified =
      recorded === null || hashContent(current) !== recorded;
    files.push({
      path,
      status: locallyModified ? "overwritten" : "updated",
      previousContent: current,
      nextContent: template,
    });
  }

  return { files, skippedFiles, needsAttention };
}

/**
 * Managed pins are bumped to the CLI's exact version even when the user moved
 * them (flagged with `hadLocalVersion`), but a pin the CLI no longer owns is
 * never removed: it is reported as `keptDependencies`.
 */
export function classifyDependencies(params: {
  manifestPins: Record<string, string>;
  managedPins: Record<DependencyType, Record<string, string>>;
  state: ProjectDiskState;
}): { dependencies: DependencyChange[]; keptDependencies: KeptDependency[] } {
  const { manifestPins, managedPins, state } = params;
  const dependencies: DependencyChange[] = [];

  for (const type of DEPENDENCY_TYPES) {
    for (const [name, to] of Object.entries(managedPins[type])) {
      const recorded = manifestPins[name] ?? null;
      const current = state.dependencies[type][name] ?? null;
      if (recorded === to && current === to) {
        continue;
      }
      dependencies.push({
        name,
        type,
        from: current,
        to,
        hadLocalVersion: current !== null && current !== recorded,
      });
    }
  }

  const stillManaged = new Set(
    DEPENDENCY_TYPES.flatMap((type) => Object.keys(managedPins[type])),
  );
  const keptDependencies: KeptDependency[] = Object.entries(manifestPins)
    .filter(([name]) => !stillManaged.has(name))
    .map(([name, pinned]) => ({ name, pinned, reason: "removed-locally" }));

  return { dependencies, keptDependencies };
}

export interface BuildUpgradePlanParams {
  manifest: ProjectManifest;
  toVersion: string;
  state: ProjectDiskState;
  templates?: Record<string, string>;
  notes?: UpgradeNotes[];
  migrations?: Migration[];
}

export function buildUpgradePlan(params: BuildUpgradePlanParams): UpgradePlan {
  const { manifest, toVersion, state } = params;
  const templates =
    params.templates ?? managedFiles(manifest.framework, manifest.selection);
  const migrations =
    params.migrations ?? selectMigrations(manifest.cliVersion, toVersion);
  const notes = params.notes ?? notesBetween(manifest.cliVersion, toVersion);
  const managed = managedPackageJson(manifest.framework, manifest.selection);

  const { files, skippedFiles, needsAttention } = classifyManagedFiles({
    manifestFiles: manifest.files,
    templates,
    state,
    handledRemovals: migrationHandledPaths(migrations),
  });
  const { dependencies, keptDependencies } = classifyDependencies({
    manifestPins: manifest.dependencies,
    managedPins: managed.dependencies,
    state,
  });

  return {
    manifest,
    fromVersion: manifest.cliVersion,
    toVersion,
    framework: manifest.framework,
    selection: manifest.selection,
    branch: upgradeBranchName(toVersion),
    notes,
    files,
    skippedFiles,
    dependencies,
    keptDependencies,
    migrations,
    needsAttention,
  };
}

export function planOverwrittenFiles(plan: UpgradePlan): string[] {
  return plan.files
    .filter((file) => file.status === "overwritten")
    .map((file) => file.path);
}

export function planHasWork(plan: UpgradePlan): boolean {
  return (
    plan.files.length > 0 ||
    plan.dependencies.length > 0 ||
    plan.migrations.length > 0
  );
}
