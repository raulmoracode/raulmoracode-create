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
  "- `biome.json`",
  "- `components.json`",
  "- `.nvmrc`",
  "- framework-specific configuration files",
  "",
  "`raulmoracode.json` is the CLI manifest (framework, tech selection and managed-file hashes); treat it as the source of truth for upgrades.",
  "",
  "## Project structure",
  "",
  "```text",
  "├── index.html               # HTML entry (head tags injected at build time)",
  "├── .github/workflows/       # GitHub Actions workflows",
  "├── .github/dependabot.yml   # Dependabot (weekly, exact versions, 7-day cooldown)",
  "├── .opencode/opencode.json  # OpenCode skills catalog",
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
  "├── components.json          # shadcn config (includes the @raulmoracode registry)",
  "├── .husky/                  # Git hooks",
  "├── commitlint.config.ts     # commit message validation",
  "├── biome.json               # formatter + linter config",
  "├── vitest.config.ts         # test config",
  "├── playwright.config.ts     # E2E config",
  "├── e2e/                     # Playwright E2E tests",
  "├── .vscode/                 # VS Code settings + extensions",
  "├── vite.config.ts           # Vite configuration",
  "├── tsconfig.json            # TypeScript configuration",
  "├── package.json             # scripts and dependencies (exact versions)",
  "├── pnpm-workspace.yaml      # minimumReleaseAge policy + excludes",
  "├── raulmoracode.json        # CLI manifest (framework, selection, hashes)",
  "├── LICENSE                  # project license",
  "├── CHANGELOG.md             # project changelog",
  "└── AGENTS.md                # guidelines for AI coding agents",
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
  "## Components and UI",
  "",
  "UI components come from shadcn. Add new components with:",
  "",
  "```bash",
  "pnpm dlx shadcn@4.21.0 add @raulmoracode/<component>",
  "```",
  "",
  "Browse the catalogue at https://registry.raulmoracode.com.",
  "",
  "Do not hand-write component files under the shadcn UI directory. Registry items write to `@components/*`, `@lib/*` and `@hooks/*`, declared in `components.json` and in the `tsconfig.json` paths.",
  "",
  "## Validation",
  "",
  "```bash",
  "pnpm check",
  "pnpm typecheck",
  "pnpm test",
  "pnpm e2e",
  "pnpm build",
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

  it("documents the scripts and conventions agents must follow", () => {
    const content = agentsMd();
    expect(content).toContain("# AGENTS.md");
    expect(content).toContain("This project uses pnpm exclusively.");
    expect(content).toContain("single source of truth for the site title");
  });

  it("delegates the behavioural guidance to the skills catalog", () => {
    const content = agentsMd();
    expect(content).toContain("## Skills");
    expect(content).toContain(
      "https://raulmoracode.github.io/raulmoracode-skills/",
    );
    expect(content).toContain("`raulmoracode-mode`");
    for (const heading of [
      "## General principles",
      "## Code style",
      "## Architecture",
      "## Git\n",
      "## Git hooks and commits",
      "## Pull requests",
      "## Changelog",
      "## Security",
      "## Adding dependencies",
      "## Environment variables",
      "## Deployment",
      "## Working with existing code",
      "## Final response",
    ]) {
      expect(content, heading).not.toContain(heading);
    }
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
