# AGENTS.md — `@raulmoracode/create` (CLI repo)

> Read this file before touching anything. It describes what this repo is, how its
> pieces connect, and the rules you must not break.
> Note: `src/config/agents.ts` (`agentsMd()`) is something ELSE: the template for the
> `AGENTS.md` generated **inside scaffolded projects**. Do not confuse them.

## 1. What this repo is

CLI published as `@raulmoracode/create` on npmjs (`https://registry.npmjs.org`).
It exposes a single binary: `raulmoracode-create` (`./dist/index.js`).

What it does: asks for framework (React+Vite / Next.js) → name → GitHub URL,
scaffolds with the official generator (`create-vite` / `create-next-app`), applies ~20
configuration steps, installs dependencies with pnpm, initializes Git on `main`, creates the
`chore: initial project setup` commit and pushes it (`push -u origin main`, never `--force`).

- Language: strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `module/moduleResolution: NodeNext` → internal imports carry the `.js` extension).
- Package manager: **pnpm 12.6.0** (`packageManager` in `package.json`). Engines: **Node >= 24** (`.nvmrc` = `24`).
- Minimal own stack: only `@clack/prompts` as a dependency; `biome`, `typescript`, `vitest`, `@types/node` as devDeps. **Do not add CLI dependencies without a real reason.**
- Versions are **always exact, no `^` or `~`**, both here and in generated projects.

## 2. Commands (use pnpm exclusively, never npm/yarn)

```bash
pnpm install
pnpm build      # tsc -p tsconfig.json → dist/ (preserves the src/index.ts shebang)
pnpm check      # biome check .     (format + lint + organize imports)
pnpm format     # biome format --write .
pnpm lint       # biome lint .
pnpm test       # vitest run        (node environment, tests/**/*.test.ts; E2E skipped by default)
```

Plain `pnpm test` runs the offline tests only; it skips the opt-in suites
(`tests/e2e.test.ts`, `tests/upgrade-e2e.test.ts`) unless `E2E_FRAMEWORK` is
`vite` or `next`. E2E per framework (requires Node 24 and network):

```bash
E2E_FRAMEWORK=vite pnpm test --run tests/e2e.test.ts tests/upgrade-e2e.test.ts
E2E_FRAMEWORK=next pnpm test --run tests/e2e.test.ts tests/upgrade-e2e.test.ts
```

A scheduled E2E (`.github/workflows/e2e-scheduled.yml`, Mondays 06:00 UTC + manual
`gh workflow run e2e-scheduled.yml`) runs both frameworks to catch breakage that
needs no commit here (transitive deps, `registry.raulmoracode.com`, GitHub/npm). It only
observes: it never updates pins or the lockfile. Failures notify by email; GitHub disables
scheduled workflows after 60 days without repo activity (re-enable them in the Actions tab).

## 3. Layered architecture (separation rule — DO NOT break it)

```text
src/
├── index.ts            # entry point, only shebang + run({verbose}) + catch
├── cli/                # orchestration and Clack output (run.ts, output.ts)
├── prompts/            # ALL user interaction lives here (Clack)
├── generators/         # steps that modify the generated project
├── frameworks/         # Vite vs Next differences (same ProjectFramework interface)
├── git/                # Git operations ONLY (arg builders + thin wrappers)
├── github/             # `gh` CLI wrappers ONLY (arg builders + thin wrappers)
├── upgrade/            # PURE manifest contract (types, manifest, managed files, notes,
│                       # snapshot, PR body) + the upgrade orchestration (plan, preflight, apply)
├── config/             # PURE templates: functions returning strings, no I/O
└── utils/
    ├── exec.ts         # ONLY external-process execution path (spawn)
    ├── filesystem.ts   # ALL file I/O (read/write/mkdir/chmod/JSONC)
    └── validation.ts   # name, URL, framework, Node version validation
```

Rules:

