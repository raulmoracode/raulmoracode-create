import type { Framework } from "../utils/validation.js";
import { RAULMORACODE_REGISTRY_ADD_EXAMPLE } from "./components.js";
import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

interface TreeNode {
  name: string;
  comment?: string;
  children?: TreeNode[];
}

/** Renders siblings with correct ├──/└── connectors and aligned comments. */
function renderTree(nodes: TreeNode[], prefix = ""): string[] {
  const width = Math.max(...nodes.map((node) => node.name.length));
  const lines: string[] = [];
  nodes.forEach((node, i) => {
    const last = i === nodes.length - 1;
    const label = node.comment
      ? `${node.name.padEnd(width)}  # ${node.comment}`
      : node.name;
    lines.push(`${prefix}${last ? "└──" : "├──"} ${label}`);
    if (node.children && node.children.length > 0) {
      lines.push(
        ...renderTree(node.children, `${prefix}${last ? "    " : "│   "}`),
      );
    }
  });
  return lines;
}

function libChildren(selection: TechSelection): TreeNode[] {
  const children: TreeNode[] = [];
  if (selection.shadcn) {
    children.push({ name: "utils.ts", comment: "cn()" });
  }
  if (selection["tanstack-query"]) {
    children.push({ name: "query-client.ts", comment: "QueryClient" });
  }
  return children;
}

function srcChildren(
  frameworkId: Framework,
  selection: TechSelection,
): TreeNode[] {
  const children: TreeNode[] =
    frameworkId === "next"
      ? [
          {
            name: "app/",
            children: [
              {
                name: "layout.tsx",
                comment: "root layout (branding + providers)",
              },
              { name: "page.tsx", comment: "home page" },
              ...(selection["tanstack-query"]
                ? [{ name: "providers.tsx", comment: "QueryClientProvider" }]
                : []),
              { name: "error.tsx", comment: "error page" },
              { name: "not-found.tsx", comment: "404 page" },
              {
                name: "globals.css",
                comment: selection.tailwind
                  ? "Tailwind entry point"
                  : "global styles",
              },
            ],
          },
        ]
      : [
          {
            name: "main.tsx",
            comment: selection["tanstack-query"]
              ? "entry point (QueryClientProvider wired)"
              : "entry point",
          },
          { name: "App.tsx", comment: "root component" },
          {
            name: "index.css",
            comment: selection.tailwind
              ? "Tailwind entry point"
              : "global styles",
          },
          { name: "App.css", comment: "root styles" },
        ];
  if (selection.shadcn) {
    children.push(
      { name: "components/", comment: "shadcn components land here" },
      { name: "hooks/", comment: "registry hooks land here" },
    );
  }
  const lib = libChildren(selection);
  if (lib.length > 0) {
    children.push({ name: "lib/", children: lib });
  }
  children.push({
    name: "config/",
    children: [{ name: "site.ts", comment: "site identity" }],
  });
  if (selection.testing) {
    children.push({ name: "test/", comment: "smoke test" });
  }
  return children;
}

function structure(frameworkId: Framework, selection: TechSelection): string[] {
  const root: TreeNode[] = [];
  if (frameworkId === "vite") {
    root.push({
      name: "index.html",
      comment: "tab title + favicon (raulmoracode branding)",
    });
  }
  root.push({
    name: ".github/workflows/",
    comment: "CI (install, check, test, build)",
  });
  root.push({ name: "src/", children: srcChildren(frameworkId, selection) });
  if (selection.shadcn) {
    root.push({
      name: "components.json",
      comment: "shadcn config (includes the @raulmoracode registry)",
    });
  }
  if (selection.husky) {
    root.push(
      { name: ".husky/", comment: "Git hooks" },
      {
        name: "commitlint.config.ts",
        comment: "commit message validation",
      },
    );
  }
  if (selection.biome) {
    root.push({ name: "biome.json", comment: "formatter + linter config" });
  }
  if (selection.testing) {
    root.push({ name: "vitest.config.ts", comment: "test config" });
  }
  if (selection.vscode) {
    root.push({ name: ".vscode/", comment: "VS Code settings + extensions" });
  }
  if (selection.tailwind && frameworkId === "vite") {
    root.push({ name: "vite.config.ts", comment: "Vite configuration" });
  }
  if (selection.tailwind && frameworkId === "next") {
    root.push({
      name: "postcss.config.mjs",
      comment: "PostCSS with Tailwind",
    });
  }
  root.push(
    { name: "tsconfig.json", comment: "TypeScript configuration" },
    {
      name: "package.json",
      comment: "scripts and dependencies (exact versions)",
    },
    {
      name: "pnpm-workspace.yaml",
      comment: "minimumReleaseAge policy + excludes",
    },
    {
      name: "raulmoracode.json",
      comment: "CLI manifest (framework, selection, hashes)",
    },
    { name: "LICENSE", comment: "MIT license" },
    { name: "CHANGELOG.md", comment: "project changelog" },
    { name: "AGENTS.md", comment: "guidelines for AI coding agents" },
  );
  return ["```text", ...renderTree(root), "```"];
}

