import type { UpgradeNotes } from "./types.js";
import { compareVersions, isVersionInRange } from "./version.js";

/**
 * One entry per CLI release that changes generated projects. Every managed
 * template change must be explained here (enforced by the template snapshot
 * test). 1.0.8 is the baseline that introduced `raulmoracode.json`.
 */
export const UPGRADE_NOTES: UpgradeNotes[] = [];

export function notesBetween(
  from: string,
  to: string,
  notes: UpgradeNotes[] = UPGRADE_NOTES,
): UpgradeNotes[] {
  return notes
    .filter((entry) => isVersionInRange(entry.version, from, to))
    .sort((a, b) => compareVersions(a.version, b.version));
}
