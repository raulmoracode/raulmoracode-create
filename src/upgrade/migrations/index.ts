import type { Migration } from "../types.js";
import { compareVersions, isVersionInRange } from "../version.js";

export interface UpgradeMigration extends Migration {
  /**
   * Managed paths the migration deletes itself. A path is only reported as
   * `removed` when one of the selected migrations declares it; otherwise the
   * upgrade refuses to guess and reports it as needing attention.
   */
  handles: string[];
}

/**
 * Ordered registry of one-off migrations. A migration runs once, when the
 * project crosses its version: `from < version <= to`. Empty today: the
 * templates are still compatible across the released versions.
 */
export const MIGRATIONS: UpgradeMigration[] = [];

export function isUpgradeMigration(
  migration: Migration,
): migration is UpgradeMigration {
  return Array.isArray((migration as Partial<UpgradeMigration>).handles);
}

export function selectMigrations(
  from: string,
  to: string,
  registry: Migration[] = MIGRATIONS,
): Migration[] {
  return registry
    .filter((migration) => isVersionInRange(migration.version, from, to))
    .sort((left, right) => compareVersions(left.version, right.version));
}

export function migrationHandledPaths(migrations: Migration[]): Set<string> {
  const handled = new Set<string>();
  for (const migration of migrations) {
    if (!isUpgradeMigration(migration)) {
      continue;
    }
    for (const path of migration.handles) {
      handled.add(path);
    }
  }
  return handled;
}
