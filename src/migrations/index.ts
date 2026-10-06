import { socialMetaMigration } from "./social-meta.js";
import type { Migration } from "./types.js";

/**
 * Ordered registry. The order is the order in which migrations are applied and
 * ids must stay stable: they are written to `raulmoracode.json`, so renaming
 * one would make existing projects re-run it.
 */
export const MIGRATIONS: Migration[] = [socialMetaMigration];

export const MIGRATION_IDS: string[] = MIGRATIONS.map(
  (migration) => migration.id,
);
