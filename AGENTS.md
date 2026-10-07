# AGENTS.md — `@raulmoracode/create` (CLI repo)

> Read this file before touching anything. It describes what this repo is, how its
> pieces connect, and the rules you must not break.
> Note: `src/config/agents.ts` (`agentsMd()`) is something ELSE: the template for the
> `AGENTS.md` generated **inside scaffolded projects**. Do not confuse them.

## 1. What this repo is

CLI published as `@raulmoracode/create` on npmjs (`https://registry.npmjs.org`).
It exposes a single binary: `raulmoracode-create` (`./dist/index.js`).

What it does: asks for framework (React+Vite / Next.js) → name → GitHub URL,
scaffolds with the official generator (`create-vite` / `create-next-app`), applies ~12
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
pnpm test       # vitest run        (node environment, tests/**/*.test.ts)
```

E2E per framework (requires Node 24 and network):

```bash
E2E_FRAMEWORK=vite pnpm test --run tests/e2e.test.ts
E2E_FRAMEWORK=next pnpm test --run tests/e2e.test.ts
```

## 3. Layered architecture (separation rule — DO NOT break it)

```text
src/
├── index.ts            # entry point, only shebang + run({verbose}) + catch
├── cli/                # orchestration and Clack output (run.ts, output.ts)
├── prompts/            # ALL user interaction lives here (Clack)
├── generators/         # steps that modify the generated project
├── frameworks/         # Vite vs Next differences (same ProjectFramework interface)
├── git/                # Git operations ONLY (arg builders + thin wrappers)
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
- **All file I/O goes through `utils/filesystem.ts`** (`writeTextFile` creates parents,
  `makeExecutable` = `chmod 0o755`, `parseJsonc` for tsconfigs with comments).
  Do not use `node:fs` directly in generators/frameworks/config.
- **All external processes go through `utils/exec.ts`** (`exec(cmd, args[], {cwd, verbose, env})`).
  Always an **args array, never string interpolation**. Do not use `child_process` directly.
  `exec` resolves `.cmd` on win32. `ExecError` carries `command/args/code/signal/stdout/stderr/spawnError`.
- **`git/` contains no Husky or Commitlint logic** (git only). Husky activation
  (`pnpm exec husky` after `git init`) is orchestrated from `cli/run.ts`, not from `git/`.
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

1. `Creating project`: `createProject` (delegates to the framework) → `configureTailwind`
   (only if `selection.tailwind`) → `configureBranding` (always) → `configureShadcn` (only if
   `selection.shadcn`) → `applyRegistryTheme` (only if `selection.theme`; needs shadcn via the
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
   `formatProject` (`pnpm exec biome check --write .`) → `refreshPnpmWorkspaceExcludes`.
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

## 6. Subtle verified details (do not "simplify" them)

- `create-vite@8.3.1` **does not exist**: scaffold with `create-vite@9.2.1` (the line that generates Vite 8)
  then pin `vite@8.3.1`. `create-next-app@16.3.6` with flags `--ts --app --src-dir
  --import-alias "@/*" --biome --use-pnpm --disable-git --yes` (no `--tailwind`: Tailwind is
  pinned by the scaffolder).
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
| `generators.test.ts` | each `configure*` against temp dirs (+ executable bit except win32) |
| `install.test.ts` | `installDependencies` with mocked `exec`: `install`→`add`→`add -D` order, `cwd`, PostCSS variant on Next |
| `package-metadata.test.ts` | own metadata + `prepare: husky` and exact pins of generated projects |
| `git/exec/error-handling.test.ts` | git constructors, real `exec`, remote divergence, `PreflightError`, `REMOTE_CONFLICT_MESSAGE` |
| `e2e.test.ts` | full `run()` with mocked Clack and real `exec` (except `ls-remote` and remote rewrite to local bare): pins, files, `node_modules`, workspace, branding/starter per framework, `pnpm check` + `vitest run` + `build`, initial commit and push |

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
   framework's E2E if it touches scaffolding). Do not claim something passes if you did not run it.
7. When done, report: what changed, files, validation performed, and remaining limitations.

