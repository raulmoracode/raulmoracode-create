import { describe, expect, it } from "vitest";
import {
  RAULMORACODE_REGISTRY_ADD_EXAMPLE,
  RAULMORACODE_REGISTRY_CATALOG_URL,
} from "../src/config/components.js";
import { NODE_VERSION, nvmrcContent } from "../src/config/nvmrc.js";
import {
  CREATE_REPO_URL,
  type ReadmeOptions,
  readmeMd,
  SITE_URL,
} from "../src/config/readme.js";
import type { TechSelection } from "../src/config/tech.js";
import { frameworks } from "../src/frameworks/index.js";
import type { ProjectFramework } from "../src/frameworks/types.js";
import {
  devDependencies,
  PNPM_VERSION,
  projectScripts,
  runtimeDependencies,
} from "../src/generators/configure-project.js";
import { SNAPSHOT_SELECTIONS } from "../src/upgrade/template-snapshot.js";

const FRAMEWORKS: ProjectFramework[] = [frameworks.vite, frameworks.next];

const SCRIPT_ORDER = [
  "dev",
  "build",
  "start",
  "check",
  "format",
  "lint",
  "test",
] as const;

const SCRIPT_DESCRIPTIONS: Record<string, string> = {
  dev: "Start the development server",
  check: "Run the formatter and linter check",
  format: "Apply formatting",
  lint: "Run the linter",
  test: "Run the test suite (watch mode)",
};

/**
 * Builds the README options exactly like `configureReadme` does in the real
 * pipeline (after `patchPackageJson`), so the matrix pins what a generated
 * project really gets for each selection and framework.
 */
function readmeOptions(
  framework: ProjectFramework,
  selection: TechSelection,
): ReadmeOptions {
  return {
    projectName: "my-project",
    githubUrl: "https://github.com/raulmoracode/my-project",
    frameworkId: framework.id,
    frameworkLabel: framework.label,
    scripts: projectScripts(framework, selection),
    versions: {
      ...framework.pinnedDependencies(),
      ...framework.pinnedDevDependencies(),
      ...runtimeDependencies(selection),
      ...devDependencies(framework, selection),
    },
    pnpmVersion: PNPM_VERSION,
    selection,
  };
}

function versioned(versions: Record<string, string>, name: string): string {
  const version = versions[name];
  return version ? ` ${version}` : "";
}

function expectedScriptsTable(
  framework: ProjectFramework,
  selection: TechSelection,
): string[] {
  const scripts = projectScripts(framework, selection);
  const rows = ["| Command | Description |", "| --- | --- |"];
  for (const name of SCRIPT_ORDER) {
    if (!(name in scripts)) {
      continue;
    }
    const description =
      name === "build"
        ? framework.id === "next"
          ? "Create a production build (`.next/`)"
          : "Create a production build (`dist/`)"
        : name === "start"
          ? "Start the production server"
          : (SCRIPT_DESCRIPTIONS[name] ?? "Run the script");
    rows.push(`| \`pnpm ${name}\` | ${description} |`);
  }
  return rows;
}

function expectedTechStack(
  framework: ProjectFramework,
  selection: TechSelection,
  versions: Record<string, string>,
): string[] {
  const rows: string[] = [];
  if (framework.id === "vite") {
    rows.push(
      `- **React${versioned(versions, "react")} + Vite${versioned(versions, "vite")} + TypeScript${versioned(versions, "typescript")}** — exact versions, no \`^\` or \`~\``,
    );
  } else {
    rows.push(
      `- **Next.js${versioned(versions, "next")} + React${versioned(versions, "react")} + TypeScript${versioned(versions, "typescript")}** — exact versions, no \`^\` or \`~\``,
    );
  }
  if (selection.tailwind) {
    const cssPath =
      framework.id === "next" ? "src/app/globals.css" : "src/index.css";
    rows.push(
      `- **Tailwind CSS${versioned(versions, "tailwindcss")}** — CSS-first configuration (\`@import "tailwindcss"\` in \`${cssPath}\`)`,
    );
  }
  if (selection.shadcn) {
    rows.push(
      "- **shadcn** — `components.json` + `cn()` helper (`src/lib/utils.ts`)",
    );
  }
  if (selection["tanstack-query"]) {
    const providerPath =
      framework.id === "next" ? "the root layout" : "`src/main.tsx`";
    rows.push(
      `- **TanStack Query${versioned(versions, "@tanstack/react-query")}** — \`QueryClient\` wired with provider in ${providerPath}`,
    );
  }
  if (selection.zustand) {
    rows.push(`- **Zustand${versioned(versions, "zustand")}** — global state`);
  }
  if (selection.forms) {
    rows.push(
      `- **React Hook Form${versioned(versions, "react-hook-form")} + Zod${versioned(versions, "zod")}** — forms with validation`,
    );
  }
  if (selection.biome) {
    rows.push(
      `- **Biome${versioned(versions, "@biomejs/biome")}** — formatter, linter and organize imports`,
    );
  }
  if (selection.testing) {
    rows.push(
      `- **Vitest${versioned(versions, "vitest")} + Testing Library** — tests run in \`jsdom\``,
    );
  }
  if (selection.husky) {
    rows.push(
      `- **Husky${versioned(versions, "husky")} + Commitlint** — Git hooks and Conventional Commits`,
    );
  }
  if (selection.vscode) {
    rows.push("- **VS Code** — Biome set as default formatter, format on save");
  }
  return rows;
}

