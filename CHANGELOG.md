# Changelog

All notable changes to `@raulmoracode/create` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing pending yet.

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

[Unreleased]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.7...HEAD
[1.0.7]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/raulmoracode/raulmoracode-create/compare/2af3311...v1.0.2
[1.0.1]: https://github.com/raulmoracode/raulmoracode-create/tree/c7b1301
[1.0.0]: https://github.com/raulmoracode/raulmoracode-create/tree/2af3311
