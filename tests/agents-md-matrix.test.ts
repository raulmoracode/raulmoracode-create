import { describe, expect, it } from "vitest";
import { agentsMd, agentsStructure } from "../src/config/agents.js";
import { structurePaths } from "../src/config/project-structure.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../src/config/tech.js";
import { managedFiles } from "../src/upgrade/managed-files.js";
import { SNAPSHOT_SELECTIONS } from "../src/upgrade/template-snapshot.js";
import type { Framework } from "../src/utils/validation.js";

/**
 * The exact AGENTS.md the CLI must ship to generated projects. Without
 * `existingPaths` it renders the full selection tree, so every snapshot
 * selection and both frameworks must produce this very content: any drift
 * fails here instead of silently reaching generated (and generated) projects.
 * The optional `existingPaths` (used by `upgrade` to reflect the disk) is
 * covered by the pruning tests below.
 */
const EXPECTED_AGENTS_MD = [
  "# AGENTS.md",
  "",
  "## Project guidelines",
  "",
  "This project was initially generated with `@raulmoracode/create`.",
  "",
  "Treat the current repository state as the source of truth. Do not assume that the original scaffold configuration, dependencies, scripts, or architecture are still unchanged.",
  "",
  "Before making changes, inspect the existing codebase and its configuration.",
  "",
  "## General principles",
  "",
  "- Follow existing project conventions and patterns.",
  "- Prefer simple, focused solutions over unnecessary abstractions.",
  "- Reuse existing components, utilities, hooks, and patterns when appropriate.",
  "- Avoid duplicating functionality that already exists.",
  "- Keep changes scoped to the requested task.",
  "- Do not modify unrelated files.",
  "- Preserve existing user changes.",
  "- Do not introduce a new library when the existing project can reasonably solve the problem.",
  "- Do not remove or replace existing dependencies without a clear reason.",
  "- Do not reintroduce dependencies that have been intentionally removed.",
  "",
  "## Dependencies and configuration",
  "",
  "Always inspect the current `package.json` before using or adding a dependency.",
  "",
  "Do not assume that a dependency is installed because it may have been included in the original scaffold.",
  "",
  "Treat the following files as sources of truth for the current project configuration:",
  "",
  "- `package.json`",
  "- `pnpm-lock.yaml`",
  "- `tsconfig.json`",
  "- `raulmoracode.json`",
  "- `biome.json`",
  "- `components.json`",
  "- `.nvmrc`",
  "- framework-specific configuration files",
  "",
  "`raulmoracode.json` is the CLI manifest (framework, tech selection and managed-file hashes); treat it as the source of truth for upgrades.",
  "",
  "Use the package manager already configured by the project.",
  "",
  "Do not change package managers unless explicitly requested.",
  "",
  "## Project structure",
  "",
  "```text",
  "├── index.html              # tab title + favicon (raulmoracode branding)",
  "├── .github/workflows/      # CI (install, check, typecheck, test, build)",
  "├── .github/dependabot.yml  # Dependabot (weekly, exact versions, 7-day cooldown)",
  "├── src/",
  "│   ├── main.tsx     # entry point (QueryClientProvider wired)",
  "│   ├── App.tsx      # root component",
  "│   ├── index.css    # Tailwind entry point",
  "│   ├── App.css      # root styles",
  "│   ├── components/  # shadcn components land here",
  "│   ├── hooks/       # registry hooks land here",
  "│   ├── lib/",
  "│   │   ├── utils.ts         # cn()",
  "│   │   └── query-client.ts  # QueryClient",
  "│   ├── config/",
  "│   │   └── site.ts  # site identity",
  "│   └── test/        # smoke test",
  "├── components.json         # shadcn config (includes the @raulmoracode registry)",
  "├── .husky/                 # Git hooks",
  "├── commitlint.config.ts    # commit message validation",
  "├── biome.json              # formatter + linter config",
  "├── vitest.config.ts        # test config",
  "├── playwright.config.ts    # E2E config",
  "├── e2e/                    # Playwright E2E tests",
  "├── .vscode/                # VS Code settings + extensions",
  "├── vite.config.ts          # Vite configuration",
  "├── tsconfig.json           # TypeScript configuration",
  "├── package.json            # scripts and dependencies (exact versions)",
  "├── pnpm-workspace.yaml     # minimumReleaseAge policy + excludes",
  "├── raulmoracode.json       # CLI manifest (framework, selection, hashes)",
  "├── LICENSE                 # project license",
  "├── CHANGELOG.md            # project changelog",
  "└── AGENTS.md               # guidelines for AI coding agents",
  "```",
  "",
  "## Project tooling",
  "",
  "This project uses pnpm exclusively. Never use npm or yarn.",
  "",
  "`raulmoracode.json` records the CLI version, framework, tech selection and managed-file hashes.",
  "",
  "Available scripts (see `package.json` for the full list):",
  "",
  "- `pnpm dev` — start the development server.",
  "- `pnpm build` — create a production build.",
  "- `pnpm typecheck` — run the TypeScript type checker.",
  "- `pnpm check` — run the formatter and linter check.",
  "- `pnpm format` — apply formatting.",
  "- `pnpm lint` — run the linter.",
  "- `pnpm test` — run the test suite in watch mode (use `CI=true pnpm test` for single run).",
  "- `pnpm e2e` — run browser E2E tests with Playwright (install browsers first with `pnpm exec playwright install chromium`).",
  "",
  "UI components come from shadcn. Add new components with:",
  "",
  "```bash",
  "pnpm dlx shadcn@4.21.0 add @raulmoracode/<component>",
  "```",
  "",
  "Browse the catalogue at https://registry.raulmoracode.com.",
  "",
  "Do not hand-write component files under the shadcn UI directory. Follow `components.json`, including the `@raulmoracode` registry.",
  "",
  "## Code style",
  "",
  "Follow the existing code style and project structure.",
  "",
  "Use the project's configured formatter and linter.",
  "",
  "Do not introduce ESLint, Prettier, or another formatting/linting system when an existing project tool already provides that functionality, unless explicitly requested.",
  "",
  "Prefer readable and maintainable code over clever implementations.",
  "",
  "Avoid unnecessary comments. Add comments when they explain a non-obvious decision or constraint.",
  "",
  "## Components and UI",
  "",
  "Before creating a new component, check whether an existing component already provides the required functionality.",
  "",
  "Prefer composition and reuse over duplicated UI implementations.",
  "",
  "If the project uses shadcn, follow the existing shadcn configuration and component conventions.",
  "",
  "Do not manually recreate a component when an appropriate existing project component can be reused.",
  "",
  "## Architecture",
  "",
  "Follow the architecture already present in the repository.",
  "",
  "Do not introduce a new architectural pattern solely because it is personally preferred.",
  "",
  "When adding functionality:",
  "",
  "1. Identify the existing pattern used for similar functionality.",
  "2. Follow that pattern when appropriate.",
  "3. Keep the implementation close to the relevant feature.",
  "4. Avoid creating generic abstractions before they are actually needed.",
  "",
  "For framework-specific behavior, follow the conventions of the framework version currently installed in the project.",
  "",
  "## Validation",
  "",
  "Inspect `package.json` to determine the available scripts before running commands.",
  "",
  "After making changes, run the most relevant validation commands for the affected code.",
  "",
  "For substantial changes, prefer running:",
  "",
  "```bash",
  "pnpm check",
  "pnpm test",
  "pnpm e2e",
  "pnpm build",
  "```",
  "",
  "Do not claim that a change is complete if the relevant validation has not been performed.",
  "",
  "If a validation command fails because of an unrelated pre-existing problem, distinguish that from problems introduced by the current change.",
  "",
  "## Git",
  "",
  "Never use destructive Git commands unless explicitly requested.",
  "",
  "Do not use:",
  "",
  "```bash",
  "git push --force",
  "git push -f",
  "git reset --hard",
  "git clean -fd",
  "```",
  "",
  "Do not rewrite existing history unnecessarily.",
  "",
  "Do not discard or overwrite uncommitted user changes.",
  "",
  "Before modifying files, be aware of the current Git state when relevant.",
  "",
  "Do not commit changes unless explicitly requested.",
  "",
  "## Git hooks and commits",
  "",
  "Husky manages the Git hooks.",
  "",
  "`pre-commit` runs:",
  "",
  "```bash",
  "pnpm check",
  "pnpm test",
  "```",
  "",
  "`commit-msg` runs Commitlint.",
  "",
  "Commits must follow Conventional Commits.",
  "",
  "Format: `<type>: <description>`",
  "",
  "Valid types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `ci`.",
  "",
  "Valid commit examples:",
  "",
  "```text",
  "feat: add user profile",
  "fix: handle invalid input",
  "refactor: extract API client",
  "test: add query client tests",
  "docs: update project guide",
  "chore: update dependencies",
  "style: fix indentation in layout component",
  "perf: optimize image loading in gallery",
  "ci: add GitHub Actions workflow",
  "```",
  "",
  "Rules:",
  "",
  '- Use the imperative mood ("add" not "added").',
  "- Do not capitalize the first letter.",
  "- Do not end with a period.",
  "- Keep the subject line under 72 characters.",
  "- Use a body (separated by a blank line) for longer explanations.",
  "",
  "Do not bypass hooks with `--no-verify` unless explicitly requested.",
  "",
  "Keep the project passing:",
  "",
  "```bash",
  "pnpm check",
  "pnpm test",
  "pnpm e2e",
  "pnpm build",
  "```",
  "",
  "## Pull requests",
  "",
  "Create branches from an up-to-date `main`:",
  "",
  "```bash",
  "git fetch origin",
  "git switch -c <type>/<short-name> origin/main",
  "```",
  "",
  "Use `<type>/<short-name>` branch names (for example `feat/user-profile`, `fix/invalid-input`).",
  "",
  "Titles follow Conventional Commits: `<type>: <description>` (same types as commits).",
  "",
  "Keep the branch focused and open the pull request against `main`.",
  "",
  "Write the pull request title and body in English.",
  "",
  "Use this body template:",
  "",
  "```markdown",
  "<!-- Write the PR body in English -->",
  "",
  "## Summary",
  "",
  "<!-- Briefly describe what this PR does and why. -->",
  "",
  "## Changes",
  "",
  "- ",
  "",
  "## How to test",
  "",
  "1. ",
  "2. ",
  "",
  "## Validation",
  "",
  "- [ ] `pnpm check`",
  "- [ ] `pnpm test`",
  "- [ ] `pnpm e2e`",
  "- [ ] `pnpm typecheck`",
  "- [ ] `pnpm build`",
  "",
  "## Breaking changes",
  "",
  '<!-- List any breaking changes, or write "None". -->',
  "",
  "None",
  "```",
  "",
  "## Changelog",
  "",
  "Keep `CHANGELOG.md` updated with every notable change to the project.",
  "",
  "When completing a task that adds, changes, or fixes functionality, update the",
  "`[Unreleased]` section of `CHANGELOG.md` under the appropriate heading",
  "(`Added`, `Changed`, or `Fixed`).",
  "",
  "Use clear, concise descriptions that explain what changed and why.",
  "",
  "Do not remove or rewrite existing entries unless they are factually incorrect.",
  "",
  "## Site identity",
  "",
  "`src/config/site.ts` is the single source of truth for the site title, description, favicon and social preview.",
  "",
  "Edit that file instead of `index.html` or `src/app/layout.tsx` when changing them.",
  "",
  "On Vite the `siteHead()` plugin in `vite.config.ts` injects those values into `index.html`; on Next.js the `metadata` export in `src/app/layout.tsx` does. Both are always wired, whichever techs were selected.",
  "",
  "## Security",
  "",
  "Do not expose, commit, or hard-code secrets, API keys, access tokens, passwords, or credentials.",
  "",
  "Never replace environment variables with hard-coded credentials.",
  "",
  "Treat `.env` and other environment-specific files as sensitive.",
  "",
  "Do not weaken existing security mechanisms merely to make a task easier.",
  "",
  "## Adding dependencies",
  "",
  "Always use exact versions (no `^` or `~`):",
  "",
  "```bash",
  "pnpm add package-name@1.2.3",
  "pnpm add -D dev-package@4.5.6",
  "```",
  "",
  "Before adding a dependency:",
  "",
  "1. Check whether the functionality already exists in the project.",
  "2. Check whether an existing dependency can provide it.",
  "3. Consider whether the dependency is actually necessary.",
  "4. Use the package manager configured by the project.",
  "5. Keep dependency versions consistent with the project's existing conventions.",
  "",
  "Avoid adding dependencies for trivial functionality that can be implemented safely with the existing stack.",
  "",
  "## Environment variables",
  "",
  "If the project uses environment variables:",
  "",
  "1. Copy `.env.example` to `.env` and fill in the values.",
  "2. Never commit `.env` files — they are in `.gitignore`.",
  "3. Use `import.meta.env.VITE_*` (Vite) or `process.env.*` (Next.js) to access them.",
  "4. For client-side variables in Vite, prefix with `VITE_`.",
  "5. For Next.js, use `NEXT_PUBLIC_` for client-side variables.",
  "",
  "Do not hard-code secrets or credentials in source files.",
  "",
  "## Deployment",
  "",
  "The CI workflow (`.github/workflows/ci.yml`) validates the project on every push and PR:",
  "",
  "- `pnpm install` — dependencies resolve correctly",
  "- `pnpm check` — code is formatted and linted",
  "- `pnpm typecheck` — the TypeScript checker passes",
  "- `pnpm test` — tests pass",
  "- `pnpm build` — production build succeeds",
  "- `pnpm e2e` — browser E2E tests pass",
  "",
  "Deployment is manual. Once CI passes, deploy to your preferred hosting provider.",
  "",
  "For Vite projects: deploy the `dist/` folder to any static hosting.",
  "",
  "## Working with existing code",
  "",
  "Do not rewrite working code unnecessarily.",
  "",
  "Prefer the smallest change that correctly solves the requested problem.",
  "",
  "When modifying existing functionality, preserve its current behavior unless the task explicitly requires changing it.",
  "",
  "If the requested change conflicts with an existing architectural decision, inspect the relevant code and configuration before deciding how to proceed.",
  "",
  "## Final response",
  "",
  "When completing a task, briefly report:",
  "",
  "- What was changed.",
  "- Which files were modified.",
  "- What validation was performed.",
  "- Any relevant issues or limitations that remain.",
  "",
  "Do not claim tests, builds, or other commands were executed if they were not actually run.",
  "",
].join("\n");

