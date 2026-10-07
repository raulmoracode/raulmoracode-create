import type { PackageJson } from "../frameworks/types.js";
import type { ManagedPackageJson } from "./managed-files.js";
import type { DependencyChange } from "./types.js";

export function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~]/, "");
}

/**
 * Rewrites only the fields the CLI owns (`scripts`, `engines`,
 * `packageManager` and the planned pins, always exact) and preserves every
 * other field of the project `package.json`, including the ones the user
 * added after the project was generated.
 */
export function patchManagedPackageJson(
  pkg: PackageJson,
  managed: ManagedPackageJson,
  changes: DependencyChange[],
): PackageJson {
  const next: PackageJson = { ...pkg };
  next.scripts = { ...(pkg.scripts ?? {}), ...managed.scripts };
  next.engines = { ...(pkg.engines ?? {}), ...managed.engines };
  next.packageManager = managed.packageManager;

  const dependencies = { ...(pkg.dependencies ?? {}) };
  const devDependencies = { ...(pkg.devDependencies ?? {}) };
  for (const change of changes) {
    const target =
      change.type === "dependencies" ? dependencies : devDependencies;
    target[change.name] = stripRangePrefix(change.to);
  }
  if (Object.keys(dependencies).length > 0) {
    next.dependencies = dependencies;
  }
  if (Object.keys(devDependencies).length > 0) {
    next.devDependencies = devDependencies;
  }
  return next;
}
