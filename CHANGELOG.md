# Changelog

All notable changes to `@raulmoracode/create` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-10-18

### Changed

- **The generated `AGENTS.md` now delegates behavioural guidance to the skills
  catalog**: it keeps only project facts — intro, dependency and configuration
  sources of truth, project tree (which now lists `.opencode/opencode.json`),
  tooling and scripts (now including `pnpm typecheck`), shadcn section,
  validation commands, hooks and site identity — plus a new `## Skills`
  section that loads the @raulmoracode catalog
  (`https://raulmoracode.github.io/raulmoracode-skills/`), names
  `raulmoracode-mode` as the entry point for non-trivial work, lists the
  specialists and states the non-negotiables as fallback. The duplicated
  principles, code style, git etiquette, pull-request bodies, changelog,
  security and deployment sections are gone, so behavioural fixes ship in the
  catalog instead of a new CLI release.

### Removed

- **`.github/pull_request_template.md` is no longer generated**: pull request
  bodies are written from the real diff by the `git-pr` skill. The 1.3.0
  upgrade migration deletes the template from existing projects, and the
  upgrade note explains how to recover local customizations before merging.

## [1.2.0] - 2026-10-18

### Added

- **OpenCode skills catalog config** (`.opencode/opencode.json`) in every
  generated project: the project-level OpenCode configuration loads the shared
  @raulmoracode skills catalog
  (`https://raulmoracode.github.io/raulmoracode-skills/`), so a coding session
  started in the repository discovers the skills with no manual setup. The file
  is registered as a managed file, and `.gitignore` keeps the folder trackable
  with the structural negations `!.opencode/` and `!.opencode/opencode.json`
  (appended last, so they win over any ignore rule and a machine's global git
  excludes can no longer hide the configuration). The gitignore upgrade
  migration (bumped to 1.2.0) merges both negations into existing projects,
  idempotently.

## [1.1.1] - 2026-10-12

### Fixed

- **Upgrade works again on every existing project**: manifests written by
  CLI ≤ 1.0.9 (which predate the `playwright` tech id) now parse — missing
  selection ids default to `false` instead of making `upgrade` fail with
  `"selection.playwright" debe ser true o false`. The `upgrade` command is
  usable from projects created with any earlier version.
- **Upgrade rollback now restores migration-written files**: if `pnpm install`
  (or any later step) fails after the migrations wrote `.gitignore`,
  `README.md` or `src/config/site.ts`, `revertAppliedFiles` undoes them too —
  the working tree is no longer left dirty with half-applied migrations,
  matching the documented "undoes exactly the files this run wrote".
- **Upgrade fetches before building the plan**: a network failure now aborts
  before any prompt (fail-fast), and the plan/summary/warnings see fresh
  `origin/<base>` refs instead of whatever the last manual fetch left behind.
- **Upgrade commit is scoped to the plan**: `git add .` is gone from the
  upgrade — only the plan paths + flow files (`package.json`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `raulmoracode.json`) + migration
  paths are committed, and formatting noise outside the plan is restored. The
  PR body's "nothing else is modified" is now true.
- **Upgrade stops cleanly when there is nothing to do**: when the plan has no
  work, the run ends with "already up to date" and exit 0 instead of asking to
  confirm and opening a PR that only touched `raulmoracode.json`.

### Added

- **`upgrade --check` (alias `--dry-run`)**: runs the same preflights, reads
  the state and shows the full plan (files, dependencies, migrations,
  overwrite warnings) **without writing anything** — exit 1 if changes are
  pending, exit 0 if up to date. Pairs with the fetch-before-plan fix so you
  see the drift before committing.

## [1.1.0] - 2026-10-11

### Added

- **Playwright as an optional tech preset** (`@playwright/test@1.64.0`): a
  `playwright.config.ts` (Chromium, `webServer` on the framework dev server,
  `e2e/*.e2e.ts`), an `e2e` script, an example `e2e/smoke.e2e.ts`, and a CI
  step that installs Chromium and runs `pnpm e2e`. Independent from the
  Vitest `testing` preset; no cascade in either direction.
- **Dependabot** (`.github/dependabot.yml`) in every generated project:
  weekly npm-ecosystem PRs, `versioning-strategy: increase` so exact pins stay
  exact, a 7-day cooldown mirroring the `minimumReleaseAge` gate, one grouped
  PR for minor+patch, majors individual. Registered as a managed file.