const FRAMEWORKS: Framework[] = ["vite", "next"];

const MACHINE_PATH_PATTERNS = [
  /\/Users\//,
  /\/home\//,
  /\/private\/var/,
  /\/var\/folders/,
  /[A-Za-z]:\\Users/,
  /[A-Za-z]:\\\\/,
];

describe("AGENTS.md template", () => {
  it("renders the exact pinned content", () => {
    expect(agentsMd()).toBe(EXPECTED_AGENTS_MD);
  });

  it("ends with a single trailing newline and uses LF only", () => {
    const content = agentsMd();
    expect(content.endsWith("\n")).toBe(true);
    expect(content.endsWith("\n\n")).toBe(false);
    expect(content).not.toContain("\r");
  });

  it("carries no unresolved tokens, credentials or machine paths", () => {
    const content = agentsMd();
    expect(content).not.toContain("{{");
    expect(content).not.toContain("${");
    expect(content).not.toContain("undefined");
    expect(content).not.toMatch(/ghp_|github_pat_|_authToken|Bearer /);
    for (const pattern of MACHINE_PATH_PATTERNS) {
      expect(content, pattern.source).not.toMatch(pattern);
    }
  });

  it("documents the scripts, hooks and conventions agents must follow", () => {
    const content = agentsMd();
    expect(content).toContain("# AGENTS.md");
    expect(content).toContain("This project uses pnpm exclusively.");
    expect(content).toContain("Commitlint");
    expect(content).toContain("Conventional Commits");
    expect(content).toContain("single source of truth for the site title");
  });
});