- **Clack only in `cli/` and `prompts/`**. No other module imports `@clack/prompts`.
- **`config/` performs no I/O**: it only exports pure functions (`biomeConfig()`, `huskyPreCommit()`,
  `commitlintConfig()`, …). If a template needs data, pass it as a parameter.
- **`upgrade/` is pure and framework agnostic**: manifest (`ProjectManifest`, `hashContent()`,
  `serializeManifest()`, `parseManifest()`), the managed-file inventory (`managedFiles()`,
  `managedPackageJson()`, `managedDependencyPins()`, `EXECUTABLE_MANAGED_FILES`), the release
  notes (`UPGRADE_NOTES`, `notesBetween()`) and the template snapshot. No Clack, no I/O, no
  processes. `upgrade/` never imports `cli/` or `prompts/`; the reverse is fine.
- **`github/` wraps the `gh` CLI, `git/` wraps `git`**: neither one knows about the other
  (no `gh` call inside `git/`, no `git` call inside `github/`), and Husky/Commitlint logic stays
  out of both.
- **All file I/O goes through `utils/filesystem.ts`** (`writeTextFile` creates parents,
  `makeExecutable` = `chmod 0o755`, `parseJsonc` for tsconfigs with comments).
  Do not use `node:fs` directly in generators/frameworks/config.
- **All external processes go through `utils/exec.ts`** (`exec(cmd, args[], {cwd, verbose, env})`).
  Always an **args array, never string interpolation**. Do not use `child_process` directly.
  `exec` resolves `.cmd` on win32. `ExecError` carries `command/args/code/signal/stdout/stderr/spawnError`.
- **`git/` contains no Husky or Commitlint logic** (git only). Husky activation
  (`pnpm exec husky` after `git init`) is orchestrated from `cli/run.ts`, not from `git/`.
- **`github/` contains only `gh` wrappers** (arg builders + thin wrappers, exactly like
  `git/`): no Clack, no markdown generation, no business logic. It owns `GhAuthError`
  (defined there, not imported from `cli/run.ts`, so `github/` stays CLI-free) and always
  runs `gh` through `utils/exec.ts` with an args array.
- **Upgrade pull request bodies are generated purely from `UpgradeReport`**
  (`upgrade/pr-body.ts`: `upgradePrBody`/`upgradePrTitle`/`unifiedDiff`/`truncateForGithub`)
  and are therefore **in English** — the reader is a reviewer of a GitHub PR, not the CLI
  user. The CLI messages around the upgrade stay in Spanish. Never add I/O to
  `upgrade/pr-body.ts`.
- **CLI messages are in Spanish** (preflights, prompts, errors). Keep the language.

## 4. Execution flow (`src/cli/run.ts` — the orchestrator, read it first)

`run()` = `intro` → `preflightChecks` → 4 prompts (framework → tech preset multiselect → name → URL) → `checkDestination` + `checkRemoteAccess` →
Clack `tasks([...])` block (each task records its title in `failedStep` first) →
`showSummary` → `promptOpenInVscode` → `showFarewell`.
Any error → cleanup via `shouldRemoveProjectDir(failedStep)` (removes `./<name>` only when
everything in it was created by this run; never on push failure — the project is complete
locally — and restores a reused empty dir on pre-task failures) + actionable hint
(retry vs manual `git push`) → `log.error` + `process.exit(1)` (130 on SIGINT/SIGTERM).

**Preflights (in order):** Node >= 24 → `pnpm --version` (exists + major must equal
`REQUIRED_PNPM_MAJOR`, derived from `PNPM_VERSION` in `generators/configure-project.ts`, checked
with pure `satisfiesPnpmVersion()` on the same stdout, no second spawn) → `git --version` →
git identity (`user.name` + `user.email`). There is no token-based preflight:
generated projects contain no `.npmrc` and no private dependencies. User-facing
failures → `PreflightError`.

**Exact order inside `tasks` (do not change without reason):**