- **`.env.example`** in every generated project (Vite `VITE_*` / Next.js
  `NEXT_PUBLIC_*` placeholders), making the environment workflow documented in
  the generated `AGENTS.md` actually possible. The gitignore now negates it
  (`!.env.example`) and the upgrade migration (bumped to 1.1.0) adds it to
  existing projects.
- **`.vscode/settings.json` is now tracked** in Vite projects: the create-vite
  `.vscode/*` glob no longer swallows it, so editor configuration ships with
  the repo (Next projects already tracked it). New upgrade migration
  `vscode-settings-tracked`.
- **Author and license prompts**: scaffolding now asks for the project author
  (default `Raul Mora`, just press Enter) and the license (`MIT` default,
  `Apache-2.0`, `UNLICENSED`, or none). `package.json` and `LICENSE` reflect
  the answers; the upgrade preserves them (they are not managed fields).
- **Branch protection after the first push** (best-effort): the scaffold
  applies a GitHub ruleset to `main` requiring pull requests and the
  `validate` status check. If `gh` is missing or the API fails, the project
  still succeeds and the exact manual `gh api` command is printed.
- **`typecheck` script** (`tsc -b` on Vite, `tsc --noEmit` on Next) and a
  `typecheck` step in the generated CI.
- **Layer invariants test** (`tests/layer-invariants.test.ts`): a static
  import scan over `src/` that enforces the §3 rules (Clack layering, I/O
  through `filesystem.ts`, processes through `exec.ts`, `git/`↔`github/`
  isolation, `upgrade/` contract vs orchestration).

### Changed

- **The generated AGENTS.md project tree now reflects the project state**:
  `upgrade` prunes the tree by what actually exists on disk, so files the user
  deleted no longer reappear listed after an upgrade. The shared renderer
  (`project-structure.ts`) feeds both the AGENTS.md and README trees.
- **The pull request template is a single source**, selection-aware
  (checklist gates `pnpm check`/`test`/`e2e` by the selected techs, always
  `typecheck`/`build`), embedded in both `.github/pull_request_template.md`
  and the generated AGENTS.md `## Pull requests` section, with an explicit
  rule that PR titles and bodies are written in English.
- `upgrade` now caps oversized pull request bodies (`truncateForGithub`
  wired into the PR creation), so `gh pr create` never fails after the branch
  was already pushed.
- `upgrade/` purity claim in the docs corrected: contract modules are pure,
  orchestration (preflight/apply/state/migrations) uses I/O and processes
  exclusively through the utils layer — matching the enforced invariants.
- AGENTS.md test table synced with the real suite (30/30 files documented).

### Fixed

- **Generated Vite projects are now typechecked**: `vite build` had replaced
  create-vite's `tsc -b && vite build`, so a TypeScript error never failed the
  build or CI. A latent TS2835 in the `vite.config.ts` template (extensionless
  `site` import) surfaced and was fixed.
- The upgrade rollback now restores migration-written files (`.gitignore`,
  `README.md`, `src/config/site.ts`), matching the documented guarantee.
- `github/default-branch.ts` no longer imports from `git/` (the §3 layer rule);
  the `origin/HEAD` fallback moved to the orchestrator.

## [Unreleased]

Nothing pending yet.

## [1.0.9] - 2026-10-10

### Added

- Pull request template (`.github/pull_request_template.md`) in every generated
  project, so every PR opened against the scaffolded repo starts with a
  structured body (Summary, Changes, How to test, Validation checklist, Breaking
  changes).
- Upgrade migrations framework: `upgrade/` now ships an ordered, per-version
  migration registry (`upgrade/migrations/`) that `applyUpgradeFiles` runs after
  writing the templates, so a release can move or reshape files that the simple
  re-render cannot reach. `runUpgrade` executes them in ascending version order
  between the manifest's `cliVersion` and the current one.

### Changed

- `AGENTS.md` now renders the project structure tree dynamically from the
  framework and the tech selection instead of shipping a static tree, so the
  generated guide always matches the files actually on disk. The CI section is
  also conditional: it only mentions steps and files that the selected preset
  produces.