function section(content: string, heading: string): string[] {
  const start = content.indexOf(`## ${heading}\n`);
  expect(start, `missing section ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = content.slice(start + `## ${heading}\n`.length);
  const end = rest.indexOf("\n## ");
  return (end === -1 ? rest : rest.slice(0, end)).split("\n");
}

/** Lines of the ```text tree block under "## Project structure". */
function treeLines(content: string): string[] {
  const anchor = "## Project structure\n\n```text\n";
  const start = content.indexOf(anchor);
  expect(start, "missing project structure tree").toBeGreaterThanOrEqual(0);
  const rest = content.slice(start + anchor.length);
  const end = rest.indexOf("\n```");
  expect(end).toBeGreaterThanOrEqual(0);
  return rest.slice(0, end).split("\n");
}

function treeHas(tree: string[], fragment: string): boolean {
  return tree.some((line) => line.includes(fragment));
}

const MACHINE_PATH_PATTERNS = [
  /\/Users\//,
  /\/home\//,
  /\/private\/var/,
  /\/var\/folders/,
  /[A-Za-z]:\\Users/,
  /[A-Za-z]:\\/,
];

describe("README matrix (every snapshot selection x framework)", () => {
  for (const { id, selection } of SNAPSHOT_SELECTIONS) {
    for (const framework of FRAMEWORKS) {
      describe(`${id}/${framework.id}`, () => {
        const content = readmeMd(readmeOptions(framework, selection));

        it("titles the project and credits the generator", () => {
          expect(content).toContain("# my-project");
          expect(content).toContain(
            `This is a **${framework.label}** project generated with [\`@raulmoracode/create\`](${CREATE_REPO_URL}).`,
          );
          expect(content).toContain(
            `- **Node.js ${NODE_VERSION}** — pinned in \`.nvmrc\``,
          );
          expect(content).toContain(
            `- **pnpm ${PNPM_VERSION}** — pinned in \`package.json\``,
          );
          expect(nvmrcContent()).toBe(`${NODE_VERSION}\n`);
          expect(content).toContain(`- [raulmoracode.com](${SITE_URL})`);
          expect(content).toContain(
            "- Repository: [github.com/raulmoracode/my-project](https://github.com/raulmoracode/my-project)",
          );
        });

        it("ends with a trailing newline and carries no machine paths", () => {
          expect(content.endsWith("\n")).toBe(true);
          expect(content).not.toContain("\r");
          expect(content).not.toContain("{{");
          expect(content).not.toContain("${");
          for (const pattern of MACHINE_PATH_PATTERNS) {
            expect(content, pattern.source).not.toMatch(pattern);
          }
        });

        it("tables exactly the real scripts in canonical order", () => {
          expect(section(content, "Scripts")).toEqual([
            "",
            ...expectedScriptsTable(framework, selection),
            "",
          ]);
          expect(content).not.toContain("pnpm prepare");
        });

        it("lists exactly the tech stack of the selection", () => {
          expect(section(content, "Tech stack")).toEqual([
            "",
            ...expectedTechStack(
              framework,
              selection,
              readmeOptions(framework, selection).versions,
            ),
            "",
          ]);
        });

        it("keeps the always-on sections", () => {
          expect(content).toContain("## Requirements");
          expect(content).toContain("## Getting started");
          expect(content).toContain("## Continuous integration");
          expect(content).toContain("## Site identity");
          expect(content).toContain("## Project structure");
          expect(content).toContain("## Links");
          expect(content).toContain("AGENTS.md");
          expect(content).toContain("LICENSE");
          expect(content).toContain("CHANGELOG.md");
          expect(content).toContain("pnpm-workspace.yaml");
          expect(content).toContain("site.ts");
        });

        it("shows the shadcn registry section only with shadcn", () => {
          if (selection.shadcn) {
            expect(content).toContain("## shadcn components");
            expect(content).toContain(RAULMORACODE_REGISTRY_ADD_EXAMPLE);
            expect(content).toContain(RAULMORACODE_REGISTRY_CATALOG_URL);
            expect(content).toContain("components.json");
          } else {
            expect(content).not.toContain("## shadcn components");
            expect(content).not.toContain(RAULMORACODE_REGISTRY_ADD_EXAMPLE);
            expect(content).not.toContain("components.json");
          }
        });

        it("shows the Git workflow section only with Husky", () => {
          if (selection.husky) {
            expect(content).toContain("## Git workflow");
            expect(content).toContain(".husky/");
            expect(content).toContain("commitlint.config.ts");
          } else {
            expect(content).not.toContain("## Git workflow");
            expect(content).not.toContain(".husky/");
            expect(content).not.toContain("commitlint.config.ts");
          }
        });

        it("mirrors the tooling files of the selection in the tree", () => {
          const tree = treeLines(content);
          const presence: Array<[string, boolean]> = [
            ["biome.json", selection.biome],
            ["vitest.config.ts", selection.testing],
            [".vscode/", selection.vscode],
            ["components.json", selection.shadcn],
            ["components/", selection.shadcn],
            ["hooks/", selection.shadcn],
            ["test/", selection.testing],
            ["lib/", selection.shadcn || selection["tanstack-query"]],
            [
              "providers.tsx",
              selection["tanstack-query"] && framework.id === "next",
            ],
          ];
          for (const [fragment, expected] of presence) {
            expect(treeHas(tree, fragment), fragment).toBe(expected);
          }
          const cssComment = selection.tailwind
            ? "Tailwind entry point"
            : "global styles";
          expect(tree.some((line) => line.includes(`# ${cssComment}`))).toBe(
            true,
          );
        });

        it("renders the framework-specific tree", () => {
          const tree = treeLines(content);
          if (framework.id === "vite") {
            expect(treeHas(tree, "index.html")).toBe(true);
            expect(treeHas(tree, "main.tsx")).toBe(true);
            expect(treeHas(tree, "App.tsx")).toBe(true);
            expect(treeHas(tree, "tab title + favicon")).toBe(true);
            expect(treeHas(tree, "layout.tsx")).toBe(false);
            expect(treeHas(tree, "page.tsx")).toBe(false);
            expect(treeHas(tree, "app/")).toBe(false);
          } else {
            expect(treeHas(tree, "index.html")).toBe(false);
            expect(treeHas(tree, "main.tsx")).toBe(false);
            expect(treeHas(tree, "App.tsx")).toBe(false);
            expect(treeHas(tree, "app/")).toBe(true);
            expect(treeHas(tree, "layout.tsx")).toBe(true);
            expect(treeHas(tree, "page.tsx")).toBe(true);
            expect(treeHas(tree, "error.tsx")).toBe(true);
            expect(treeHas(tree, "not-found.tsx")).toBe(true);
          }
          if (selection["tanstack-query"]) {
            if (framework.id === "next") {
              expect(treeHas(tree, "providers.tsx")).toBe(true);
            } else {
              expect(tree.find((line) => line.includes("main.tsx"))).toContain(
                "QueryClientProvider wired",
              );
            }
          }
        });

        it("documents the site identity per framework", () => {
          if (framework.id === "next") {
            expect(content).toContain(
              "The `metadata` export in `src/app/layout.tsx` reads those values.",
            );
            expect(content).not.toContain("siteHead()");
          } else {
            expect(content).toContain(
              "The `siteHead()` plugin in `vite.config.ts` injects the tags into `index.html` at build time.",
            );
          }
        });
      });
    }
  }
});