1. `Creating project`: `createProject` (delegates to the framework) → `configureSite` (always,
   writes `src/config/site.ts`) → `configureTailwind` (only if `selection.tailwind`) →
   `configureBranding` (always; removes the template's own `<title>`/favicon link and lets
   `siteHead()`/`nextSiteMetadata()` render the head from `src/config/site.ts`) →
   `configureShadcn` (only if `selection.shadcn`) → `applyRegistryTheme` (only if `selection.theme`; needs shadcn via the
   tech cascade; removes the CLI's `src/`-prefixed junk and restores aliases; must run before
   `patchPackageJson` because the theme overwrites `package.json`) → `configureTanStackQuery` (only if `selection.tanstack-query`) → `configureStarter?.()`
   (optional, always) → `configureBiome` (only if `selection.biome`) → `configureTesting`
   (only if `selection.testing`) → `configureVscode` (only if `selection.vscode`) →
   `configureNode` + `configureEditorconfig` (always) → **`configureGitHooks(selection)`**
   (only if `selection.husky`; `pre-commit` adapts: `pnpm check` line only with Biome,
   `pnpm test` only with testing) → `patchPackageJson(..., selection)` (drops
   `check/format/lint` scripts without Biome, `test` without testing, `prepare` and
   Husky/Commitlint devDeps without Husky) → `configureReadme(...)` (always, after the
   patch so the scripts table matches the final `package.json`) → `writeProjectLicense(...)`
   (always, current year from `run.ts`) → `configureChangelog(...)` (always) →
   `augmentGitignore` (always) → `configureCi(...)` (always, `.github/workflows/ci.yml`).
2. `Installing dependencies`: `installDependencies` (`pnpm install --no-frozen-lockfile` → `pnpm add <runtime>` →
   `pnpm add -D <dev>`) → `normalizePackageJson` (strips `^`/`~` pnpm may have written) →
   `formatProject` (only if `selection.biome`, it would fail without the binary: `pnpm exec biome check --write .`) →
   `refreshPnpmWorkspaceExcludes` → **`configureManifest(...)`** (always, last step: writes
   `raulmoracode.json` with the sha256 of the managed files **as they are on disk after
   Biome reformatted them**, so the manifest is part of the initial commit).
3. `Initializing Git`: `initRepository` (`git init` + `branch -M main`) → **`pnpm exec husky`**
   (sets `core.hooksPath=.husky/_`; must run AFTER init — the install-time `prepare`
   runs without `.git` and only warns `.git can't be found`).
4. `Configuring remote` → `addRemote`. `Creating initial commit` → `createCommit`
   (`git add .` + `commit -m "chore: initial project setup"` — immutable message, passes Commitlint).
5. `Pushing to GitHub`: `remoteHasDivergentCommits` → on divergence, error with
   `REMOTE_CONFLICT_MESSAGE` (never destructive push); otherwise, `push -u origin main`.

`checkDestination`: if the dir exists and is empty it is reused (via `removeEmptyDir`, which only
succeeds when empty); if it has content → error, **never delete user work**.

## 5. How the pieces connect (example: adding something to the generated project)

```text
prompt (prompts/*.ts, Clack + validation.ts)
  → run.ts calls it and gets an already-validated value
  → tech preset (prompts/tech.ts multiselect → config/tech.ts resolveTechSelection)
  → framework (frameworks/vite.ts|next.ts implements ProjectFramework)
  → generator (generators/configure-*.ts, gated by TechSelection in run.ts) requests strings from config/*.ts
  → writes via filesystem.ts / executes via exec.ts
```

- **Tech selection**: option metadata + `TechSelection` + `resolveTechSelection()`
  live in `src/config/tech.ts` (pure). `runtimeDependencies()`, `devDependencies()`, `patchPackageJson()`,
  `installDependencies()`, `pinnedPackages()` take an optional `selection` (defaults to
  `FULL_TECH_SELECTION`, so existing callers/tests are unaffected). Empty `pnpm add` calls are
  skipped (a bare `add` with no packages fails). `huskyPreCommit(selection)` adapts the hook
  lines the same way.