- `.github/workflows/ci.yml` template now adapts its steps to the selected
  preset: `pnpm check` is only emitted when Biome is selected, and `pnpm test`
  only when testing is selected, so a core-only project does not ship a CI
  workflow that runs commands whose scripts are absent.
- Synced `docs/PROJECT_SPEC.md` and `README.md` with the current run
  flow: branding, starter and theme steps now match what `run.ts` actually
  executes, and the theme pin references the exact `shadcn@4.21.0` /
  `tw-animate-css@1.4.0` pair used by the scaffolder.

### Fixed

- `raulmoracode.json` manifest now records the sha256 of every managed file
  that is actually present on disk for the chosen selection, so projects
  generated without Husky, testing or VS Code no longer carry hashes for files
  that do not exist. The `dependencies` map also matches the exact set of pins
  the CLI wrote, not the full preset.
- Generated `README.md` now ships the gated structure tree that the CI,
  CHANGELOG and site-identity sections already promised: `.github/workflows/`,
  `CHANGELOG.md`, framework-specific files, and the per-preset optional files
  (`commitlint.config.ts`, `.husky/`, `vitest.config.ts`, `.vscode/`,
  `LICENSE`, `src/config/site.ts`, Next error pages) only appear when the
  matching technology is selected.
- Vite `siteHead()` plugin no longer injects the Tailwind entry CSS import or
  references the Tailwind plugin when Tailwind is not selected, so a core-only
  Vite scaffold builds without a missing-module error.

## [1.0.8] - 2026-10-07

### Added

- `raulmoracode-create upgrade`: brings later CLI improvements to projects
  generated by this CLI. Run it inside a project (`pnpm dlx
  @raulmoracode/create@latest upgrade`) and it re-applies the managed
  configuration, runs any migration published in between, and opens a
  **ready-for-review pull request** (never draft) that you merge yourself.
  Managed files you had edited are overwritten in place, never left as `.new`:
  the terminal warns before it happens, the pull request opens with a
  dedicated section showing your version against the new template plus what
  changed and why, and those files are isolated in a second commit
  (`chore: overwrite locally modified files`). The tool refuses to run on a
  dirty working tree, never touches the current branch, never pushes with
  force, and reverts the files it wrote if a step fails.
- `raulmoracode.json` in every generated project: the CLI version, framework,
  selected technologies, project identity and a sha256 per managed file.
  Written after formatting and committed in `chore: initial project setup`, so
  `upgrade` can tell your edits from the CLI's. Projects created before 1.0.8
  are not eligible and the command says so instead of guessing.
- `UPGRADE_NOTES` (per release: what changed, why, and what the user must do)
  plus a stored template snapshot and a test that fails when a managed template
  or pin changes without the matching note, so no release can ship an
  unexplained change.
- Pull request bodies for upgrades are generated purely from the upgrade report
  (summary with counts, overwritten files, changes per version, dependencies,
  migrations, action items, commits) and are trimmed only in their diff
  sections if they exceed the GitHub limit.

### Changed

- `AGENTS.md` documents the new `src/upgrade/` and `src/github/` layers, the
  manifest, the notes requirement and the `upgrade` safety rules; `README.md`
  documents the command and the manifest.

## [1.0.7] - 2026-10-07

### Added

- pnpm major version preflight: the CLI now validates the output of
  `pnpm --version` (reusing the existing call, no extra process) and aborts
  before the first prompt when the active pnpm major is not 12, with an
  actionable Spanish message (`corepack enable && corepack prepare
  pnpm@12.6.0 --activate`). The required major is derived from `PNPM_VERSION`,
  so it has a single source of truth. New pure `satisfiesPnpmVersion()` plus
  `tests/preflight.test.ts`.
- Weekly scheduled E2E workflow (`.github/workflows/e2e-scheduled.yml`,
  Mondays 06:00 UTC + `workflow_dispatch`) running both framework E2Es to
  detect breakage outside the pinned versions (transitive dependencies,
  `registry.raulmoracode.com`, GitHub/npm). Observe-only: it never updates
  pins or the lockfile. Covered by `tests/e2e-scheduled-workflow.test.ts`.

### Changed

- The E2E suite is now opt-in: plain `pnpm test` skips `tests/e2e.test.ts`
  unless `E2E_FRAMEWORK` is `vite` or `next`, so the default test run is fast,
  offline and independent of the local Node version. The dedicated
  `e2e-vite`/`e2e-next` CI jobs still run it on every push and pull request.
