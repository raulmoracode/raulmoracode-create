# `@raulmoracode/create` project specification

Complete reference document for the scaffolder: identity, architecture, what each file and each function does, what it generates in projects, tests, and verified decisions.

---

## 1. Identity and distribution

| Field | Value |
|---|---|
| Repository | `raulmoracode/create` (`github.com/raulmoracode/raulmoracode-create`) |
| npm package | `@raulmoracode/create` |
| Current version | `1.0.7` |
| Global command (only one) | `raulmoracode-create` |
| Compiled entry point | `./dist/index.js` (with `#!/usr/bin/env node` shebang) |
| Publish registry | `https://registry.npmjs.org/` (npmjs) |
| Global install | `npm install -g @raulmoracode/create` |
| License | MIT (`LICENSE`) |

The `bin` field in `package.json` exposes **exactly** `{ "raulmoracode-create": "./dist/index.js" }`. There is no bin or command called `create`. (Occurrences of the word `create` in the code refer to the official generators' `pnpm create vite@…` / `pnpm create next-app@…` subcommand and to internal names such as `createProject`/`createCommit`.)

---

## 2. Scaffolder's own stack

| Dependency | Version (exact, no `^` or `~`) | Use |
|---|---|---|
| `@clack/prompts` | `1.8.1` | All CLI interaction (only prompts library) |
| `@biomejs/biome` (dev) | `2.5.14` | Own repo `check`, `format`, `lint` |
| `@types/node` (dev) | `24.19.0` | Node types |
| `typescript` (dev) | `7.0.2` | Build `tsc -p tsconfig.json` → `dist/` |
| `vitest` (dev) | `5.0.2` | Test suite (`vitest run`) |

- Language: strict TypeScript (`strict`, `noUncheckedIndexedAccess`).
- Package manager: pnpm (`packageManager: pnpm@12.6.0`), engines: Node `>=24`.
- Scripts: `build` (`tsc -p tsconfig.json`), `check` (`biome check .`), `format` (`biome format --write .`), `lint` (`biome lint .`), `test` (`vitest run`), `prepublishOnly` (`pnpm build`).

---

## 3. Directory structure

```text
.
├── src/
│   ├── index.ts                  # entry point (shebang + flags + run)
│   ├── cli/
│   │   ├── run.ts                # full flow orchestration
│   │   ├── args.ts               # VERSION, parseArgs, help text
│   │   └── output.ts             # Clack output helpers
│   ├── prompts/
│   │   ├── cancel.ts             # cancellation handling
│   │   ├── framework.ts          # technology selection
│   │   ├── tech.ts               # tech preset multiselect
│   │   ├── project.ts            # project name
│   │   ├── github.ts             # repository URL
│   │   └── confirm.ts            # open-in-VS-Code confirmation
│   ├── generators/
│   │   ├── create-project.ts     # delegates scaffolding to the framework
│   │   ├── configure-project.ts  # package.json, installs, pnpm workspace
│   │   ├── configure-shadcn.ts   # components.json + cn()
│   │   ├── configure-biome.ts    # biome.json + formatting
│   │   ├── configure-vscode.ts   # .vscode/
│   │   ├── configure-testing.ts  # vitest.config.ts + smoke test
│   │   ├── configure-git-hooks.ts# .husky/ + commitlint.config.ts
│   │   ├── configure-node.ts     # .nvmrc, .editorconfig, .gitignore
│   │   ├── configure-site.ts     # src/config/site.ts (site identity)
│   │   ├── configure-changelog.ts# CHANGELOG.md
│   │   └── configure-ci.ts       # .github/workflows/ci.yml
│   ├── frameworks/
│   │   ├── types.ts              # PackageJson, ProjectFramework
│   │   ├── index.ts              # { vite, next } registry, getFramework()
│   │   ├── vite.ts               # React + Vite specific logic
│   │   └── next.ts               # Next.js specific logic
│   ├── git/
│   │   ├── init.ts               # git init + branch -M main
│   │   ├── remote.ts             # remote add / ls-remote
│   │   ├── commit.ts             # git add + initial commit
│   │   └── push.ts               # fetch, conflict detection, push
│   ├── github/
│   │   └── gh.ts                 # gh CLI wrappers (arg builders + thin wrappers)
│   ├── upgrade/
│   │   ├── types.ts              # manifest, UpgradeReport and its parts
│   │   ├── manifest.ts           # raulmoracode.json read/write/hash
│   │   ├── managed-files.ts      # exact content of every CLI-managed file
│   │   ├── notes.ts              # per-release notes of generated-project changes
│   │   ├── version.ts            # version parsing and range helpers
│   │   └── pr-body.ts            # pure pull request body/title generator
│   ├── config/
│   │   ├── agents.ts             # AGENTS.md content
│   │   ├── biome.ts              # biome.json content
│   │   ├── branding.ts           # title and favicon (constants)
│   │   ├── changelog.ts          # CHANGELOG.md content
│   │   ├── ci.ts                 # .github/workflows/ci.yml content
│   │   ├── components.ts         # components.json + utils.ts (cn)
│   │   ├── commitlint.ts         # commitlint.config.ts content
│   │   ├── editorconfig.ts       # .editorconfig content
│   │   ├── husky.ts              # .husky hook contents
│   │   ├── nvmrc.ts              # .nvmrc content
│   │   ├── pnpm-workspace.ts     # pnpm-workspace.yaml + merge + excludes
│   │   ├── query.ts              # query-client.ts
│   │   ├── tailwind.ts           # CSS, vite.config.ts, postcss.config.mjs
│   │   ├── tech.ts               # tech preset options, selection, resolvers
│   │   ├── testing.ts            # vitest.config.ts + smoke test
│   │   └── vscode.ts             # .vscode/settings.json + extensions.json
│   └── utils/
│       ├── exec.ts               # safe process execution (spawn)
│       ├── filesystem.ts         # file helpers and JSON/JSONC
│       └── validation.ts         # name, URL and framework validation
├── tests/                        # Vitest suite (16 files, ~237 tests)
├── docs/
│   └── PROJECT_SPEC.md           # this document
├── .github/workflows/publish.yml # publish to npmjs on v* tags
├── .github/workflows/ci.yml     # check/lint/test/build + one E2E job per framework on main pushes and PRs
├── .github/workflows/e2e-scheduled.yml # weekly + manual E2E matrix (vite, next), observe-only
├── package.json, tsconfig.json, vitest.config.ts, biome.json
├── .nvmrc (24), .gitignore, README.md, LICENSE
└── dist/                         # compiled output (generated, not versioned)
```

Separation rule: Clack lives only in `cli/` and `prompts/`. `generators/` configures projects, `frameworks/` encapsulates Vite/Next specifics, `git/` only operates with Git, `github/` only wraps the `gh` CLI, `utils/exec.ts` is the only process-execution path, and `config/` holds pure templates with no I/O. `upgrade/pr-body.ts` is pure (markdown out, nothing in but the report) and therefore **English**, like every other file in the repo; only the CLI messages the user sees are in Spanish.

---

## 4. Entry point — `src/index.ts`

```ts
#!/usr/bin/env node
import { parseArgs, printHelp, VERSION } from "./cli/args.js";
import { run } from "./cli/run.js";
// --help/-h prints help and exits 0; --version/-V prints VERSION and exits 0.
run({ verbose: parseArgs(process.argv.slice(2)).verbose }).catch(...);
```

- The shebang is preserved in `dist/index.js` after compiling with `tsc`.
- Flags: `--verbose` (prints stdout/stderr of every external command in real time),
  `-h`/`--help` (help, exit 0 without entering the flow), `-V`/`--version` (prints `VERSION`, exit 0).
- `VERSION` lives in `src/cli/args.ts` and a test pins it to `package.json` (never read the JSON at runtime).
- Works from any working directory.

---

## 5. CLI layer

### 5.1 `src/cli/run.ts` — orchestrator

Constants and types:

- `MINIMUM_NODE_MAJOR = 24`.
- `REMOTE_CONFLICT_MESSAGE`: text shown when the remote brings divergent commits (no destructive push, asks to review the repo and retry).
- `export class PreflightError extends Error {}`: pre-existing/user-facing errors shown without a stack trace.
- `export interface RunOptions { verbose?: boolean }`.

Internal functions:

- `requireCommand(command, instructions, verbose): Promise<string>` — runs `<command> --version` and returns its stdout. If the process does not exist (`ExecError` with `spawnError`), throws `PreflightError` with install instructions; on any other failure, a generic `PreflightError`.
- `requireGitIdentity(verbose): Promise<void>` — requires non-empty `git config --get user.name` and `user.email`; otherwise `PreflightError` with the command to configure them.
- `preflightChecks(verbose): Promise<void>` — in order: Node version (`satisfiesNodeVersion(process.version, 24)`), `pnpm` available + major check (`satisfiesPnpmVersion(stdout, REQUIRED_PNPM_MAJOR)` on the same `pnpm --version` output; on mismatch `PreflightError` with `Se requiere pnpm 12. Versión actual: X.Y.Z.` plus the `corepack prepare pnpm@${PNPM_VERSION} --activate` / `npm install -g pnpm@${PNPM_VERSION}` fix), `git` available, Git identity. There is no token-based preflight: generated projects contain no `.npmrc` and no private dependencies.
- `checkDestination(projectName): Promise<{ projectDir, reusedEmptyDir }>` — resolves `<cwd>/<projectName>`. If it exists and is empty, removes it with `removeEmptyDir` (only succeeds when empty) and marks `reusedEmptyDir: true`; if it exists and is NOT empty, `PreflightError` (never deletes user content).
- `shouldRemoveProjectDir(failedStep: string | null): boolean` (pure, exported) — decides whether to clean up after a failure: `false` when `null` (failure before the tasks, nothing created) or `"Pushing to GitHub"` (project complete locally, only the push failed); `true` otherwise (everything under `./<name>` was created by this run).
- `checkRemoteAccess(githubUrl, verbose): Promise<void>` — `git ls-remote <url>`; on failure, `PreflightError` (URL, connection, or GitHub authentication).

`run(options?: RunOptions): Promise<void>` — flow:

1. `intro("Raulmoracode Create")`.
2. `preflightChecks`.
3. Prompts in order: `promptFramework()` → `promptTechPreset()` (multiselect with everything preselected by default; `resolveTechSelection` forces Tailwind back on if shadcn is left selected without it, with a warning) → `promptProjectName()` → `promptGitHubUrl()`.
4. `checkDestination` + `checkRemoteAccess`.
5. `getFramework(frameworkId)` and the Clack `tasks([...])` block (each task records its title in `failedStep` first):
   - **"Creating project"** → official scaffold; Tailwind (only if `selection.tailwind`); branding (always); shadcn (only if `selection.shadcn`); theme (only if `selection.theme`, via `applyRegistryTheme` after shadcn and before `patchPackageJson`); TanStack Query (only if `selection.tanstack-query`); starter (only if the framework implements it, `configureStarter?.()`, always); Biome (only if `selection.biome`); testing (only if `selection.testing`); VS Code (only if `selection.vscode`); Node (`.nvmrc` + `.editorconfig`, always); Git hooks (only if `selection.husky`, with adapted `pre-commit`: `pnpm check` line only with Biome, `pnpm test` line only with testing); `patchPackageJson(..., selection)` (`check/format/lint` scripts only with Biome, `test` only with testing, `prepare` only with Husky; Husky/Commitlint devDeps only with Husky); `configureReadme(..., selection)` (always, after the patch so the scripts table matches); `augmentGitignore` (always). Returns `"Project created"`.
   - **"Installing dependencies"** → `installDependencies(..., selection)` (`pnpm install`, `pnpm add` runtime unless empty, `pnpm add -D` dev unless empty — a bare `add` with no packages would fail, hence they are skipped); `normalizePackageJson`; `formatProject` only with Biome (it would fail without the binary); `refreshPnpmWorkspaceExcludes(..., selection)`. Returns `"Dependencies installed"`.
   - **"Initializing Git"** → `initRepository` + `pnpm exec husky` only with Husky. **"Configuring remote"** → `addRemote`. **"Creating initial commit"** → `createCommit`. **"Pushing to GitHub"** → `remoteHasDivergentCommits` (if `true`, error with `REMOTE_CONFLICT_MESSAGE`) otherwise `push` (`push -u origin main`, never `--force`).
6. `showSummary({ projectName, githubUrl, frameworkLabel, shadcn: selection.shadcn })` (registry hint only with shadcn).
7. `promptOpenInVscode()`; if yes, `exec("code", ["."], { cwd: projectDir })`. If `code` is missing → warning (not fatal); on any other failure → generic warning (not fatal).
8. `showFarewell()`.
9. `catch`: if `shouldRemoveProjectDir(failedStep)` and there is a `cleanupDir`, delete it with `removeIfExists` (best effort, never hiding the real error); if the failure happened before the tasks and an empty dir had been reused (`restoreEmptyDir`), recreate it with `ensureDir`. Then: `ExecError` with `SIGINT`/`SIGTERM` signal → cancellation message (mentioning the cleanup if any) and `process.exit(130)`; `Error` → `log.error(message)` and `process.exit(1)`; non-`Error` → `log.error(String(error))` and `process.exit(1)`. Final `showWarning` hint: if cleaned, how to retry (`raulmoracode-create`); if the push failed, the project is complete and the manual `git -C … push` is given.

### 5.2 `src/cli/args.ts` — flags

- `VERSION = "1.0.7"` — single source of truth for `--version`; pinned to `package.json` by a test.
- `parseArgs(argv): CliArgs` — `{ help, version, verbose }` (`-h`/`--help`, `-V`/`--version`, `--verbose`; unknown flags are ignored).
- `helpText()` / `printHelp()` — usage, options, examples. Printed with `console.log`, exit 0, before entering the interactive flow.

### 5.3 `src/cli/output.ts` — Clack output

- `showIntro(): void` — `intro("Raulmoracode Create")`.
- `showError(message: string): void` — `log.error(message)`.
- `showWarning(message: string): void` — `log.warn(message)`.
- `showSummary({ projectName, githubUrl, frameworkLabel, shadcn? }): void` — `log.success("Project created successfully!")` + `Framework:`, `Local: ./<name>`, `GitHub: <url>` lines, plus the `pnpm dlx shadcn@4.21.0 add @raulmoracode/<component>` hint when `shadcn` is true.
- `showFarewell(): void` — `outro("Proyecto creado correctamente.\n¡Hasta pronto!")`.
- Note: `run.ts` uses `intro`/`log` directly for the intro and errors; from this module it consumes `showSummary`, `showWarning` and `showFarewell`.

---

## 6. Prompts layer (all Clack)

- `prompts/cancel.ts` — `ensureNotCancelled<T>(value: T): Exclude<T, symbol>`: on Clack cancellation (`isCancel`), shows `cancel("Operación cancelada.")` and exits with code 0; otherwise returns the already-narrowed value (without the cancellation symbol).
- `prompts/framework.ts` — `promptFramework(): Promise<Framework>`: `select` with message `¿Qué tecnología quieres utilizar?`, options `vite` ("React + Vite", hint "Vite 8, React 19 y TypeScript 7") and `next` ("Next.js", hint "Next.js 16, App Router y React 19"), initial value `vite`. Revalidates with `isFramework` and throws on invalid values.
- `prompts/tech.ts` — `promptTechPreset(): Promise<TechPresetResult>` (`{ selection, notes }`): `multiselect` with message `¿Qué tecnologías quieres incluir? …`, one option per `TECH_OPTIONS` (label + hint), `initialValues` with all 10 ids, `required: false` (deselecting everything yields a valid core-only project). Builds the `TechSelection` record and resolves it with `resolveTechSelection`.
- `prompts/project.ts` — `promptProjectName(): Promise<string>`: `text` with message `¿Cuál es el nombre del proyecto?`, placeholder `my-project` and live validation with `validateProjectName`. Returns the trimmed, revalidated name.
- `prompts/github.ts` — `promptGitHubUrl(): Promise<string>`: `text` with message `¿Dónde se va a alojar el código?`, placeholder `https://github.com/raulmoracode/my-project` and validation with `validateGitHubUrl`. Normalizes by trimming, stripping trailing slashes and the `.git` suffix; revalidates and returns the normalized URL.
- `prompts/confirm.ts` — `promptOpenInVscode(): Promise<boolean>`: `confirm` with message `¿Quieres abrir el proyecto ahora?`, `Sí`/`No`, initial value `true`. Returns a boolean.

---

## 7. Generators layer

### 7.1 `generators/create-project.ts`

- `createProject(framework, name, cwd, verbose): Promise<string>` — delegates to `framework.createProject(...)` and returns the project directory.

### 7.2 `generators/configure-project.ts`

- `PNPM_VERSION = "12.6.0"` — version pinned in `packageManager` of generated projects.
- `REQUIRED_PNPM_MAJOR` — major derived from `PNPM_VERSION` (`12`); the preflight requires the user's pnpm to match it.
- `HUSKY_VERSION = "9.1.7"`, `COMMITLINT_CLI_VERSION = "21.2.3"`, `COMMITLINT_CONFIG_CONVENTIONAL_VERSION = "21.2.3"`, `CLASS_VARIANCE_AUTHORITY_VERSION = "0.7.1"`.
- `PROJECT_AUTHOR = { name: "Raul Mora", url: "https://raulmoracode.com" }`.
- `runtimeDependencies(selection = FULL_TECH_SELECTION): Record<string,string>` — exact pins filtered by selection: `zustand 5.0.15` (only if `zustand`), `react-hook-form 7.89.0` + `zod 4.6.5` (only if `forms`), `@tanstack/react-query 5.104.0` (only if `tanstack-query`).
- `devDependencies(framework, selection = FULL_TECH_SELECTION): Record<string,string>` — common filtered by selection: `@biomejs/biome 2.5.14` (only if `biome`), `vitest 5.0.2` + `@testing-library/react 16.3.3` + `@testing-library/dom 10.4.2` + `jsdom 30.1.1` (only if `testing`), `clsx 2.1.1` + `tailwind-merge 3.7.0` + `class-variance-authority 0.7.1` (only if `shadcn`), `husky` + `@commitlint/cli` + `@commitlint/config-conventional` (only if `husky`), `tailwindcss 4.3.3` (only if `tailwind`); plus `@tailwindcss/vite 4.3.3` (vite, only if `tailwind`) or `@tailwindcss/postcss 4.3.3` + `postcss 8.5.6` (next, only if `tailwind`).
- `pnpmInstallArgs(): string[]` → `["install"]`.
- `pnpmAddArgs(deps) / pnpmAddDevArgs(deps)` — build `["add", …"name@version"]` (plus `"-D"`).
- `stripRangePrefix(version)` (private) — removes leading `^`/`~`.
- `projectScripts(framework, selection)` (private) — `framework.scripts()` minus `check/format/lint` without Biome, minus `test` without testing, plus `prepare: husky` with Husky.
- `patchPackageJson(projectDir, framework, projectName, githubUrl, selection = FULL_TECH_SELECTION): Promise<void>` — reads the scaffold's `package.json` and sets `name`, `version: "0.1.0"`, `private: true`, `type: "module"`, `author` (Raul Mora), `homepage` (GitHub URL), `repository: { type: "git", url }`, computed `scripts`, `engines: { node: ">=24" }`, `packageManager: pnpm@12.6.0`; applies framework pins; adds Husky/Commitlint devDeps only with Husky (so the first `pnpm install` can run `prepare`); removes lint dependencies from the template per `removedDependencyPatterns()`; strips remaining `^`/`~`; rewrites the object in conventional order (metadata → scripts → engines → deps) preserving unknown template keys. No trace of deselected techs.
- `removeToolingConfig(projectDir, relativePaths)` — deletes the given list.
- `installDependencies(projectDir, framework, verbose, selection = FULL_TECH_SELECTION)` — `pnpm install --no-frozen-lockfile` (never frozen: the scaffold lockfile is stale by design after `patchPackageJson`, and pnpm 12 freezes installs when `CI=true`), `pnpm add <runtime>` (skipped when empty — a bare `add` would fail), `pnpm add -D <dev>` (skipped when empty).
- `pinnedPackages(framework, selection = FULL_TECH_SELECTION): string[]` — deduplicated `name@version` list of framework pins + runtime + dev (for excludes).
- `pnpmListJsonArgs(): string[]` → `["list", "--depth", "Infinity", "--json"]`.
- `refreshPnpmWorkspaceExcludes(projectDir, framework, verbose, selection = FULL_TECH_SELECTION)` — runs `pnpm list --json`, extracts with `collectLockedPackages` every locked `name@version` (direct + transitive), merges them with `pinnedPackages` and `registryScopeExcludes(selection)` (`@raulmoracode/*`, only with shadcn) and rewrites `pnpm-workspace.yaml` with `mergePnpmWorkspaceYaml` (preserves existing template entries). On `pnpm list` failure, falls back to direct pins only.
- `normalizePackageJson(projectDir)` — second pass removing `^`/`~` that pnpm may have written during `add`.

### 7.3 `generators/configure-biome.ts`

- `TOOLING_CONFIG_FILES = ["eslint.config.mjs", "eslint.config.js", ".oxlintrc.json", "_oxlintrc.json", "oxlint.json"]`.
- `configureBiome(projectDir)` — writes `biome.json` and deletes those files when present.
- `biomeCheckWriteArgs()` → `["exec", "biome", "check", "--write", "."]`.
- `formatProject(projectDir, verbose)` — `pnpm exec biome check --write .` in the project (self-formatting after install; only called with Biome selected).

### 7.4 `generators/configure-node.ts`

- `REQUIRED_GITIGNORE_ENTRIES = ["node_modules", "dist", ".env", ".env.*", ".next", "coverage"]` (private).
- `configureNode(projectDir)` — writes `.nvmrc`.
- `nodeVersion(): string` — returns `NODE_VERSION`.
- `configureEditorconfig(projectDir)` — writes `.editorconfig`.
- `requiredGitignoreEntries(): string[]` — copy of the list.
- `augmentGitignore(projectDir)` — appends missing entries to the template's `.gitignore` without duplicating; creates it when absent.

### 7.5 Remaining generators (one main function each)

- `configure-shadcn.ts` — `configureShadcn(projectDir, framework)`: writes `components.json` (with `framework.componentsJsonOptions()`), `src/lib/utils.ts` (`cn()`) and the `@raulmoracode` registry path aliases in every tsconfig present (`ensureRegistryAliases`, merged via pure `withRegistryAliases()`, missing files skipped).
- `configure-readme.ts` — `configureReadme(projectDir, framework, projectName, githubUrl, selection = FULL_TECH_SELECTION)`: overwrites the scaffold `README.md` with `readmeMd(...)` using the final `package.json` scripts plus framework pins and `runtime/devDependencies` versions.
- `configure-theme.ts` — `themeAddArgs()` (pure `pnpm dlx shadcn@4.21.0 add @raulmoracode/theme --yes --overwrite`) + `applyRegistryTheme(projectDir, framework, verbose)`: runs the shadcn CLI, removes its `src/`-prefixed junk (`src/package.json`, `src/tsconfig.json`, `src/postcss.config.mjs`, plus `src/app/globals.css` on Vite where tokens already landed in the entry CSS) and restores registry aliases. Runs after shadcn, before `patchPackageJson`.
- `configure-testing.ts` — `configureTesting(projectDir)`: writes `vitest.config.ts` and `src/test/smoke.test.tsx`.
- `configure-vscode.ts` — `configureVscode(projectDir)`: writes `.vscode/settings.json` and `.vscode/extensions.json`.
- `configure-git-hooks.ts` — `configureGitHooks(projectDir, selection = FULL_TECH_SELECTION)`: writes `.husky/pre-commit` (`huskyPreCommit(selection)`), `.husky/commit-msg`, marks both executable, and writes `commitlint.config.ts`.
- `configure-changelog.ts` — `configureChangelog(projectDir)`: writes `CHANGELOG.md` (`changelogMd()`).
- `configure-ci.ts` — `configureCi(projectDir)`: writes `.github/workflows/ci.yml` (`ciWorkflowYaml()`).

---

## 8. Frameworks layer

### 8.1 `frameworks/types.ts`

- `PackageJson`: `name`, `version`, `private`, `type`, `author`, `homepage`, `repository`, `scripts`, `dependencies`, `devDependencies`, `engines`, `packageManager` + `[key: string]: unknown` index.
- `ProjectFramework`: `id`, `label`, `createProject(name, cwd, verbose)`, `scripts()`, `pinnedDependencies()`, `pinnedDevDependencies()`, `removedDependencyPatterns()`, `componentsJsonOptions()`, `configureTailwind()`, `configureTanStackQuery()`, `configureBranding()`, and optional `configureStarter?()`.

### 8.2 `frameworks/index.ts`

- `frameworks: Record<Framework, ProjectFramework>` with `vite` and `next`.
- `getFramework(id)` plus type re-export.

### 8.3 `frameworks/vite.ts` (`id: "vite"`, label `"React + Vite"`)

- `CREATE_VITE_VERSION = "9.2.1"`.
- `createProject`: `pnpm create vite@9.2.1 <name> --template react-ts`.
- `scripts()`: `dev: vite`, `build: vite build`, `check/format/lint` (biome), `test: vitest`.
- Pins: `react`/`react-dom` `19.3.0`; dev `typescript 7.0.2`, `vite 8.3.1`, `@vitejs/plugin-react 6.1.1`. Removal patterns: `/eslint/i`, `/oxlint/i`, `/^globals$/`.
- `componentsJsonOptions()`: `{ rsc: false, tailwindCssPath: "src/index.css" }`.
- `VITE_MAIN_TSX` (private): rewritten `main.tsx` with `QueryClientProvider` + guard without non-null assertion (`if (!rootElement) throw …`).
- `ensurePathAlias(projectDir)` (private): merges `paths: { "@/*": ["./src/*"] }` into `tsconfig.app.json` **and** the root `tsconfig.json` (the latter is what the shadcn CLI reads; both parsed as JSONC). Never writes `baseUrl` (TypeScript 7 removed the option, TS5102). Merges instead of replacing so the registry aliases written earlier by `configureShadcn` survive. Skips missing files.
- `VITE_APP_TSX` (private): minimal `App.tsx` (`import "./App.css"`, `return <div>hello</div>`).
- `configureTailwind`: rewrites `vite.config.ts` (`react()` + `tailwindcss()` plugins, `@` → `./src` alias via `fileURLToPath`) and `src/index.css` (`@import "tailwindcss";`).
- `configureTanStackQuery`: writes `src/lib/query-client.ts` and `main.tsx`.
- `configureStarter`: empties `public/` and `src/assets/` (keeps the directories), writes minimal `App.tsx`, empties `App.css` (kept because `App.tsx` imports it), writes `AGENTS.md`, applies `ensurePathAlias`.
- `configureBranding`: in `index.html`, replaces `<title>…</title>` with `<title>raulmoracode</title>` and the `<link rel="icon">` with the CDN one (`type="image/x-icon"`); clear error when both patterns are not found.

### 8.4 `frameworks/next.ts` (`id: "next"`, label `"Next.js"`)

- `CREATE_NEXT_APP_VERSION = "16.3.6"`.
- `createProject`: `pnpm create next-app@16.3.6 <name> --ts --app --src-dir --import-alias "@/*" --biome --use-pnpm --disable-git --yes` (no `--tailwind`: Tailwind is configured by the scaffolder to pin the version).
- `scripts()`: `dev: next dev`, `build: next build`, `start: next start`, `check/format/lint` (biome), `test: vitest`.
- Pins: `next 16.3.6`, `react`/`react-dom` `19.3.0`; dev `typescript 7.0.2`. Removal patterns: `/eslint/i`, `/oxlint/i`.
- `componentsJsonOptions()`: `{ rsc: true, tailwindCssPath: "src/app/globals.css" }`.
- `NEXT_PAGE_TSX` (private): minimal `page.tsx` (`export default function Home() { return <div>hello</div>; }`).
- `PROVIDERS_TSX` (private): `src/app/providers.tsx` (`"use client"`, `Providers` with `QueryClientProvider`).
- `configureTailwind`: rewrites `src/app/globals.css` (`@import "tailwindcss";`) and `postcss.config.mjs` (`@tailwindcss/postcss` plugin).
- `configureTanStackQuery`: writes `src/lib/query-client.ts` and `providers.tsx`; patches `src/app/layout.tsx` wrapping `{children}` with `<Providers>` (regex tolerant to `<body>` attributes) and adds the import; clear error on mismatch.
- `configureBranding`: patches the layout `metadata` (`title: "raulmoracode"` + `icons: { icon: <CDN> }`, regex over any previous `title:`); deletes the default `src/app/favicon.ico`.
- `configureStarter`: empties `public/`; writes minimal `page.tsx`; deletes orphaned `page.module.css` and `CLAUDE.md`; writes `AGENTS.md` (the template's `AGENTS.md` is kept/overwritten with our own).

---

## 9. Git layer (pure constructors + thin wrappers)

- `git/init.ts` — `initArgs()` → `["init"]`; `branchArgs()` → `["branch", "-M", "main"]`; `initRepository(dir, verbose)` runs both.
- `git/remote.ts` — `remoteAddArgs(url)` → `["remote", "add", "origin", url]`; `remoteGetUrlArgs()` → `["remote", "get-url", "origin"]`; `lsRemoteArgs(url)` → `["ls-remote", url]`; `addRemote`, `remoteExists` (boolean, never throws), `lsRemote` (returns stdout), `isRemoteEmpty` (empty stdout).
- `git/commit.ts` — `INITIAL_COMMIT_MESSAGE = "chore: initial project setup"`; `addArgs()` → `["add", "."]`; `commitArgs(message?)` → `["commit", "-m", message]`; `createCommit` runs both.
- `git/push.ts` — `pushArgs()` → `["push", "-u", "origin", "main"]` (never `--force`); `fetchArgs()`, `revParseArgs(ref)`, `mergeBaseIsAncestorArgs(a, b)`; `push`, `fetchRemote`; `resolveSha` (null on failure); `isAncestor` (false on failure); `remoteHasDivergentCommits(dir, verbose)`: `fetch`, resolves `origin/main` and `HEAD`; `false` when there is no remote / they match / the remote is an ancestor; `true` otherwise (stops the push with a clear message).

---

## 10. Config layer (pure templates)

| File | Export(s) | Generates |
|---|---|---|
| `agents.ts` | `agentsMd()` | `AGENTS.md`: guidelines (source of truth, principles, dependencies, style, shadcn, architecture, validation `pnpm check/test/build`, non-destructive Git, security, dependencies, working code, final response) + `Project tooling` section (pnpm exclusively, script map, shadcn workflow) + `Git hooks and commits` section (Husky, Commitlint, Conventional Commits with types and style rules) + `Changelog` section (keep `CHANGELOG.md` updated) + `Project structure` tree + `Adding dependencies` (exact versions) + `Environment variables` + `Deployment` (manual, provider-agnostic) |
| `args.ts` (in `cli/`, not pure-template) | `VERSION`, `parseArgs()`, `helpText()`, `printHelp()` | `--help` / `--version` output |
| `biome.ts` | `biomeConfig()` | `biome.json`: local `$schema`, `files.includes` (`**`, `!dist`, `!.next`), 2-space formatter, `assist.actions.source.organizeImports: "on"`, linter on with `noSvgWithoutTitle`/`noAmbiguousAnchorText` `off`, `overrides` disabling formatter/linter/assist for the Tailwind entry files (`src/index.css`, `src/app/globals.css`, whose v4 directives Biome cannot parse) |
| `branding.ts` | `SITE_TITLE = "raulmoracode"`, `FAVICON_URL = "https://cdn.raulmoracode.com/icons/favicon.ico"`, `TWITTER_CARD = "summary_large_image"`, `TWITTER_SITE_HANDLE`/`TWITTER_CREATOR_HANDLE`, `SOCIAL_IMAGE_URL`, `SOCIAL_DESCRIPTION_LIMIT = 200` | — |
| `commitlint.ts` | `commitlintConfig()` | `commitlint.config.ts` (`{ extends: ["@commitlint/config-conventional"] }`) |
| `changelog.ts` | `changelogMd()` | `CHANGELOG.md` (Keep a Changelog: header + `[Unreleased]` with `Added`/`Changed`/`Fixed`) |
| `ci.ts` | `ciWorkflowYaml()` | `.github/workflows/ci.yml` (validate-only CI: `install`/`check`/`test`/`build` on push and PR, no deploys) |
| `components.ts` | `RAULMORACODE_REGISTRY_NAME/URL/CATALOG_URL/ADD_EXAMPLE`, `REGISTRY_PATH_ALIASES`, `REGISTRY_SCOPE_EXCLUDE`, `REGISTRY_THEME_SPEC`, `ComponentsJsonOptions`, `componentsJson({rsc, tailwindCssPath})`, `utilsTs()`, `withRegistryAliases(existing?)`, `registryScopeExcludes(selection?)` | full `components.json` (`$schema`, `new-york`, `rsc`, `tsx`, `tailwind`, `aliases`, `registries: {"@raulmoracode": "https://registry.raulmoracode.com/r/{name}.json"}`) and `cn()` with `clsx`+`tailwind-merge`; registry tsconfig aliases (`@components/*`, `@lib/*`, `@hooks/*` → `src/...`, existing entries win); scope maturity exclusion (`@raulmoracode/*`, only with shadcn) |
| `editorconfig.ts` | `editorconfigContent()` | `.editorconfig` (`root`, utf-8, lf, 2 spaces, final newline, trim) |
| `husky.ts` | `huskyPreCommit(selection?)`, `huskyCommitMsg()` | `.husky/pre-commit` (`pnpm check` only with Biome, `pnpm test` only with testing) and `.husky/commit-msg` (`pnpm exec commitlint --edit "$1"`), always ending in `\n` |
| `nvmrc.ts` | `NODE_VERSION = "24"`, `nvmrcContent()` | `.nvmrc` with `24` |
| `error-pages.ts` | `nextErrorPage()`, `nextNotFoundPage()` | Next.js only: `src/app/error.tsx` (Client Component with `reset`, exported as `ErrorPage` because Biome rejects a function named `Error`) and `src/app/not-found.tsx`. File conventions, no wiring; only Tailwind utilities that exist everywhere, never theme tokens |

| `license.ts` | `LICENSE_TYPE = "MIT"`, `LICENSE_HOLDER = "Raul Mora"`, `licenseText({holder, year})` | the `LICENSE` file in the project root: MIT with the project author (the same one written to `package.json`) and the year it was generated, so it never goes stale |
| `site.ts` | `SiteValues`, `SITE_CONFIG_PATH = "src/config/site.ts"`, `SITE_HEAD_COMMENT`, `describeStack(packageJson)`, `siteValues({projectName, packageJson})`, `siteConfigTs(values)`, `viteSiteHeadImport()`, `viteSiteHeadPlugin()`, `nextSiteMetadata()` | `src/config/site.ts` (the only file a generated project has to edit for its identity: name, title, description, url, favicon, socialImage, socialImageAlt, author, twitter, locale, themeColor), the `siteHead()` Vite plugin that injects the head tags, and the Next `metadata` export built from the same object. `siteValues` seeds the defaults from the project name and the pinned stack (`description` is empty on purpose: an empty value is never rendered, so no blank meta tag is emitted). `favicon` and `socialImage` accept a full URL or a local path under `public/`; nothing is generated, the project provides the file. The Vite plugin resolves a local `socialImage` against `site.url` when it is set, because crawlers cannot resolve relative URLs (Next does it natively via `metadataBase`) |
| `pnpm-workspace.ts` | `PNPM_MINIMUM_RELEASE_AGE = 10080`, `pnpmWorkspaceYaml()`, `collectLockedPackages(tree)`, `mergePnpmWorkspaceYaml(existing, excludes)` | `pnpm-workspace.yaml` (`minimumReleaseAge` + sorted, single-quoted `minimumReleaseAgeExclude`; existing entries are merged after stripping any quoting, so entries another tool (the shadcn CLI) already quoted are never double-quoted) |
| `query.ts` | `queryClientConfig()` | `query-client.ts` (`staleTime` 60s, `gcTime` 5min, `retry: false`) |
| `readme.ts` | `CREATE_REPO_URL`, `SITE_URL`, `ReadmeOptions`, `readmeMd(options)` | project `README.md`: name title, framework credit, requirements (Node 24, pinned pnpm), scripts table (final scripts only, canonical order, lifecycle skipped), selected stack with exact versions, shadcn registry section (only with shadcn), Git workflow (only with Husky), Continuous integration section (CI steps + manual deploy), site identity section pointing at `src/config/site.ts`, gated per-framework structure tree (CI entry, `CHANGELOG.md`, Husky/Biome/Vitest/VS Code files, `LICENSE`, `src/config/site.ts`, Next error pages), links |
| `tailwind.ts` | `tailwindCss()`, `viteTailwindConfig()`, `nextPostcssConfig()` | `@import "tailwindcss";`, `vite.config.ts` (react + tailwind + `@` alias), `postcss.config.mjs` |
| `tech.ts` | `TECH_IDS`, `TechId`, `TechSelection`, `TECH_OPTIONS`, `FULL_TECH_SELECTION`, `resolveTechSelection()` | tech preset multiselect options; `resolveTechSelection` forces shadcn back on with the theme and Tailwind back on with shadcn (plus notes) |
| `testing.ts` | `vitestConfig()`, `smokeTest()` | `vitest.config.ts` (`environment: jsdom`) and `src/test/smoke.test.tsx` (Testing Library render) |
| `vscode.ts` | `vscodeSettings()`, `vscodeExtensions()` | Biome as JS/TS/JSON(+C) formatter, format on save, organize imports, tab 2, local `js/ts.tsdk.path` (formerly `typescript.tsdk`, deprecated by VS Code); recommends `biomejs.biome` |

---

## 11. Utils layer

**`utils/exec.ts`** — only process-execution path (`spawn`, arg arrays, never interpolation):
- `ExecOptions { cwd?, verbose?, env? }`, `ExecResult { code, stdout, stderr }`.
- `ExecError`: `command`, `args`, `code`, `signal`, `stdout`, `stderr`, `spawnError`; message `Command failed: <cmd args>\n<detail>` (spawnError, stderr, stdout, or code).
- `resolveExecutable` (private): on win32 appends `.cmd` except paths or known extensions; `resolveCommand` exposes it; `formatCommand` joins for display.
- `exec(command, args, options)`: `stdio: ["ignore","pipe","pipe"]`; streams output live when `verbose`; `error` (ENOENT) → `ExecError` with `spawnError`; non-zero `close` → `ExecError`; `settled` flag against double resolution.

**`utils/filesystem.ts`** — `pathExists`, `isDirectory`, `isDirectoryEmpty`, `listDirEntries`, `ensureDir` (recursive), `writeTextFile` (creates parents), `readTextFile`, `readJsonFile<T>`, `stripJsonComments` + `parseJsonc<T>` (JSONC with `//` and `/* */` respecting strings and escapes), `removeIfExists` (recursive+force `rm`), `joinPath`, `resolvePath`, `removeEmptyDir` (only succeeds when empty), `makeExecutable` (`chmod 0o755`).

**`utils/validation.ts`** — `Framework = "vite" | "next"`; `ValidationResult { valid, error? }`; `validateProjectName` (empty, surrounding spaces, >214 chars, leading `.`/`_`, lowercase+digits+`._~-` regex, npm + Windows reserved names); `GitHubUrlResult { owner?, repo? }`; `validateGitHubUrl` (https, `github.com`, no credentials, `owner/repo`, owner/repo regexes); `isFramework` (type guard), `validateFramework`; `satisfiesNodeVersion(version, minimumMajor)` (parses major, compares); `satisfiesPnpmVersion(version, requiredMajor)` (trims, tolerates a leading `v`, parses `X.Y.Z` incl. prereleases, valid only when the major is exactly `requiredMajor`).

---

## 12. Tests (`vitest run`, `node` environment, `tests/**/*.test.ts`)

| File | What it covers |
|---|---|
| `validation.test.ts` | Names (valid/invalid, length, reserved), GitHub URLs (protocol, host, credentials, format), `isFramework`/`validateFramework`, `satisfiesNodeVersion`, `satisfiesPnpmVersion` (12.x, leading `v`, whitespace, prerelease, 11.x/13.x, garbage, empty) |
| `config.test.ts` | `.nvmrc`, `components.json` + `cn()` + registry aliases/merge/add example, generated `README.md` (title, scripts table, gated stack/sections, per-framework variants), `biome.json`, `.editorconfig`, VS Code, branding, `pnpm-workspace.yaml` (merge + `collectLockedPackages`), agents guide (namespaced shadcn example + Git hooks section), Tailwind (incl. `@` alias), query client, vitest/jsdom, tech preset (`FULL_TECH_SELECTION` incl. theme, `resolveTechSelection` cascades), adaptive Husky hooks, Commitlint config, CI workflow template (install/check/test/build steps, no deploys), CHANGELOG template (Keep a Changelog + `[Unreleased]`) |
| `frameworks.test.ts` | Framework registration, exact pins per framework, scripts, removal patterns, runtime/dev lists (no `lucide-react`, `tw-animate-css` only with theme), pnpm constructors, `patchPackageJson` and `normalizePackageJson` against temp `package.json` (incl. author/homepage/repository, `prepare: husky`), no-trace patch with deselected techs, dependency filtering |
| `generators.test.ts` | Each `configure*` against temp dirs: node/editorconfig/gitignore, vite/next branding (incl. clear failures), vite/next starter (vite starter preserves registry aliases), workspace refresh (mocked `exec`: JSON success, fallback, preservation, Husky pins), shadcn (registry + `cn()` + tsconfig aliases incl. merge/preservation/missing-file skip), readme overwrite (name, final scripts, tech gating per framework), theme (exact dlx args, junk cleanup per framework, alias restore; mocked `exec`), biome (+linter deletion), vscode, testing, git hooks (exact contents, adaptive `pre-commit`, executable bit), ci (`.github/workflows/ci.yml` steps), changelog (`CHANGELOG.md` structure) |
| `install.test.ts` | `installDependencies` with mocked `exec`: order `install` → `add` (exact runtime) → `add -D` (incl. tailwind/biome/vitest/testing-library/clsx/cva/husky/commitlint), `cwd` correctness, empty-add skipping with deselected techs, PostCSS variant on Next, `ExecError` propagation |
| `git.test.ts` | Constructors (`init`, `branch -M main`, `remote add`, `add .`, `commit`, `push` without force) + integration with real Git in temp dirs: init on `main`, remote, initial commit, push to a bare repo |
| `exec.test.ts` | Real `exec`: stdout, non-zero exit, stderr, missing binary (`spawnError`), `cwd`, args-as-array without interpolation; per-platform `resolveCommand`; `formatCommand` |
| `error-handling.test.ts` | Mocked `exec` (`importOriginal` + override): missing pnpm/git, non-zero exits, `remoteHasDivergentCommits` (diverge/ancestor/no-branch/same), `PreflightError`, invalid URLs, `REMOTE_CONFLICT_MESSAGE` |
| `package-metadata.test.ts` | `name`, `bin` exactly `{raulmoracode-create: ./dist/index.js}` (and no `create` key), `files` with `dist`, npmjs registry, `engines`, `packageManager`, scripts, exact versions, repo/bugs/license/keywords, plus generated `prepare: husky`, Husky/Commitlint pins and `pinnedPackages`/`normalize` coverage |
| `args.test.ts` | `parseArgs` (defaults, each flag, combined, unknown ignored, `-v` ≠ version), `VERSION` pinned to `package.json`, help text contents, `printHelp` stdout |
| `recovery.test.ts` | `shouldRemoveProjectDir` decision table + full `run()` integration (mocked Clack/exec, temp dirs, Node 24 only): mid-task failure removes the dir + exit 1; pre-task failure restores a reused empty dir + exit 1 |
| `preflight.test.ts` | Full `run()` preflight with mocked Clack/exec (Node 24 only): `REQUIRED_PNPM_MAJOR` derived from `PNPM_VERSION`; pnpm 13.x or unparsable output → exact actionable error + exit 1 before any prompt; pnpm 12.x proceeds with a single `pnpm --version` call in the order pnpm → git → identity |
| `e2e-scheduled-workflow.test.ts` | `.github/workflows/e2e-scheduled.yml`: weekly `schedule` + `workflow_dispatch` (no push/PR), read-only permissions, `[vite, next]` matrix with `fail-fast: false`, Node 24 + pnpm cache, frozen-lockfile install, E2E command with `E2E_FRAMEWORK: ${{ matrix.framework }}`, observe-only (no updates, pushes or secrets) |
| `upgrade-pr-body.test.ts` | `upgradePrTitle`; `upgradePrBody` (empty plan, section order, all file statuses, counts table, notes with/without `action`, unmatched overwritten file, no-content diff placeholder, pipe/newline escaping, CRLF normalisation, action items derived from notes and from Biome/testing/CI files); `unifiedDiff` (identical → `""`, single change, insertions/deletions, line and character caps), `diffLineCounts`/`diffCounts`; `truncateForGithub` (short body untouched, limit enforced, summary/⚠️/tables/action items preserved, note inserted, idempotent) |
| `github.test.ts` | Arg builders (`gh auth status`, `gh pr list`, `gh pr create` with `--body-file` and no `--draft`, `gh repo view`); `requireGhAuth` (`GhAuthError`, `gh auth login`, missing-binary message); `findOpenPullRequest` with mocked `exec` (url, `[]`, empty, garbage, entry without url, non-zero exit → `null`); `createPullRequest` (temp file written with the exact body and removed afterwards even on failure, URL extraction, error when `gh` prints no URL); `repoDefaultBranch` (value, empty, failure) |
| `e2e.test.ts` | Opt-in with `E2E_FRAMEWORK=vite` or `next` (skipped by plain `pnpm test`); full `run()` with mocked Clack (incl. `multiselect` → full preset with theme) and real `exec` except `ls-remote` (empty) and `remote add` (rewritten to a local bare repo): official scaffold, pins (incl. `tw-animate-css`), files (incl. `.husky/`, `commitlint.config.ts`, `.github/workflows/ci.yml`, `CHANGELOG.md`), themed entry CSS with nature tokens, no theme junk under `src/`, `node_modules`+`pnpm-lock.yaml` (no other lockfiles), workspace, per-framework branding/starter, `AGENTS.md` Git-hooks section, generated `README.md` (project name + generator credit), `pnpm check` + `vitest run` + `build`, initial commit and push to the bare repo. Runs in both variants (`E2E_FRAMEWORK=next` for Next) |

---

## 13. Root config files

- **`package.json`**: `name @raulmoracode/create`, `version 1.0.7`, `description`, 12 `keywords`, `homepage`/`bugs`/`repository` (git+https to `raulmoracode/raulmoracode-create`), `license MIT`, `author raulmoracode`, `type module`, `main`+`exports` to `./dist/index.js`, single `bin`, `files: [dist, README.md, LICENSE]`, scripts (`build/check/format/lint/test/prepublishOnly`), 1 dependency + 4 exact devDeps, `engines node >=24`, `packageManager pnpm@12.6.0`, npmjs `publishConfig` with `access public`.
- **`tsconfig.json`**: `target ES2022`, `module/moduleResolution NodeNext` (imports with `.js` extension), `outDir dist`, `rootDir src`, `strict` + `noUncheckedIndexedAccess`, `types: [node]`, `include: [src]`.
- **`vitest.config.ts`**: `node` environment, `include tests/**/*.test.ts`.
- **`biome.json`** (own): local schema, `files.includes ["**", "!dist"]` (native `tsc` emits with its own formatting), 2-space formatter, `assist` organize imports, linter.
- **`.nvmrc`**: `24`. **`.gitignore`**: `node_modules`, `dist`, `.env`, `.env.*`, `*.tgz`.
- **`.github/workflows/publish.yml`**: on `v*` tags, with `contents:read` permission: checkout, pnpm 12, Node 24 (npmjs registry + pnpm cache), `install --frozen-lockfile`, `build`, `test`, `npm publish --access public` with `NPM_TOKEN`.
- **`.github/workflows/ci.yml`**: on `main` pushes and pull requests, with `contents:read` permission: `validate` job (checkout, pnpm 12, Node 24 + pnpm cache, `install --frozen-lockfile`, `check`, `lint`, `test` with E2E skipped, `build`) plus one E2E job per framework (`e2e-vite` with `E2E_FRAMEWORK=vite`, `e2e-next` with `E2E_FRAMEWORK=next`).
- **`.github/workflows/e2e-scheduled.yml`**: weekly (`cron: 0 6 * * 1`, Mondays UTC) and `workflow_dispatch`, with `contents:read` permission: one `e2e` job over `framework: [vite, next]` (`fail-fast: false`, `timeout-minutes: 30`): checkout, pnpm 12, Node 24 + pnpm cache, `install --frozen-lockfile`, `pnpm test --run tests/e2e.test.ts` with `E2E_FRAMEWORK` from the matrix. Detects breakage outside the pins (transitive deps, `registry.raulmoracode.com`, GitHub/npm); it never updates pins or the lockfile. Failures notify by email; GitHub disables scheduled workflows after 60 days of repo inactivity.
- **`README.md`**: global install (npmjs, no auth), usage (`raulmoracode-create`, flags, tech preset), what it does, generated contents, Git auth, publish, development, architecture, verified adjustments, packaging.
- **`LICENSE`**: MIT.

---

## 14. Generated project reference

### 14.1 Exact pinned versions (no `^`/`~`)

| Dependency | Version | | Dependency | Version |
|---|---|---|---|---|
| Node.js | 24 LTS | | Tailwind CSS | 4.3.3 |
| React / React DOM | 19.3.0 | | shadcn (CLI via dlx) | 4.21.0 |
| TypeScript | 7.0.2 | | Zustand | 5.0.15 |
| Vite | 8.3.1 (+ plugin-react 6.1.1) | | React Hook Form | 7.89.0 |
| Next.js | 16.3.6 | | Zod | 4.6.5 |
| TanStack Query | 5.104.0 | | Biome | 2.5.14 |
| Vitest | 5.0.2 | | testing-library/react | 16.3.3 |
| testing-library/dom | 10.4.2 | | jsdom | 30.1.1 |
| clsx | 2.1.1 | | tailwind-merge | 3.7.0 |
| class-variance-authority | 0.7.1 | | Husky | 9.1.7 |
| @commitlint/cli | 21.2.3 | | @commitlint/config-conventional | 21.2.3 |
| pnpm | 12.6.0 | | | |
| postcss (Next only) | 8.5.6 | | @tailwindcss/vite or /postcss | 4.3.3 |

### 14.2 Generated files (full preset)

`package.json` (name, `0.1.0`, `private`, `type module`, `author` Raul Mora, `homepage`+`repository` with the entered URL, `prepare: husky`, framework scripts, `engines`, `packageManager`), `pnpm-lock.yaml` (no `package-lock.json`/`yarn.lock`), `.nvmrc`, `.editorconfig`, augmented `.gitignore`, `biome.json`, `commitlint.config.ts`, `.husky/pre-commit` + `.husky/commit-msg` (executable), `components.json`, `vitest.config.ts`, `src/test/smoke.test.tsx`, `src/lib/query-client.ts`, `src/lib/utils.ts` (`cn`), `.vscode/settings.json` + `extensions.json`, `pnpm-workspace.yaml` (`minimumReleaseAge: 10080` + excludes for the whole lockfile), `.github/workflows/ci.yml` (install/check/test/build on push/PR), `CHANGELOG.md` (Keep a Changelog + `[Unreleased]`), `AGENTS.md`, official generator structure, Git repo on `main` with remote/initial commit/push.

Deselected techs leave no trace: no files, no scripts, no dependencies. Vite scripts: `dev: vite`, `build: vite build`, `check/format/lint` (biome, only with Biome), `test: vitest` (only with testing). Next scripts: `dev: next dev`, `build: next build`, `start: next start` + the same biome/test scripts when selected.

### 14.3 Vite specifics

`index.html` (`raulmoracode` title, CDN favicon), `vite.config.ts` (react + tailwind + `@` alias), `src/index.css`, `src/main.tsx` (provider), minimal `src/App.tsx` + empty `App.css`, emptied `public/` and `src/assets/`, `tsconfig.app.json` and root `tsconfig.json` with `paths @/*` (no `baseUrl`: removed in TypeScript 7).

### 14.4 Next.js specifics

`src/app/{layout.tsx` (title+icons CDN, wrapped in `Providers`), minimal `page.tsx`, `providers.tsx`, `globals.css`, `postcss.config.mjs`, `error.tsx`, `not-found.tsx`}; deleted default `page.module.css`, `favicon.ico` and `CLAUDE.md`; the template's `AGENTS.md` kept and overwritten with our own.

---

## 15. Full execution sequence

1. `node dist/index.js` (or `raulmoracode-create`) → flags (`--help`/`--version` exit early) → `run({ verbose })`.
2. Preflight: Node ≥24 → pnpm (exists + major 12) → git → Git identity (no tokens involved).
3. Prompts: framework → tech preset → name → GitHub URL (normalized without trailing `/` or `.git`).
4. Destination: `<cwd>/<name>` (empty→reused and removed; with content→error, never deletes).
5. `git ls-remote <url>` (access to the already-existing remote).
6. Tasks: scaffold gated by selection → `package.json` → `.gitignore` → installs (`install`+`add`+`add -D`, skipping empty adds) → normalization → `biome check --write` (only with Biome) → pnpm workspace → git init/`-M main` (+ `pnpm exec husky` only with Husky) → remote → `add .`+commit → fetch+divergence check → `push -u origin main`.
7. Summary (framework, `./<name>`, URL) → `¿Quieres abrir el proyecto ahora?` → `code .` (tolerant) → farewell.
8. Errors: `failedStep` recorded per task; cleanup when everything was CLI-created (never on push failure; empty-dir restore on pre-task failures) + actionable hint → exit 1 (130 on SIGINT/SIGTERM); Clack cancellation → clean exit 0.

---

## 16. Design decisions and verified deviations

- `create-vite@8.3.1` does not exist: scaffold with `create-vite@9.2.1` (the line that scaffolds Vite 8) and pin `vite@8.3.1`.
- Minimal `components.json` is rejected by shadcn 4.x: generate the full configuration with the exact required `@raulmoracode` registry.
- Biome 2.5.14 moved `organizeImports` to `assist.actions.source`; ignore `dist`/`.next`; disable `noSvgWithoutTitle`/`noAmbiguousAnchorText` (fire on the official templates' demo assets).
- `jsdom` (Testing Library), `clsx`+`tailwind-merge` (`cn()`), `class-variance-authority` (`cva()` variants used by shadcn components such as `button`) and Husky/Commitlint (hooks) are necessary additions not listed in the original spec.
- `minimumReleaseAge: 10080` is written **after** installing (otherwise pnpm rejects recent versions) with excludes for the **whole** lockfile via `pnpm list --json` (+pins as fallback).
- Next layout patched with tolerant regexes (the template already changed once: `className` on `<body>`); `tsconfig.app.json` parsed as JSONC (the template carries comments).
- shadcn on Vite needs the `@/*` alias in `vite.config.ts` **and** both tsconfigs (the CLI only reads the root one; without it a literal `@/` folder is created).
- VS Code deprecated `typescript.tsdk` in favor of `js/ts.tsdk.path` (unified `js/ts.*` namespace); generated settings use the new key.
- `prepare: husky` requires Husky to already be listed in `patchPackageJson`; otherwise the first `pnpm install` fails with exit 127. `pnpm exec husky` must run after `git init` (the install-time `prepare` runs without `.git` and only warns).

---

## 17. GitHub layer (`src/github/gh.ts`, `gh` wrappers only)

Same style as `git/`: pure arg builders (unit-testable without `gh`) plus thin wrappers that run everything through `utils/exec.ts` with an **args array**. No Clack, no markdown, no upgrade logic.

| Export | Command | Notes |
|---|---|---|
| `ghAuthStatusArgs()` | `gh auth status` | |
| `ghPrListArgs(head)` | `gh pr list --head <head> --state open --json url --limit 1` | |
| `ghPrCreateArgs({base,head,title,bodyFile})` | `gh pr create --base <base> --head <head> --title <title> --body-file <file>` | **never** `--draft`: the upgrade PR must be reviewable immediately |
| `ghRepoViewArgs()` | `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` | |
| `requireGhAuth(verbose)` | runs `gh auth status` | throws `GhAuthError` (defined in `github/`, not imported from `cli/run.ts`, so the layer stays CLI-free) with a Spanish message: `gh auth login`, or how to install `gh` when the binary is missing (`ExecError.spawnError`) |
| `findOpenPullRequest(cwd, head, verbose)` | `gh pr list` | first `url`, or `null` for `[]`, empty output, non-JSON garbage or a non-zero exit |
| `createPullRequest({cwd,base,head,title,body,verbose})` | `gh pr create` | writes the body to a temp file (`utils/filesystem.ts`, `tmpdir()` + UUID) and always removes it in `finally`; returns the first `https://…` line of stdout, throws when `gh` printed none |
| `repoDefaultBranch(cwd, verbose)` | `gh repo view` | branch name, or `null` on empty output/failure; used by the engine to pick the base branch |

Why `--body-file`: a generated upgrade body can be tens of kilobytes with markdown, unicode and code fences; passing it inline risks argument-length limits and any shell interpolation, while a file is transmitted byte-for-byte.

---

## 18. Upgrade pull request body (`src/upgrade/pr-body.ts`, pure)

`upgradePrBody(report: UpgradeReport)` derives the whole English body from the report alone (no I/O, no dates, no machine paths), and `upgradePrTitle(report)` returns `chore: upgrade raulmoracode-create to <toVersion>`. Sections, in order:

1. `# Upgrade raulmoracode-create <from> → <to>` plus the trim-note anchor.
2. `## Summary` — one paragraph (versions, framework, what the CLI owns) + a counts table (updated / new / overwritten with local changes / removed / skipped / dependencies updated / kept / migrations) and a `> [!WARNING]` line when files were overwritten.
3. `## ⚠️ Overwritten files with local changes` — **only** when `files` contains `overwritten` entries, placed high on purpose: per file the path, the matched `what`/`why`/`action` from the release notes (or an explicit "no upgrade note for this file"), the `<details>` diff of `previousContent` → `nextContent`, and the reminder that the file is isolated in its own commit so customizations can be re-applied on top.
4. `## Changes by version` — one `### <version>` subsection per note, ascending, with a `File | Status | +/− lines | What | Why` table (rows matched against `files`; unknown paths render `—`) and an `Action` bullet list when the notes define one, plus the per-file collapsed diffs.
5. `## Dependencies` — `Package | Type | From | To | Note` (`had a local version` when `hadLocalVersion`) and a `### Kept as-is` table for `keptDependencies`.
6. `## Migrations` — id, version, description, why per applied migration.
7. `## Action items` — checkboxes: review the overwritten files (or the whole diff), every note `action` (deduplicated), `pnpm check` when Biome files are involved, `pnpm test` when testing files are involved, verify CI when a workflow changed, and "delete nothing else".
8. `## Not touched` — the static guarantee: application code under `src/`, `README.md`, `CHANGELOG.md`, `LICENSE`.
9. `## Commits` — numbered `report.commits`.
10. Footer: generated-by line (`v<toVersion>`) and the `changelogUrl` link when present.

Helpers:

- `unifiedDiff(previousContent, nextContent)` — pure line-based LCS diff (` ` / `-` / `+` with `@@` hunk headers and 3 lines of context). CRLF is normalised to LF first, inputs are capped at `MAX_DIFF_LINES` (400) and the rendered diff at `MAX_DIFF_CHARS` (8 000) so a huge file cannot flood the body; both caps are marked with a `@@ diff truncated … @@` note. Returns `""` when the contents are equivalent.
- `diffLineCounts(previousContent, nextContent)` → `{added, removed}` and `diffCounts(...)` → `+N −M` (U+2212), used by the `+/− lines` column.
- `truncateForGithub(body)` — GitHub rejects bodies over ~65 000 characters (`GITHUB_PR_BODY_LIMIT`). Bodies under the limit are returned untouched; longer ones get their `<details>` diff blocks collapsed, then dropped if still too long, and a visible note pointing at the **Files changed** tab. The Summary, the ⚠️ section, every table, the action items and the footer are never removed. The function is **idempotent**: running it on its own output returns the same string (the replacements are fixed points and the trim note is inserted at most once).

Table cells are escaped (`|` → `\|`, newlines → `<br>`) and CRLF is normalised before diffing, so generated content can never break the markdown layout.