- **`src/config/site.ts` is the single source of truth for the site identity** in generated
  projects (title, description, favicon, social preview image, author, X handle, locale,
  theme color). `favicon` and `socialImage` take **either** a full URL or a local path under
  `public/`; the CLI generates no image assets. Empty values are never rendered. A local
  `socialImage` must be resolved against `site.url` before it reaches the HTML, because
  social crawlers cannot resolve relative URLs. Both frameworks read it: the Vite `siteHead()` plugin injects the head tags
  through `transformIndexHtml`, and the Next `metadata` export is built from the same object.
  Never hardcode those values in `index.html`, `layout.tsx`, `vite.config.ts` or the README
  template: adding a value means adding it to `SiteValues` and to the two consumers, so the
  project never has to duplicate it.
- **Adding a new generated file**: create `src/config/<x>.ts` (pure function returning the
  exact content, ending in `\n`) + `src/generators/configure-<x>.ts`
  (uses `joinPath`/`writeTextFile` from `filesystem.ts`) + call it from `run.ts` in step 1
  + tests in `config.test.ts` and `generators.test.ts` (temporary directories).
- **Next.js error pages** (`config/error-pages.ts`) are file conventions: never wire them
  manually. Name the error component `ErrorPage`, not `Error`, or Biome fails in the
  generated project with `noShadowRestrictedNames`. They must not depend on theme tokens.

- **The MIT `LICENSE`** is written by `writeProjectLicense(projectDir, year)` with
  `LICENSE_HOLDER` (the same author it writes to `package.json`) and the current year,
  passed in from `run.ts` so the template stays pure and the tests stay year-independent.
  `patchPackageJson` also sets `license: "MIT"`; the two must agree.
- **Adding a dependency to generated projects**: define the exact version as a constant in
  `generators/configure-project.ts` (`HUSKY_VERSION`, …), use it in `devDependencies()` (or
  `runtimeDependencies()`), and if it carries a lifecycle script (`prepare: husky`), ALSO add it
  in `patchPackageJson()` (otherwise the first `pnpm install` fails with exit 127 because the
  script exists but the binary is not installed yet). `pinnedPackages()` picks it up
  automatically for workspace excludes. Update `install.test.ts`,
  `frameworks.test.ts` and `package-metadata.test.ts`.
- **Vite/Next differences**: live in `frameworks/vite.ts|next.ts` behind the
  `ProjectFramework` interface (`types.ts`): `scripts()`, `pinnedDependencies/DevDependencies()`,
  `removedDependencyPatterns()`, `componentsJsonOptions()`, `configureTailwind/TanStackQuery/
  Branding/Starter`. `run.ts` never does `if framework === ...`; it calls the polymorphic method.
- **Git**: `git/*.ts` exposes pure constructors (`initArgs()`, `commitArgs()`, `pushArgs()`, …,
  testable without git) + wrappers (`initRepository`, `createCommit`, …). `run.ts` only uses the wrappers.

### 5.1 `raulmoracode.json`, managed templates and upgrade notes

Every generated project gets a `raulmoracode.json` manifest (written by
`configureManifest()`, the last step of the "Installing dependencies" task — **after**
`formatProject`, so the hashes describe the committed bytes — and therefore part of the initial
commit). It records `manifestVersion`, `cliVersion` (`VERSION` from `src/cli/args.ts`),
`framework`, `selection`, `projectName`, `githubUrl`, `files` (POSIX path → sha256 of the managed
file **as it is on disk**; missing files are skipped) and `dependencies` (`managedDependencyPins()`,
i.e. the exact versions the CLI pinned). `upgrade/` reads it to tell the user's edits from the
CLI's.