- E2E failures now report the real cause: `process.exit` is mocked and the
  `log.error` messages are surfaced in the failure, instead of an opaque
  `expected false to be true` assertion. Leftover debug logging removed.
- `AGENTS.md` documents the opt-in E2E, the scheduled workflow, the pnpm
  major gate and the release procedure.

## [1.0.6] - 2026-10-06

### Added

- CI workflow template for generated projects: every scaffolded project now
  ships `.github/workflows/ci.yml`, running `pnpm install`, `pnpm check`,
  `pnpm test` and `pnpm build` on every push and pull request. No deployments,
  no external services: validation only, so generated projects are not tied to
  any hosting provider.
- `CHANGELOG.md` in generated projects (Keep a Changelog format with an
  `[Unreleased]` section), plus a `Changelog` section in the generated
  `AGENTS.md` instructing coding agents to keep it updated with every notable
  change.
- Expanded the generated `AGENTS.md` with the context an agent needs to work
  on the project: annotated project structure, exact-version dependency
  policy (`pnpm add <pkg>@<version>`, no `^`/`~`), Conventional Commits format
  with types and style rules, watch vs single-run tests (`CI=true pnpm test`),
  environment variables (`.env.example`, `VITE_*` vs `NEXT_PUBLIC_*`) and
  manual, provider-agnostic deployment.
- Dedicated `e2e-vite` job in this repository's CI, symmetric to `e2e-next`, so
  each framework's end-to-end coverage has its own isolated signal instead of
  Vite's running implicitly inside the `validate` job.
- `Continuous integration` section and completed structure tree in the
  generated `README.md`: `.github/workflows/`, `CHANGELOG.md`,
  `src/config/site.ts`, Next.js `error.tsx`/`not-found.tsx`, conditional
  Husky/Biome/Vitest/VS Code files and `LICENSE`.

## [1.0.5] - 2026-10-06

### Added

- `src/app/error.tsx` and `src/app/not-found.tsx` in generated Next.js
  projects. Both are Next.js file conventions, so they are picked up with no
  wiring: the error boundary with its `reset` callback and a real 404 page.
  They use only Tailwind utilities that exist in every project rather than theme
  tokens, and the error component is named `ErrorPage` because Biome's
  `noShadowRestrictedNames` rejects a function called `Error` in the generated
  project.

- `src/config/site.ts` in generated projects: one user-owned file with the site
  `name`, `title`, `description`, `url`, `favicon`, `socialImage`,
  `socialImageAlt`, `author`, `twitter`, `locale` and `themeColor`. Both
  frameworks read it, so the tab title, the favicon and the social preview
  (`twitter:*` and `og:*`, for X, WhatsApp, Slack or LinkedIn) are defined in a
  single place instead of being duplicated in `index.html` and
  `src/app/layout.tsx`. On React + Vite a `siteHead()` plugin in
  `vite.config.ts` injects the head tags through `transformIndexHtml`; on
  Next.js the `metadata` export reads the same object. Changing the title,
  description, favicon or preview image later is a one-file edit.
  `favicon` and `socialImage` accept either a full URL or a local path under
  `public/`; the CLI generates no image, the project provides it. Local paths are
  resolved against `url` when it is set, since social crawlers cannot resolve
  relative URLs. Defaults use the project name and the real pinned stack, read from
  `package.json`. `description` is empty on purpose and empty values are never
  rendered, so the HTML never carries a blank meta tag.

- Generated projects include the **MIT `LICENSE`** (with the project author and
  the current year) and `"license": "MIT"` in `package.json`, so a new project is
  publishable without having to add either by hand.

## [1.0.4] - 2026-10-06

### Fixed

- `pnpm-workspace.yaml` is no longer written with double-quoted
  `minimumReleaseAgeExclude` entries, which made it invalid YAML and aborted the
  run at `Initializing Git` with `invalid trailing content after single-quoted
  scalar` when `pnpm exec husky` loaded the configuration. Entries that already
  arrive quoted (the shadcn CLI writes its own exclude block when the registry
  theme is applied) are now unquoted before merging and re-quoted exactly once;
  exclusions are also sorted for a deterministic output.

