import type { UpgradeNotes } from "./types.js";
import { compareVersions, isVersionInRange } from "./version.js";

/**
 * One entry per CLI release that changes generated projects. Every managed
 * template change must be explained here (enforced by the template snapshot
 * test). 1.0.8 is the baseline that introduced `raulmoracode.json`.
 */
export const UPGRADE_NOTES: UpgradeNotes[] = [
  {
    version: "1.1.0",
    summary:
      "Adds a `typecheck` script and restores TypeScript checking in the Vite build and in CI so type errors always fail the pipeline, ships a Dependabot configuration (.github/dependabot.yml) that keeps dependency updates automatic with exact-version PRs aligned with the pnpm minimumReleaseAge maturity gate, and lets the project author and license be chosen at creation time (with the AGENTS.md tree labelling LICENSE as the project license instead of assuming MIT).",
    changes: [
      {
        files: ["AGENTS.md"],
        what: 'The project structure tree in AGENTS.md now labels `LICENSE` as "project license" instead of "MIT license".',
        why: "Generated projects can now pick MIT, Apache-2.0, a proprietary notice or no license at all, so the tree must not claim the LICENSE file is always MIT.",
      },
      {
        files: [".github/workflows/ci.yml"],
        what: "The CI workflow now runs `pnpm typecheck` on every push and PR, and the Vite build script is `tsc -b && vite build` again (as create-vite ships it), so TypeScript errors fail the pipeline instead of being erased by esbuild.",
        why: "The generated Vite projects had `vite build` as the build script, which transpiles with esbuild without type checking, so a TypeScript error never broke `pnpm build` nor CI.",
      },
      {
        files: ["AGENTS.md"],
        what: "AGENTS.md documents the new `pnpm typecheck` script and mentions it in the CI workflow description.",
        why: "The generated project guide must list the actual scripts and CI steps so coding agents run and expect the type checker.",
      },
      {
        files: ["vite.config.ts"],
        what: 'The `vite.config.ts` template now imports the site config with an explicit `.js` extension (`import { site } from "./src/config/site.js"`).',
        why: "create-vite's `tsconfig.node.json` type-checks `vite.config.ts` with `moduleResolution: nodenext`, which requires explicit extensions on relative imports; the extensionless import made the restored `tsc -b` type check fail.",
      },
      {
        files: [".github/dependabot.yml"],
        what: "Every generated project now ships a .github/dependabot.yml that opens weekly npm-ecosystem update PRs with `versioning-strategy: increase` (exact versions stay exact, never ranges), a 7-day cooldown that mirrors the `minimumReleaseAge: 10080` gate in pnpm-workspace.yaml, and one grouped PR for minor and patch bumps. Majors stay individual PRs.",
        why: "Updating dependencies was manual, and naive automation broke against the maturity gate: Dependabot would propose a release younger than 7 days that pnpm refuses to install. The cooldown mirrors the gate so Dependabot only proposes versions pnpm accepts, while security updates (exempt from the cooldown) still open immediately.",
      },
    ],
  },
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