**Changing a managed template requires an `UpgradeNotes` entry.** `UPGRADE_NOTES`
(`src/upgrade/notes.ts`) is the only channel through which a generated project learns what a new
CLI version changes, and `tests/upgrade-notes.test.ts` enforces it with the stored snapshot
`src/upgrade/__snapshots__/templates.json` (rendered by the pure `template-snapshot.ts` for the
`full`, `core` and `none` selections × both frameworks, with sorted keys and no absolute paths or
timestamps). Whenever you touch a template in `src/config/*.ts`, a pin in
`generators/configure-project.ts`, the managed-file inventory (`upgrade/managed-files.ts`) or a
framework template, do:

1. `UPDATE_TEMPLATE_SNAPSHOT=1 pnpm test --run tests/upgrade-notes.test.ts` (regenerates the
   snapshot; without the env var the test fails and prints exactly which case/file/pin changed).
2. Add or update the `UpgradeNotes` entry for the version in `src/cli/args.ts`, listing every
   changed file in `changes[].files` (managed paths only — a note may not reference a file the
   snapshot does not know) with a non-empty `what` and `why`, and the changed pins in `what`/`why`.

The notes are still empty: `1.0.8` is the baseline that introduced the manifest, so projects
created before it have no upgrade history to replay.

### 5.2 `upgrade`: bringing a new CLI version to an existing project

`raulmoracode-create upgrade` (`src/cli/upgrade.ts`, dispatched from `args.ts`) runs inside a
generated project and always ends in a **ready-for-review** PR (`createPullRequest`, never
`--draft`). Flow:

1. `upgradePreflightChecks` (`upgrade/preflight.ts`): Node 24 → pnpm 12 (`REQUIRED_PNPM_MAJOR`) →
   git → inside a repo → **clean working tree** → `gh` auth → `origin` is a GitHub remote →
   `raulmoracode.json` exists and parses. Any failure: Spanish message, `exit 1`, nothing written.
2. `readProjectState` + `buildUpgradePlan` (pure, `upgrade/plan.ts`): compares three hashes per
   managed file — the template the CLI would render today, the hash in the manifest and the hash on
   disk — and classifies each file as `updated`, `overwritten` (the user edited it), `new`,
   `removed` (only when a migration handles it) or skipped `deleted-locally`. Pins are bumped to the
   CLI's exact version, flagging `hadLocalVersion`; a pin the CLI no longer owns becomes
   `keptDependencies`. Migrations come from `upgrade/migrations/index.ts` in ascending version order.
3. `confirmUpgrade` (`prompts/upgrade.ts`) after `showUpgradeSummary` warns about the files that will
   be overwritten. Declining writes nothing.
4. `prepareUpgradeBranch` → `applyUpgradeFiles` → `commitUpgrade` → push → `createPullRequest`, as
   four Clack tasks. `applyUpgradeFiles` writes the files (restoring the executable bit for
   `EXECUTABLE_MANAGED_FILES`), runs the migrations, patches only the managed `package.json` fields,
   merges `pnpm-workspace.yaml`, runs `pnpm install` + `normalizePackageJson` + Biome, then rewrites
   the manifest with the **post-format** on-disk hashes.
5. `commitUpgrade` makes two Conventional Commits: `chore: upgrade raulmoracode-create to <version>`
   (everything else) and `chore: overwrite locally modified files` (only the overwritten files), so
   the overwrite is reviewable on its own. `upgradePrBody(report)` builds the PR body from the report
   alone (`truncateForGithub` only ever trims the diff sections).

Rules that must not regress: the current branch is never touched, `git push` never uses `--force`,
nothing resets or cleans, and any failure while writing or committing reverts exactly the files the
run wrote (`revertAppliedFiles`, safe only because the preflight proved the tree was clean) and
deletes the half-created branch. A failure at push/PR time **keeps** the branch and the commits and
prints the exact retry commands.

