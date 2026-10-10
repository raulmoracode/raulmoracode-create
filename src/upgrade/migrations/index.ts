import type { Migration } from "../types.js";
import { compareVersions, isVersionInRange } from "../version.js";
import { migrateGitignore } from "./gitignore.js";
import { migrateReadmeStructure } from "./readme.js";
import { migrateSiteConfig } from "./site-config.js";

export interface UpgradeMigration extends Migration {
  /**
   * Managed paths the migration deletes itself. A path is only reported as
   * `removed` when one of the selected migrations declares it; otherwise the
   * upgrade refuses to guess and reports it as needing attention.
   *
   * Migrations that only patch a file declare nothing here: listing a path
   * they keep would make the upgrade delete it the day the CLI stops
   * rendering it.
   */
  handles: string[];
}

/**
 * Ordered registry of one-off migrations. A migration runs once, when the
 * project crosses its version: `from < version <= to`. All of them patch a
 * file the CLI wrote but does not re-render (`.gitignore`, `src/config/site.ts`,
 * `README.md`), merging instead of overwriting so local edits survive.
 */
export const MIGRATIONS: UpgradeMigration[] = [
  migrateGitignore,
  migrateSiteConfig,
  migrateReadmeStructure,
];

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
