import type { UpgradeNotes } from "./types.js";
import { compareVersions, isVersionInRange } from "./version.js";

/**
 * One entry per CLI release that changes generated projects. Every managed
 * template change must be explained here (enforced by the template snapshot
 * test). 1.0.8 is the baseline that introduced `raulmoracode.json`.
 */
export const UPGRADE_NOTES: UpgradeNotes[] = [
  {
    version: "1.5.1",
    summary:
      "The generated `vitest.config.ts` resolves the `@` alias to `src`, and the Next.js `typecheck` script generates the route types before running `tsc`, so tests and CI keep working after an upgrade.",
    changes: [
      {
        files: ["vitest.config.ts"],
        what: '`vitest.config.ts` now declares `resolve.alias` mapping `@` to `src` with `fileURLToPath(new URL("./src", import.meta.url))`, for both Vite and Next.js projects.',
        why: "Vitest does not read the `@/*` path mapping from `tsconfig.json` and does not inherit `vite.config.ts`, so a test importing `@/components/...` fails to resolve. `upgrade --adopt` re-rendered the file from the 1.5.0 template and removed a user-added alias, breaking `pnpm test` and the pre-commit hook.",
      },
      {
        files: [".github/workflows/ci.yml"],
        what: "The Next.js `typecheck` script is now `next typegen && tsc --noEmit`, and `package.json` receives it through the managed script patch. The CI workflow itself does not change, but its `pnpm typecheck` step now runs on a clean checkout.",
        why: "Next 16 generates the route types (`LayoutProps`, `PageProps`, ...) under `.next` only during `next dev`, `next build` or `next typegen`. The generated CI ran `tsc --noEmit` before `pnpm build`, so a clean clone failed with `TS2304: Cannot find name 'LayoutProps'`.",
      },
    ],
  },
  {
    version: "1.5.0",
    summary:
      "The generated AGENTS.md drops the Git guidance the skills catalog owns (no `## Git hooks and commits` section, no Git specialists in `## Skills` and no Git fallback rules), and the generated biome.json excludes Playwright's output (`playwright-report/` and `test-results`), so `pnpm check` and the pre-commit hook keep passing after an e2e run.",
    changes: [
      {
        files: ["AGENTS.md"],
        what: "The `## Git hooks and commits` section is gone (the `pre-commit`/`commit-msg` commands, the Conventional Commits type list, the commit examples and the subject-line rules), together with the `git-pr`, `git-branch`/`safe-git` and `release-engineering` bullets and the two Git fallback rules in `## Skills`. The catalog URL, the `raulmoracode-mode` entry point and the remaining fallbacks (pnpm, exact versions, verification, never delete the user's content) stay. The project tree still lists `.husky/` and `commitlint.config.ts` because they exist in the project.",
        why: "Commit conventions and Git etiquette are behavioural guidance, so they only change with a CLI release and drift from the catalog the project already loads. The 1.3.0 release moved that guidance to the catalog; the Git section was the remaining exception.",
      },
      {
        files: ["biome.json"],
        what: "`files.includes` now also excludes `playwright-report` and `test-results`. The upgrade re-renders `biome.json` with the extended list, keeping every other field.",
        why: "Biome does not read `.gitignore`, so the artifacts Playwright writes are linted and formatted as project files: the first `pnpm e2e` makes the next `pnpm check` fail with thousands of errors and the pre-commit hook aborts the commit.",
      },
    ],
  },
  {
    version: "1.3.0",
    summary:
      "The generated AGENTS.md stops carrying behavioural guidance and points at the shared @raulmoracode skills catalog instead (loaded through `.opencode/opencode.json`), and the CLI no longer writes `.github/pull_request_template.md`: pull request bodies are now produced by the `git-pr` skill, so the template is deleted on upgrade.",
    changes: [
      {
        files: ["AGENTS.md"],
        what: "AGENTS.md is now project facts only plus a new `## Skills` section. It keeps the intro, the dependency and configuration source-of-truth list (with a single line stating pnpm + exact versions), the project structure tree (which now lists `.opencode/opencode.json`), the tooling and scripts list, the shadcn/registry section, the validation command block (now including `pnpm typecheck`) and the site identity section. The `## Skills` section loads the catalog published at https://raulmoracode.github.io/raulmoracode-skills/, tells agents to start non-trivial work with `raulmoracode-mode` and lists the specialists (git-pr, git-branch/safe-git, test-before-finishing/verify-before-claiming/no-made-up-results, security-first, release-engineering, clear-final-report) with the non-negotiables as fallback. The general principles, code style, architecture, validation prose, Git etiquette, pull requests (with the embedded PR body template), changelog, security, adding-dependencies, environment-variables, deployment, working-with-existing-code and final-response sections are gone.",
        why: "Behavioural guidance duplicated into every generated project can only be corrected by shipping a new CLI version and drifts from the shared catalog the project already loads. Keeping only facts about this project — its files, scripts, hooks and site identity — makes the document cheap to keep accurate, while the catalog owns how to work.",
      },
      {
        files: [".github/pull_request_template.md"],
        what: "`.github/pull_request_template.md` is no longer generated and the upgrade deletes it (the `remove-pull-request-template` migration declares the path as removed, so the deletion is part of the plan and the commits). Pull request bodies are written from the real diff by the `git-pr` skill instead of a static checklist.",
        why: "The template duplicated what the skills catalog now owns and its checklist could only be fixed by shipping a new CLI version, going stale as soon as a project changed its scripts. Removing the file leaves the repository without a document nothing maintains.",
        action:
          "If you customised `.github/pull_request_template.md`, recover your version from the upgrade pull request diff (the upgrade commit deletes the file) before you merge it.",
      },
    ],
  },
  {
    version: "1.2.0",
    summary:
      "Ships an `.opencode/opencode.json` configuration that wires the @raulmoracode skills catalog into OpenCode, and guarantees through `.gitignore` negations that the `.opencode/` folder always travels with the repository.",
    changes: [
      {
        files: [".opencode/opencode.json"],
        what: "Every generated project now ships `.opencode/opencode.json`, pointing OpenCode at the @raulmoracode skills catalog (`https://raulmoracode.github.io/raulmoracode-skills/`), and `.gitignore` keeps the folder trackable with `!.opencode/` and `!.opencode/opencode.json`; the 1.2.0 migration merges both negations into existing projects.",
        why: "Coding sessions started in a generated project had to be told where the skills catalog lives, and dotfolder exclusions (a machine's global git excludes file or user patterns) could hide `.opencode/`, so the configuration must be committed for the whole team and for CI to see it. The negations are structural: they win over any ignore rule, and the merge keeps them idempotent.",
      },
    ],
  },
  {
    version: "1.1.0",
    summary:
      "Adds a `typecheck` script and restores TypeScript checking in the Vite build and in CI so type errors always fail the pipeline, ships a Dependabot configuration (.github/dependabot.yml) that keeps dependency updates automatic with exact-version PRs aligned with the pnpm minimumReleaseAge maturity gate, lets the project author and license be chosen at creation time (with the AGENTS.md tree labelling LICENSE as the project license instead of assuming MIT), and ships a `.env.example` per framework so the environment-variable workflow AGENTS.md documents is actually possible.",
    changes: [
      {
        files: [".env.example"],
        what: "Every generated project now ships a `.env.example` with commented placeholder variables (`VITE_*` on Vite, `NEXT_PUBLIC_*` plus a server-only variable on Next.js), and `.gitignore` keeps it trackable by negating the `.env.*` pattern (`!.env.example`).",
        why: "AGENTS.md instructed coding agents to copy `.env.example` to `.env`, but no generator wrote the file and the `.env.*` pattern in `.gitignore` matched it, so the template could not even be committed. Generating the file, exempting it from the ignore rules at creation time and adding it to the gitignore upgrade migration make the documented workflow real for new and upgraded projects.",
      },
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
      {
        files: ["playwright.config.ts"],
        what: "A new optional Playwright tech preset (E2E browser testing) ships `playwright.config.ts` (Chromium project, `webServer` on the framework dev server, `e2e/*.e2e.ts` in `testDir`), an `e2e` script (`playwright test`), the `@playwright/test` dev dependency pinned to `1.64.0`, an example `e2e/smoke.e2e.ts`, and a CI step that installs Chromium (`pnpm exec playwright install --with-deps chromium`) and runs `pnpm e2e`.",
        why: "Projects wanted end-to-end browser coverage on top of the Vitest unit tests; Playwright is the standard E2E runner for both Vite and Next.js, with exact-version pins consistent with the rest of the generated stack and the browser binary downloaded per the pinned package version.",
      },
      {
        files: ["AGENTS.md"],
        what: "The project structure tree in AGENTS.md (and the shared renderer that also feeds README.md) now reflects the files actually present on disk: `raulmoracode-create upgrade` detects the tree paths that exist in the project and re-renders AGENTS.md without the paths that no longer exist (a file the user deleted disappears from the tree instead of being resurrected; a directory is only kept when it exists or still has existing children).",
        why: "AGENTS.md is a managed file re-rendered on every upgrade, but it was rebuilt from the framework and the tech selection alone, so a user who deleted a file saw it reappear in the tree after the upgrade, contradicting the repository state the document itself tells agents to trust. Pruning the tree by what is on disk makes the guide match the project it documents.",
      },
      {
        files: [".github/pull_request_template.md"],
        what: "The pull request template is now selection-aware: `pnpm check` only appears when Biome is selected, `pnpm test` only with testing and `pnpm e2e` only with Playwright, while `pnpm typecheck` and `pnpm build` always appear. It also starts with a `<!-- Write the PR body in English -->` comment.",
        why: "The template hardcoded `pnpm check` and `pnpm test` in every project, so the checklist listed commands whose scripts did not exist in projects without Biome or testing; and pull request bodies were being written in Spanish while the project language is English.",
      },
      {
        files: ["AGENTS.md"],
        what: "The `## Pull requests` section now embeds the exact pull request body template through the same single source as `.github/pull_request_template.md` (selection-aware checklist) and explicitly tells agents to write pull request titles and bodies in English.",
        why: "The AGENTS.md embedded copy duplicated the template file and could diverge from it, and agents were generating pull request bodies in Spanish; the shared source keeps both copies in sync and the language rule makes PRs reviewable by anyone.",
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