`upgrade/` takes no Clack and no process: `github/gh.ts` wraps `gh` (arg builders + thin wrappers
through `utils/exec.ts`), `git/upgrade.ts` wraps git. `runUpgrade({ verbose, deps })` takes `gh` and
the default-branch detector as injectable dependencies so the E2E can run against a local bare
remote. PR bodies are English; CLI messages are Spanish.

## 6. Subtle verified details (do not "simplify" them)

- `create-vite@8.3.1` **does not exist**: scaffold with `create-vite@9.2.1` (the line that generates Vite 8)
  then pin `vite@8.3.1`. `create-next-app@16.3.6` with flags `--ts --app --src-dir
  --import-alias "@/*" --biome --use-pnpm --disable-git --yes` (no `--tailwind`: Tailwind is
  pinned by the scaffolder).
- pnpm major gate: the preflight derives `REQUIRED_PNPM_MAJOR` from `PNPM_VERSION`, so bumping
  `PNPM_VERSION` moves the requirement automatically. The `README.md` Requirements line hardcodes
  `pnpm@12.6.0` in its fix command: update it in the same change.
- Husky 9.1.7: hooks in `.husky/pre-commit` (`pnpm check` + `pnpm test`) and
  `.husky/commit-msg` (`pnpm exec commitlint --edit "$1"`), `prepare: husky` in scripts,
  `commitlint.config.ts` = `{ extends: ["@commitlint/config-conventional"] }`.
  The `husky` binary creates `.husky/_/` and sets `core.hooksPath` (hence the init→husky order matters).
- `pnpm-workspace.yaml` (`minimumReleaseAge: 10080`) is written **after** installing
  (before that, pnpm would reject recent versions); `refreshPnpmWorkspaceExcludes` merges
  `pinnedPackages()` + the whole lockfile via `pnpm list --json` (`collectLockedPackages`) with
  fallback to pins on failure, preserving existing entries (`mergePnpmWorkspaceYaml`).
  With shadcn it also excludes the `@raulmoracode/*` scope (pure `registryScopeExcludes()`,
  pnpm pattern syntax) so `shadcn add @raulmoracode/<component>` can install freshly
  published scope packages despite the maturity gate.
- Biome 2.5.14: `organizeImports` lives in `assist.actions.source` (not top-level); `dist`/`.next`
  are ignored; `noSvgWithoutTitle`/`noAmbiguousAnchorText` are `off` (templates ship demo assets
  that trigger them).
- `components.json` must be the **full** shadcn 4.x configuration (`$schema`, `style
  new-york`, `rsc`, `tsx`, `tailwind`, `aliases`, `registries: {"@raulmoracode":
  "https://registry.raulmoracode.com/r/{name}.json"}`); the minimum with only `registries` is
  rejected. `cn()` requires `clsx` + `tailwind-merge`.
- Theme (`@raulmoracode/theme`, optional preset, requires shadcn): `REGISTRY_THEME_SPEC`
  carries no version pin (registry item, not an npm package), applied via
  `pnpm dlx shadcn@4.21.0 add @raulmoracode/theme --yes --overwrite` (`SHADCN_VERSION`
  is the pinned shadcn CLI tool version in `config/components.ts`); the preset pins
  `tw-animate-css@1.4.0` (`TW_ANIMATE_CSS_VERSION` in `generators/configure-project.ts`,
  only with `theme`).
- shadcn on Vite needs the `@/*` alias in **three** places: `vite.config.ts` (via
  `fileURLToPath`), `tsconfig.app.json` and the root `tsconfig.json` (the shadcn CLI only reads the
  root one; without it, a literal `@/` folder is created). Tsconfigs are parsed as JSONC.
  `configureShadcn` additionally writes the registry aliases (`@components/*`, `@lib/*`,
  `@hooks/*` → `src/...`, merged via pure `withRegistryAliases()`, never overwriting existing
  paths) because registry file targets use those prefixes; Vite's `ensurePathAlias` merges for
  the same reason (it runs after shadcn in `run.ts`).