## [1.0.3] - 2026-09-29

### Added

- shadcn registry wiring in generated projects: `components.json` declares the
  `@raulmoracode` registry, tsconfigs gain aliases for registry file targets
  (`@components/*`, `@lib/*`, `@hooks/*`), and `pnpm-workspace.yaml` excludes
  the `@raulmoracode/*` scope from `minimumReleaseAge`, so
  `pnpm dlx shadcn@4.21.0 add @raulmoracode/<component>` works out of the box.
- Generated project `README.md` (overwrites the scaffolder default): project
  title, requirements, scripts table from the final `package.json`, selected
  stack with exact versions, shadcn registry workflow, Git workflow and a
  per-framework structure overview.
- Optional `theme` tech preset applying the raulmoracode nature theme from the
  registry during scaffolding (pins `tw-animate-css`, cleans the CLI's
  `src/`-prefixed leftovers, restores aliases). Includes a Biome `overrides`
  entry for the Tailwind entry files, whose v4 directives Biome cannot parse.
- CI workflow (`.github/workflows/ci.yml`): check, lint, tests (including the
  Vite E2E) and build on `main` pushes and pull requests, plus a separate
  Next.js E2E job.

### Changed

- Every documented `shadcn add` command now uses the pinned `shadcn@4.21.0`
  (`SHADCN_VERSION`) instead of `shadcn@latest`.

### Fixed

- Scaffold installs no longer run frozen: `pnpm install --no-frozen-lockfile`,
  fixing `ERR_PNPM_OUTDATED_LOCKFILE` under `CI=true` (caught by the new CI on
  its first run).
- Vite tsconfigs no longer set `baseUrl`, which TypeScript 7 rejects
  (`TS5102`); `paths` resolve without it and the shadcn CLI is unaffected.

## [1.0.2] - 2026-09-29

First stable release. This is the first version where the git tag, the
`CHANGELOG.md` entry, the `package.json` version and the npm `dist-tag` all
agree, and where the publish pipeline refuses to run if they ever stop
agreeing.

### Added

- Interactive Clack CLI asking for the framework (React + Vite or Next.js), the
  tech preset, the project name and the GitHub repository URL.
- Scaffolding through the official generators, `create-vite@9.2.1` and
  `create-next-app@16.3.6`, both pinned to exact versions.
- Twelve configuration steps applied to the generated project: Tailwind CSS,
  branding, shadcn/ui, TanStack Query, Biome, Vitest, VS Code, `.nvmrc`,
  `.editorconfig`, Git hooks, `patchPackageJson` and `.gitignore`.
- Multiselect tech preset: Tailwind, shadcn/ui, TanStack Query, Biome, testing
  and Husky + Commitlint.
- Dependency installation with pnpm, normalising every version to an exact pin
  (no `^`, no `~`).
- Git initialisation on `main`, an initial `chore: initial project setup`
  commit and `push -u origin main` to GitHub.
- Preflights for Node >= 24, pnpm, git and the git identity before anything is
  written to disk.
- `CHANGELOG.md`, following Keep a Changelog.

### Changed

- `publish.yml` now fails fast, before install/build/test, when the tag is not
  strict `vX.Y.Z`, when the tag does not match the `package.json` version, or
  when that version already exists on npm.

## [1.0.1] - 2026-09-29

Withdrawn. It was unpublished on the same day it was published.

npm permanently reserves every `name@version` pair that has ever been used —
"this is true even if that package is unpublished". The version number can
therefore never be reused, by this project or by anyone else, which is why the
next release had to jump to 1.0.2.

## [1.0.0] - 2026-09-29

Deprecated. Published by mistake before the release process was set up: it had
no git tag, and the breaking change that removed the private registry, the
`.npmrc` and `GH_TOKEN` shipped in it as if it were a patch.

It is deprecated in favour of 1.0.2. The install command is unchanged, so
`npm install -g @raulmoracode/create@1.0.2` is all that is needed.

[Unreleased]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.9...v1.1.0
[1.0.9]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/raulmoracode/raulmoracode-create/compare/2af3311...v1.0.2
[1.0.1]: https://github.com/raulmoracode/raulmoracode-create/tree/c7b1301
[1.0.0]: https://github.com/raulmoracode/raulmoracode-create/tree/2af3311