describe("AGENTS.md in the managed tree", () => {
  for (const { id, selection } of SNAPSHOT_SELECTIONS) {
    for (const framework of FRAMEWORKS) {
      it(`is byte-identical to the template for ${id}/${framework}`, () => {
        const files = managedFiles(framework, selection);
        expect(files["AGENTS.md"]).toBe(agentsMd(framework, selection));
        expect(files["AGENTS.md"]?.endsWith("\n")).toBe(true);
      });
    }
  }

  it("renders framework-specific guides", () => {
    const viteFull = agentsMd("vite", FULL_TECH_SELECTION);
    const nextFull = agentsMd("next", FULL_TECH_SELECTION);
    expect(viteFull).not.toBe(nextFull);
    expect(viteFull).toContain("vite.config.ts");
    expect(nextFull).toContain("postcss.config.mjs");
  });
});

describe("AGENTS.md tree pruning by existing paths", () => {
  /** The ```text block under "## Project structure". */
  function treeBlock(content: string): string[] {
    const anchor = "## Project structure\n\n```text\n";
    const start = content.indexOf(anchor);
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = content.slice(start + anchor.length);
    const end = rest.indexOf("\n```");
    expect(end).toBeGreaterThanOrEqual(0);
    return rest.slice(0, end).split("\n");
  }

  function existingWithout(
    frameworkId: Framework,
    selection: TechSelection,
    removed: string[],
  ): string[] {
    const removedSet = new Set(removed);
    return structurePaths(agentsStructure(frameworkId, selection))
      .map((path) => (path.endsWith("/") ? path.slice(0, -1) : path))
      .filter((path) => !removedSet.has(path));
  }

  it("leaves the full tree when no existing paths are passed", () => {
    const tree = treeBlock(agentsMd("vite", FULL_TECH_SELECTION));
    expect(tree.some((line) => line.includes("App.css"))).toBe(true);
    expect(tree.some((line) => line.includes("components/"))).toBe(true);
    expect(tree.some((line) => line.includes("index.html"))).toBe(true);
  });

  it("drops a deleted file but keeps the directories around it", () => {
    const tree = treeBlock(
      agentsMd(
        "vite",
        FULL_TECH_SELECTION,
        existingWithout("vite", FULL_TECH_SELECTION, [
          "src/App.css",
          "index.html",
        ]),
      ),
    );
    expect(tree.some((line) => line.includes("App.css"))).toBe(false);
    expect(tree.some((line) => line.includes("index.html"))).toBe(false);
    expect(tree.some((line) => line.includes("main.tsx"))).toBe(true);
    expect(tree.some((line) => line.trim() === "├── src/")).toBe(true);
  });

  it("drops a directory the CLI never wrote and keeps one with children", () => {
    // `src/components/` and `src/hooks/` are only aliased, never created; a
    // user deletion of `src/config/site.ts` must not take `src/` down with it.
    const tree = treeBlock(
      agentsMd(
        "vite",
        FULL_TECH_SELECTION,
        existingWithout("vite", FULL_TECH_SELECTION, [
          "src/components",
          "src/hooks",
          "src/config/site.ts",
        ]),
      ),
    );
    expect(tree.some((line) => line.includes("components/"))).toBe(false);
    expect(tree.some((line) => line.includes("hooks/"))).toBe(false);
    expect(tree.some((line) => line.includes("site.ts"))).toBe(false);
    expect(tree.some((line) => line.includes("main.tsx"))).toBe(true);
    expect(tree.some((line) => line.trim() === "├── src/")).toBe(true);
  });

  it("applies the same pruning to the Next.js tree", () => {
    const tree = treeBlock(
      agentsMd(
        "next",
        FULL_TECH_SELECTION,
        existingWithout("next", FULL_TECH_SELECTION, [
          "src/app/not-found.tsx",
          "src/components",
        ]),
      ),
    );
    expect(tree.some((line) => line.includes("not-found.tsx"))).toBe(false);
    expect(tree.some((line) => line.includes("components/"))).toBe(false);
    expect(tree.some((line) => line.includes("layout.tsx"))).toBe(true);
    expect(tree.some((line) => line.includes("page.tsx"))).toBe(true);
  });
});
