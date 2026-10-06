# Changelog

All notable changes to `@raulmoracode/create` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing pending yet.

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

[Unreleased]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/raulmoracode/raulmoracode-create/compare/2af3311...v1.0.2
[1.0.1]: https://github.com/raulmoracode/raulmoracode-create/tree/c7b1301
[1.0.0]: https://github.com/raulmoracode/raulmoracode-create/tree/2af3311
