# @raulmoracode/create

Professional CLI to scaffold modern React projects. Built with Node.js, TypeScript, [Clack](https://github.com/natemoo-re/clack) and pnpm.

- **Package:** [`@raulmoracode/create`](https://www.npmjs.com/package/@raulmoracode/create) (published to npmjs)
- **Repository:** [`raulmoracode/raulmoracode-create`](https://github.com/raulmoracode/raulmoracode-create)
- **Command:** `raulmoracode-create`

## Requirements

- [Node.js](https://nodejs.org) 24 LTS
- [pnpm](https://pnpm.io/installation) (declared per project via `packageManager`)
- npm
- [Git](https://git-scm.com/downloads) with a configured identity (`user.name` and `user.email`)
- A GitHub account and an existing empty repository for the new project
- [VS Code](https://code.visualstudio.com) (optional, used to open the project at the end)

## Install globally

The package is published to [npmjs](https://www.npmjs.com/package/@raulmoracode/create). No authentication needed.

```bash
npm install -g @raulmoracode/create
```

Verify:

```bash
raulmoracode-create
```

## Usage

```bash
raulmoracode-create
```

The CLI guides you through the whole process with Clack prompts:

1. Select the technology: **React + Vite** or **Next.js**.
2. Select the technologies to include (everything preselected by default).
3. Enter the project name.
4. Enter the GitHub repository URL (the repository must already exist).
5. The project is created with the official generators (`create-vite` / `create-next-app`) and fully configured.
6. Git is initialized, the remote is configured, the initial commit is created and pushed to GitHub.
7. Optionally open the project with VS Code.

Available flags:

```bash
raulmoracode-create --verbose   # print the output of every external command
raulmoracode-create --help      # show help
raulmoracode-create --version   # show the installed version
```

## What the CLI does

- Scaffolds with the **official generators** (never a hand-written template):
  - React + Vite: `pnpm create vite@9.2.1 <name> --template react-ts` (the `create-vite` release line that scaffolds the Vite 8.x line; `create-vite@8.3.1` does not exist), then pins `vite@8.3.1`, `react@19.3.0` and `typescript@7.0.2`.
  - Next.js: `pnpm create next-app@16.3.6 <name> --ts --app --src-dir --import-alias "@/*" --biome --use-pnpm --disable-git --yes`.
- Installs dependencies with **pnpm** and pins exact versions (no `^` or `~`).
- Configures **Tailwind CSS 4.3.3** (CSS-first configuration, `@tailwindcss/vite` for Vite and `@tailwindcss/postcss` for Next.js).
- Prepares **shadcn**: writes a complete `components.json` (including the `@raulmoracode` registry), the `cn()` helper (`src/lib/utils.ts`) and the registry path aliases (`@components/*`, `@lib/*`, `@hooks/*` in the tsconfigs) so `pnpm dlx shadcn@latest add @raulmoracode/<component>` resolves file targets out of the box. No components are preinstalled; add them later with `pnpm dlx shadcn@latest add <component>`.
- Optionally applies the **Raulmoracode nature theme** from the registry (requires shadcn): nature tokens land in the Tailwind entry CSS, `tw-animate-css` is pinned, and the CLI removes the Next-oriented leftovers the shadcn CLI drops into `src/` on Vite projects.
- Installs **Zustand 5.0.15**, **React Hook Form 7.89.0**, **Zod 4.6.5** and **TanStack Query 5.104.0**, and wires the TanStack Query provider.
- Configures **Biome 2.5.14** (formatter, linter and organize imports) and removes the ESLint/Oxlint leftovers from the official templates.
- Configures **Vitest 5.0.2**, **@testing-library/react 16.3.3** and **@testing-library/dom 10.4.2** (plus `jsdom`, required by Testing Library, and `clsx` + `tailwind-merge`, required by the shadcn `cn()` helper).
- Configures **VS Code** (`.vscode/settings.json` and `.vscode/extensions.json`).
- Pins **Node.js 24** via `.nvmrc` and writes `.editorconfig`.
- Applies **branding**: tab title `raulmoracode` and favicon `https://cdn.raulmoracode.com/icons/favicon.ico` (in `index.html` for Vite, in the root layout metadata for Next.js).
- Ships a minimal **starter** for React + Vite: `public/` and `src/assets/` are emptied, `App.tsx` renders a simple hello and `App.css` starts empty.
- Ships a minimal **starter** for Next.js: `public/` is emptied and `page.tsx` renders a simple hello (its orphaned `page.module.css` is removed). `AGENTS.md` is kept and `CLAUDE.md` is removed.
- Fills in **project metadata** in `package.json`: `author` (Raul Mora, https://raulmoracode.com), `homepage` and `repository` with the GitHub URL you enter at the start.
- Writes **`pnpm-workspace.yaml`** with `minimumReleaseAge: 10080` plus `minimumReleaseAgeExclude` entries for every locked package, so installs keep working (pnpm enforces the policy against the whole lockfile, not just direct dependencies). When shadcn is selected, the `@raulmoracode/*` scope is also excluded so `shadcn add @raulmoracode/<component>` can install freshly published packages from your registry.
- Initializes Git on `main`, adds the remote, creates the commit `chore: initial project setup` and pushes with `git push -u origin main` (never `--force`). If the remote already contains commits that do not exist locally, the process stops with a clear message instead of overwriting anything.

## Generated projects

Every generated project includes:

- React + Vite or Next.js (official structure)
- Tailwind CSS 4
- shadcn ready (`components.json` with the `@raulmoracode` registry and the `cn()` helper)
- Raulmoracode nature theme (optional, applied from the registry)
- Zustand
- React Hook Form + Zod
- TanStack Query (provider included)
- Biome (format, lint, organize imports)
- Vitest + Testing Library
- VS Code settings
- Branding (`raulmoracode` tab title and CDN favicon)
- `pnpm-workspace.yaml` with `minimumReleaseAge: 10080`
- Node.js 24 (`.nvmrc`)
- pnpm (`pnpm-lock.yaml`, no `package-lock.json` or `yarn.lock`)
- Git initialized and pushed to GitHub

### Commands in a generated project

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm check
pnpm format
pnpm lint
```

Add shadcn components:

```bash
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add @raulmoracode/<component>
```

After adding components, normalize their style with Biome (the shadcn CLI uses its own formatting):

```bash
pnpm exec biome check --write .
```

Vite projects resolve the `@/*` alias to `src/*` (`tsconfig.app.json`, root `tsconfig.json` and `vite.config.ts`). Both frameworks also map the `@raulmoracode` registry aliases (`@components/*`, `@lib/*`, `@hooks/*` to `src/...`) so registry file targets resolve when running `pnpm dlx shadcn@latest add @raulmoracode/<component>`.

Every generated project ships an `AGENTS.md` file with guidelines for AI coding agents (source of truth, conventions, validation, Git safety and security rules), plus a project tooling section (pnpm exclusively, script map and the shadcn workflow).

## GitHub authentication

The CLI runs `git push -u origin main`, so Git must be authenticated against GitHub. Any of these work:

- [GitHub CLI](https://cli.github.com): `gh auth login`
- A credential manager / SSH key configured for `github.com`

## npm

### Install

```bash
npm install -g @raulmoracode/create
```

### Update the global installation

```bash
npm install -g @raulmoracode/create
```

### Publish (maintainers)

```bash
pnpm install
pnpm build
pnpm test
npm publish --access public
```

Create the `NPM_TOKEN` (granular, read+write on `@raulmoracode/create`) at `npmjs.com > Access Tokens` and save it as `Settings > Secrets > Actions > NPM_TOKEN`.

The repository also ships a GitHub Actions workflow (`.github/workflows/publish.yml`) that builds, tests and publishes the package to npmjs on every `v*` tag using `NPM_TOKEN`.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Other useful scripts:

```bash
pnpm check    # biome check .
pnpm format   # biome format --write .
pnpm lint     # biome lint .
```

### Architecture

```text
src/
├── index.ts               # entry point (shebang)
├── cli/                   # orchestration and Clack output
├── prompts/               # user interaction (Clack)
├── generators/            # project configuration steps
├── frameworks/            # vite / next specific logic
├── git/                   # git command builders and wrappers
├── config/                # configuration file templates
└── utils/                 # exec, filesystem, validation
tests/                     # vitest suite (external commands are mocked)
```

External commands are always executed with argument arrays through `utils/exec.ts` (never string interpolation), and every user input is validated before use.

### Verified adjustments

The following deviations from the naive expected configuration were verified against the real tools and are intentional:

- **`create-vite@9.2.1`** is used for Vite projects because `create-vite@8.3.1` does not exist; the 9.x line is the one that scaffolds the Vite 8.x line. `vite` is then pinned to `8.3.1` exactly.
- **`components.json`** must contain the full shadcn configuration (`$schema`, `style`, `tailwind`, `rsc`, `tsx`, `aliases`) because shadcn 4.x rejects a config with only `registries` — and `pnpm dlx shadcn@latest add card` is a hard requirement. The `@raulmoracode` registry entry is exactly the mandated one.
- **`biome.json`** enables organize imports through `assist.actions.source.organizeImports` because Biome 2.5.14 removed the top-level `organizeImports` key; it ignores `dist`/`.next` build output; and disables `noSvgWithoutTitle`/`noAmbiguousAnchorText`, which fire on the official Vite/Next template demo assets.
- **`jsdom`** (Testing Library DOM environment) and **`clsx` + `tailwind-merge`** (shadcn `cn()` helper) are installed because they are strictly required by the mandated Testing Library and shadcn setups.

## Packaging and local verification

```bash
pnpm build
npm pack
npm install -g ./raulmoracode-create-*.tgz
raulmoracode-create
```

The glob keeps working across versions: `npm pack` names the tarball after the current `package.json` version, so a hardcoded name would go stale on every release.

The packaged tarball contains `dist/` (including the `raulmoracode-create` bin with its shebang), `README.md` and `LICENSE`.

## License

[MIT](LICENSE)
