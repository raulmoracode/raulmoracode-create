import type { UpgradeNotes } from "./types.js";
import { compareVersions, isVersionInRange } from "./version.js";

/**
 * One entry per CLI release that changes generated projects. Every managed
 * template change must be explained here (enforced by the template snapshot
 * test). 1.0.8 is the baseline that introduced `raulmoracode.json`.
 */
export const UPGRADE_NOTES: UpgradeNotes[] = [
  {
    version: "1.0.9",
    summary:
      "Dynamic AGENTS.md and CI workflow that adapt to the selected tech preset, new pull request template, upgrade migrations framework, and fixes for manifest parity, README structure tree and Vite siteHead without Tailwind.",
    changes: [
      {
        files: ["AGENTS.md"],
        what: "AGENTS.md now renders the project structure tree dynamically based on the framework and the selected technologies, instead of shipping a single static tree.",
        why: "A static tree listed files that the user's selection never produced (e.g. .husky/ without Husky, vitest.config.ts without testing), which confused coding agents working on the project.",
      },
      {
        files: [".github/workflows/ci.yml"],
        what: "The CI workflow template now emits `pnpm check` only when Biome is selected and `pnpm test` only when testing is selected.",
        why: "A core-only project shipped a CI workflow that ran commands whose scripts did not exist in package.json, causing the CI job to fail on every push.",
      },
      {
        files: [".github/pull_request_template.md"],
        what: "A new pull request template (.github/pull_request_template.md) is written in every generated project, providing a structured PR body (Summary, Changes, How to test, Validation, Breaking changes).",
        why: "Generated projects had no PR template, so every PR started from a blank body and contributors had to remember the expected structure.",
      },
    ],
  },
];

export function notesBetween(
  from: string,
  to: string,
  notes: UpgradeNotes[] = UPGRADE_NOTES,
): UpgradeNotes[] {
  return notes
    .filter((entry) => isVersionInRange(entry.version, from, to))
    .sort((a, b) => compareVersions(a.version, b.version));
}