- Testing: `vitest.config.ts` (`environment: jsdom`) + `src/test/smoke.test.tsx` (Testing
  Library). Requires `jsdom`. Note: the generated `test` script is `vitest` (watch); E2E
  verifies with `vitest run` / `CI=true` so it does not hang.

## 7. Tests

| File | What it covers |
|---|---|
| `validation.test.ts` | names, GitHub URLs, `isFramework`, `satisfiesNodeVersion`, `satisfiesPnpmVersion` |
| `preflight.test.ts` | `run()` with mocked Clack/`exec`: pnpm major mismatch / unparsable output → actionable `PreflightError` + exit 1; pnpm 12.x proceeds (single `pnpm --version`) |
| `config.test.ts` | each pure template (exact content + trailing `\n` + no tokens/machine paths) |
| `frameworks.test.ts` | registration, exact pins, scripts, removal patterns, `patch/normalize` against temp `package.json` |
| `generators.test.ts` | each `configure*` against temp dirs (+ executable bit except win32), `configureManifest` (identity, pins, sha256 taken from disk, missing files skipped, hooks untouched) |
| `install.test.ts` | `installDependencies` with mocked `exec`: `install`→`add`→`add -D` order, `cwd`, PostCSS variant on Next |
| `package-metadata.test.ts` | own metadata + `prepare: husky` and exact pins of generated projects |
| `args.test.ts` | `parseArgs` (defaults, each flag, combined, unknown ignored, `-v` ≠ `--version`), `VERSION` pinned to `package.json`, help text contents, `printHelp` stdout |
| `recovery.test.ts` | `shouldRemoveProjectDir` decision table + full `run()` integration (mocked Clack/`exec`, temp dirs, Node 24 only): mid-task failure removes the dir + exit 1; pre-task failure restores a reused empty dir + exit 1 |
| `git.test.ts` | git arg builders (init, `branch -M main`, `remote add`, `add .`, `commit`, push without force) + real Git in temp dirs: init on `main`, remote, initial commit, push to a bare repo |
| `exec.test.ts` | real `exec`: stdout, non-zero exit, stderr, missing binary (`spawnError`), `cwd`, args-as-array without interpolation; per-platform `resolveCommand`; `formatCommand` |
| `error-handling.test.ts` | mocked `exec` (`importOriginal` + override): missing pnpm/git, non-zero exits, `remoteHasDivergentCommits` (diverge / ancestor / no branch / same), `PreflightError`, invalid URLs, `REMOTE_CONFLICT_MESSAGE` |
| `upgrade-pr-body.test.ts` | `upgradePrBody` (empty plan, all statuses, notes with/without `action`, unmatched overwritten file, CRLF, pipe escaping), `unifiedDiff`/`diffLineCounts`/`diffCounts` on small inputs and caps, `truncateForGithub` (summary/⚠️/tables/action items survive, diffs trimmed, under the limit, idempotent) |
| `github.test.ts` | `gh` arg builders (never `--draft`), `requireGhAuth` (`GhAuthError`, `gh auth login`), `findOpenPullRequest` with mocked `exec` (JSON, empty, garbage, no url, non-zero exit → `null`), `createPullRequest` (`--body-file`, temp file written and removed, URL extraction), `repoDefaultBranch` |
| `upgrade-contract.test.ts` | manifest contract (hash/serialize/parse), `managedFiles()`, `managedPackageJson()`, `managedDependencyPins()`, `notesBetween()` |
| `upgrade-notes.test.ts` | rendered managed-template snapshot vs `src/upgrade/__snapshots__/templates.json` (deterministic, no absolute paths), `UPGRADE_NOTES` shape, every note file exists in the snapshot, notes still empty at the 1.0.8 baseline |
| `e2e-scheduled-workflow.test.ts` | `.github/workflows/e2e-scheduled.yml`: schedule + `workflow_dispatch`, read-only permissions, `[vite, next]` matrix, Node 24, frozen-lockfile install, E2E command with `E2E_FRAMEWORK` from the matrix, observe-only |
| `ci-workflow.test.ts` | `.github/workflows/ci.yml`: `main` pushes + PRs, read-only permissions, Node 24 + pnpm store cache, frozen-lockfile install, every validation step in order across all jobs, one E2E job per framework, never `--force`/history rewriting |
| `publish-workflow.test.ts` | `.github/workflows/publish.yml`: `v*` tags only, read-only permissions, strict-semver / tag / npm-version gates, build + test before publish, build-output and tarball verification, `gitHead` check, `npm publish --access public` with `NPM_TOKEN`, never `--force`/history rewriting |
| `upgrade-plan.test.ts` / `upgrade-engine.test.ts` | pure `buildUpgradePlan`/`classifyManagedFiles`/`classifyDependencies` (updated/overwritten/new/removed, `hadLocalVersion`, `keptDependencies`, migration order, up-to-date and CLI-outdated) + `runUpgrade()` with mocked Clack/`exec`/gh: exact command order (fetch → switch → commits → push), never `--force`/`reset`/`clean`, rollback, no writes on preflight failure |
| `upgrade-e2e.test.ts` | opt-in: real `run()` (mocked Clack) creates the project against a local bare remote, then a real `runUpgrade()` rewinds the manifest, overwrites a locally edited managed file, creates `chore/raulmoracode-update-<version>`, commits twice (`chore: upgrade …` + `chore: overwrite locally modified files` carrying only that file), pushes it and produces the PR body; no `.new` file is left behind and a second run is a no-op |
| `e2e.test.ts` | opt-in via `E2E_FRAMEWORK=vite` or `next` (skipped by plain `pnpm test`): full `run()` with mocked Clack and real `exec` (except `ls-remote` and remote rewrite to local bare): pins, files, `node_modules`, workspace, branding/starter per framework, `pnpm check` + `vitest run` + `build`, initial commit and push |

