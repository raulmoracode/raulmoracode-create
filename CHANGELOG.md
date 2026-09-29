# Changelog

All notable changes to `@raulmoracode/create` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing pending yet.

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

[Unreleased]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/raulmoracode/raulmoracode-create/compare/2af3311...v1.0.2
[1.0.1]: https://github.com/raulmoracode/raulmoracode-create/tree/c7b1301
[1.0.0]: https://github.com/raulmoracode/raulmoracode-create/tree/2af3311