function toolingScriptLines(
  frameworkId: Framework,
  selection: TechSelection,
): string[] {
  const lines = [
    "- `pnpm dev` — start the development server.",
    "- `pnpm build` — create a production build.",
  ];
  if (frameworkId === "next") {
    lines.push("- `pnpm start` — start the production server.");
  }
  if (selection.biome) {
    lines.push(
      "- `pnpm check` — run the formatter and linter check.",
      "- `pnpm format` — apply formatting.",
      "- `pnpm lint` — run the linter.",
    );
  }
  if (selection.testing) {
    lines.push(
      "- `pnpm test` — run the test suite in watch mode (use `CI=true pnpm test` for single run).",
    );
  }
  return lines;
}

function validationCommands(selection: TechSelection): string[] {
  const commands: string[] = [];
  if (selection.biome) {
    commands.push("pnpm check");
  }
  if (selection.testing) {
    commands.push("pnpm test");
  }
  commands.push("pnpm build");
  return commands;
}

function preCommitLines(selection: TechSelection): string[] {
  const lines: string[] = [];
  if (selection.biome) {
    lines.push("pnpm check");
  }
  if (selection.testing) {
    lines.push("pnpm test");
  }
  return lines;
}

function prValidationChecklist(selection: TechSelection): string[] {
  const items: string[] = [];
  if (selection.biome) {
    items.push("- [ ] `pnpm check`");
  }
  if (selection.testing) {
    items.push("- [ ] `pnpm test`");
  }
  items.push("- [ ] `pnpm build`");
  return items;
}

export function agentsMd(
  frameworkId: Framework = "vite",
  selection: TechSelection = FULL_TECH_SELECTION,
): string {
  const lines: string[] = [
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
  ];
  if (selection.biome) {
    lines.push("- `biome.json`");
  }
  if (selection.shadcn) {
    lines.push("- `components.json`");
  }
  lines.push(
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
    ...structure(frameworkId, selection),
    "",
    "## Project tooling",
    "",
    "This project uses pnpm exclusively. Never use npm or yarn.",
    "",
    "`raulmoracode.json` records the CLI version, framework, tech selection and managed-file hashes.",
    "",
    "Available scripts (see `package.json` for the full list):",
    "",
    ...toolingScriptLines(frameworkId, selection),
    "",
  );
  if (selection.shadcn) {
    lines.push(
      "UI components come from shadcn. Add new components with:",
      "",
      "```bash",
      RAULMORACODE_REGISTRY_ADD_EXAMPLE,
      "```",
      "",
      "Browse the catalogue at https://registry.raulmoracode.com.",
      "",
      "Do not hand-write component files under the shadcn UI directory. Follow `components.json`, including the `@raulmoracode` registry.",
      "",
    );
  }
  lines.push(
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
  );
  if (selection.shadcn) {
    lines.push(
      "If the project uses shadcn, follow the existing shadcn configuration and component conventions.",
      "",
      "Do not manually recreate a component when an appropriate existing project component can be reused.",
      "",
    );
  } else {
    lines.push(
      "Do not manually recreate a component when an appropriate existing project component can be reused.",
      "",
    );
  }
  lines.push(
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
    ...validationCommands(selection),
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
  );
  if (selection.husky) {
    const preCommit = preCommitLines(selection);
    lines.push(
      "Husky manages the Git hooks.",
      "",
      "`pre-commit` runs:",
      "",
      "```bash",
      ...preCommit,
      "```",
      "",
      "`commit-msg` runs Commitlint.",
      "",
    );
  } else {
    lines.push("This project does not configure Husky Git hooks.", "");
  }
  lines.push(
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
  );
  if (selection.husky) {
    lines.push(
      "Do not bypass hooks with `--no-verify` unless explicitly requested.",
      "",
      "Keep the project passing:",
      "",
      "```bash",
      ...validationCommands(selection),
      "```",
      "",
    );
  }
  lines.push(
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
    "Use this body template:",
    "",
    "```markdown",
    "## Summary",
    "",
    "<1-2 sentences>",
    "",
    "## Changes",
    "",
    "- ...",
    "",
    "## How to test",
    "",
    "1. ...",
    "2. ...",
    "",
    "## Validation",
    "",
    ...prValidationChecklist(selection),
    "",
    "## Breaking changes",
    "",
    "None (or describe the migration).",
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
    "- `pnpm test` — tests pass",
    "- `pnpm build` — production build succeeds",
    "",
    "Deployment is manual. Once CI passes, deploy to your preferred hosting provider.",
    "",
  );
  if (frameworkId === "next") {
    lines.push(
      "For Next.js projects: deploy to a Node.js-capable platform or use `next start`.",
      "",
    );
  } else {
    lines.push(
      "For Vite projects: deploy the `dist/` folder to any static hosting.",
      "",
    );
  }
  lines.push(
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
  );
  return lines.join("\n");
}