Mock pattern: `vi.mock("../src/utils/exec.js", ... importOriginal + override execMock)`.
Unit = mocked `exec`; E2E = real `exec` except network/remote. Do not reduce coverage to make
the suite pass; if you change behavior, update the corresponding test.

## 8. Rules for agents (this repo)

1. Before changing anything, read `run.ts` + the involved generator/framework/config + its test.
2. Respect the layer separation (§3). No Clack outside `cli/prompts`, no I/O outside
   `filesystem.ts`, no processes outside `exec.ts`, no Husky/Commitlint logic in `git/`.
3. External commands always as an args array (`["add", "pkg@1.2.3"]`), never interpolated.
4. Exact versions in a single constant; verify Node 24 + pnpm 12.6 compatibility
   (`npm view <pkg> version/engines`) before pinning.
5. Do not use `git push --force/-f`, `reset --hard`, `clean -fd`; do not rewrite history; do not
   commit unless explicitly requested; do not delete user content.
6. After changing code: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` (plus the affected
   framework's E2E via `E2E_FRAMEWORK=vite|next` if it touches scaffolding, since plain
   `pnpm test` skips it). Do not claim something passes if you did not run it.
7. When done, report: what changed, files, validation performed, and remaining limitations.
8. Releasing `X.Y.Z`: bump `version` in `package.json` AND `VERSION` in `src/cli/args.ts` (a test
   pins them together) plus the version references in `docs/PROJECT_SPEC.md`; move
   `CHANGELOG.md` `[Unreleased]` entries under `## [X.Y.Z] - YYYY-MM-DD` and update the compare
   links; merge the `chore/release-X.Y.Z` PR, then push tag `vX.Y.Z` on the merge commit:
   `publish.yml` validates tag/version, builds, tests and publishes to npm.

