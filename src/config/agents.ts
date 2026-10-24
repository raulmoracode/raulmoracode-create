import type { Framework } from "../utils/validation.js";
import { RAULMORACODE_REGISTRY_ADD_EXAMPLE } from "./components.js";
import { structureBlock, type TreeNode } from "./project-structure.js";
import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

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

/**
 * The AGENTS.md project tree as nodes. Exported so `upgrade` can collect the
 * candidate paths (`structurePaths()`) and detect which ones exist on disk.
 */
export function agentsStructure(
  frameworkId: Framework,
  selection: TechSelection,
): TreeNode[] {
  const root: TreeNode[] = [];
  if (frameworkId === "vite") {
    root.push({
      name: "index.html",
      comment: "HTML entry (head tags injected at build time)",
    });
  }
  root.push({
    name: ".github/workflows/",
    comment: "GitHub Actions workflows",
  });
  root.push({
    name: ".github/dependabot.yml",
    comment: "Dependabot (weekly, exact versions, 7-day cooldown)",
  });
  root.push({
    name: ".opencode/opencode.json",
    comment: "OpenCode skills catalog",
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
  if (selection.playwright) {
    root.push(
      { name: "playwright.config.ts", comment: "E2E config" },
      { name: "e2e/", comment: "Playwright E2E tests" },
    );
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
    { name: "LICENSE", comment: "project license" },
    { name: "CHANGELOG.md", comment: "project changelog" },
    { name: "AGENTS.md", comment: "guidelines for AI coding agents" },
  );
  return root;
}

function structure(
  frameworkId: Framework,
  selection: TechSelection,
  existingPaths?: string[],
): string[] {
  return structureBlock(agentsStructure(frameworkId, selection), existingPaths);
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
  lines.push("- `pnpm typecheck` — run the TypeScript type checker.");
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
  if (selection.playwright) {
    lines.push(
      "- `pnpm e2e` — run browser E2E tests with Playwright (install browsers first with `pnpm exec playwright install chromium`).",
    );
  }
  return lines;
}

function validationCommands(selection: TechSelection): string[] {
  const commands: string[] = [];
  if (selection.biome) {
    commands.push("pnpm check");
  }
  commands.push("pnpm typecheck");
  if (selection.testing) {
    commands.push("pnpm test");
  }
  if (selection.playwright) {
    commands.push("pnpm e2e");
  }
  commands.push("pnpm build");
  return commands;
}

export function agentsMd(
  frameworkId: Framework = "vite",
  selection: TechSelection = FULL_TECH_SELECTION,
  existingPaths?: string[],
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
    "## Skills",
    "",
    "How to work on this repository — inspect the codebase, choose the smallest change, validate it and report the result — lives in the shared @raulmoracode skills catalog:",
    "",
    "https://raulmoracode.github.io/raulmoracode-skills/",
    "",
    "`.opencode/opencode.json` loads that catalog for this project.",
    "",
    "Start non-trivial work with the `raulmoracode-mode` skill and follow the specialists it points to:",
    "",
    "- `test-before-finishing` / `verify-before-claiming` / `no-made-up-results` — validate with real commands before claiming anything.",
    "- `security-first` — secrets, credentials and dependency safety.",
    "- `clear-final-report` — what changed, which files, which validation ran, what is still open.",
    "",
    "If the catalog is unavailable, these rules still hold:",
    "",
    "- Use pnpm only, never npm or yarn.",
    "- Pin exact dependency versions: no `^`, no `~`, no `latest`.",
    "- Never claim a command was run, or that something works, when it was not verified.",
    "- Never delete or overwrite the user's content.",
    "",
    "## Dependencies and configuration",
    "",
    "Always inspect the current `package.json` before using or adding a dependency.",
    "",
    "Do not assume that a dependency is installed because it may have been included in the original scaffold.",
    "",
    "Use pnpm exclusively and pin exact versions: no `^`, no `~`, no `latest`.",
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
    "## Project structure",
    "",
    ...structure(frameworkId, selection, existingPaths),
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
      "## Components and UI",
      "",
      "UI components come from shadcn. Add new components with:",
      "",
      "```bash",
      RAULMORACODE_REGISTRY_ADD_EXAMPLE,
      "```",
      "",
      "Browse the catalogue at https://registry.raulmoracode.com.",
      "",
      "Do not hand-write component files under the shadcn UI directory. Registry items write to `@components/*`, `@lib/*` and `@hooks/*`, declared in `components.json` and in the `tsconfig.json` paths.",
      "",
    );
  }
  lines.push(
    "## Validation",
    "",
    "```bash",
    ...validationCommands(selection),
    "```",
    "",
    "## Site identity",
    "",
    "`src/config/site.ts` is the single source of truth for the site title, description, favicon and social preview.",
    "",
    "Edit that file instead of `index.html` or `src/app/layout.tsx` when changing them.",
    "",
    "On Vite the `siteHead()` plugin in `vite.config.ts` injects those values into `index.html`; on Next.js the `metadata` export in `src/app/layout.tsx` does. Both are always wired, whichever techs were selected.",
    "",
  );
  return lines.join("\n");
}
