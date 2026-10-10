import type { Framework } from "../utils/validation.js";
import {
  RAULMORACODE_REGISTRY_ADD_EXAMPLE,
  RAULMORACODE_REGISTRY_CATALOG_URL,
} from "./components.js";
import { NODE_VERSION } from "./nvmrc.js";
import type { TechSelection } from "./tech.js";

export const CREATE_REPO_URL =
  "https://github.com/raulmoracode/raulmoracode-create";
export const SITE_URL = "https://raulmoracode.com";

export interface ReadmeOptions {
  projectName: string;
  githubUrl: string;
  frameworkId: Framework;
  frameworkLabel: string;
  /** Final scripts from the generated package.json (after patching). */
  scripts: Record<string, string>;
  /** Exact pinned versions (framework pins + runtime + dev). */
  versions: Record<string, string>;
  pnpmVersion: string;
  selection: TechSelection;
}

const SCRIPT_DESCRIPTIONS: Record<string, string> = {
  dev: "Start the development server",
  check: "Run the formatter and linter check",
  format: "Apply formatting",
  lint: "Run the linter",
  test: "Run the test suite (watch mode)",
};

const SCRIPT_ORDER = [
  "dev",
  "build",
  "start",
  "check",
  "format",
  "lint",
  "test",
];

function buildDescription(frameworkId: Framework): string {
  return frameworkId === "next"
    ? "Create a production build (`.next/`)"
    : "Create a production build (`dist/`)";
}

function scriptsTable(
  frameworkId: Framework,
  scripts: Record<string, string>,
): string[] {
  const rows = ["| Command | Description |", "| --- | --- |"];
  for (const name of SCRIPT_ORDER) {
    if (!(name in scripts)) {
      continue;
    }
    const description =
      name === "build"
        ? buildDescription(frameworkId)
        : name === "start"
          ? "Start the production server"
          : (SCRIPT_DESCRIPTIONS[name] ?? "Run the script");
    rows.push(`| \`pnpm ${name}\` | ${description} |`);
  }
  return rows;
}

function versioned(versions: Record<string, string>, name: string): string {
  const version = versions[name];
  return version ? ` ${version}` : "";
}

function techStack(
  frameworkId: Framework,
  versions: Record<string, string>,
  selection: TechSelection,
): string[] {
  const rows: string[] = [];
  if (frameworkId === "vite") {
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
      frameworkId === "next" ? "src/app/globals.css" : "src/index.css";
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
      frameworkId === "next" ? "the root layout" : "`src/main.tsx`";
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

function libComment(selection: TechSelection): string | null {
  const parts: string[] = [];
  if (selection["tanstack-query"]) {
    parts.push("query-client.ts");
  }
  if (selection.shadcn) {
    parts.push("cn() in utils.ts");
  }
  return parts.length > 0 ? parts.join(", ") : null;
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
  const lib = libComment(selection);
  if (lib !== null) {
    children.push({ name: "lib/", comment: lib });
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
      comment: "entry HTML (head tags injected by vite.config.ts)",
    });
    root.push({
      name: "vite.config.ts",
      comment: "react plugin + siteHead + @ alias",
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
  root.push(
    {
      name: "pnpm-workspace.yaml",
      comment: "minimumReleaseAge policy + excludes",
    },
    { name: "LICENSE", comment: "MIT license" },
    { name: "CHANGELOG.md", comment: "project changelog" },
    { name: "AGENTS.md", comment: "guidelines for AI coding agents" },
  );
  return ["```text", ...renderTree(root), "```"];
}

export function readmeMd(options: ReadmeOptions): string {
  const {
    projectName,
    githubUrl,
    frameworkId,
    frameworkLabel,
    scripts,
    versions,
    pnpmVersion,
    selection,
  } = options;
  const lines: string[] = [
    `# ${projectName}`,
    "",
    `This is a **${frameworkLabel}** project generated with [\`@raulmoracode/create\`](${CREATE_REPO_URL}).`,
    "",
    "## Requirements",
    "",
    `- **Node.js ${NODE_VERSION}** — pinned in \`.nvmrc\` (\`nvm use\` picks it up automatically)`,
    `- **pnpm ${pnpmVersion}** — pinned in \`package.json\` (\`packageManager\`); never use npm or yarn in this project`,
    "",
    "## Getting started",
    "",
    "```bash",
    "pnpm install",
    "pnpm dev",
    "```",
    "",
    "## Scripts",
    "",
    ...scriptsTable(frameworkId, scripts),
    "",
    "## Tech stack",
    "",
    ...techStack(frameworkId, versions, selection),
  ];
  if (selection.shadcn) {
    lines.push(
      "",
      "## shadcn components",
      "",
      "No components are preinstalled. Add yours from the private registry:",
      "",
      "```bash",
      RAULMORACODE_REGISTRY_ADD_EXAMPLE,
      "```",
      "",
      `Browse the catalogue at ${RAULMORACODE_REGISTRY_CATALOG_URL}. After adding components, normalize their style with Biome (the shadcn CLI uses its own formatting):`,
      "",
      "```bash",
      "pnpm exec biome check --write .",
      "```",
    );
  }
  if (selection.husky) {
    lines.push(
      "",
      "## Git workflow",
      "",
      "- `pre-commit` runs `pnpm check` and `pnpm test`",
      "- `commit-msg` runs Commitlint — commits must follow [Conventional Commits](https://www.conventionalcommits.org/):",
      "",
      "```text",
      "feat: add user profile",
      "fix: handle invalid input",
      "```",
    );
  }
  lines.push(
    "",
    "## Continuous integration",
    "",
    "`.github/workflows/ci.yml` runs on every push and pull request:",
    "",
    "- `pnpm install` — dependencies resolve correctly",
    "- `pnpm check` — code is formatted and linted",
    "- `pnpm test` — tests pass",
    "- `pnpm build` — production build succeeds",
    "",
    "Deployment is manual: once CI passes, deploy to your preferred hosting provider.",
  );
  lines.push(
    "",
    "## Site identity",
    "",
    "`src/config/site.ts` is the single place to change how this site presents itself:",
    "",
    "- `title` — the browser tab title",
    "- `description` — empty by default; filling it adds the meta description and the preview text",
    "- `favicon` — the icon in the tab",
    "- `socialImage` and `socialImageAlt` — the image shown when the link is shared",
    "  (`socialImage` accepts either a local path such as `/imagen.png`, served from `public/`,",
    "  or a full URL)",
    "- `author`, `twitter`, `locale`, `themeColor` and `url` (the canonical URL once deployed)",
    "",
    "Empty values are never rendered: no blank meta tag is emitted.",
    "",
    "`favicon` also accepts a local path such as `/favicon.svg` in `public/`, or a full URL.",
    "",
    "Crawlers cannot resolve relative URLs, so once the site is deployed set `url` and any",
    "local `socialImage` is emitted absolute. The preview image has to be a 1200x630 PNG or",
    "JPG (SVG is ignored by X, WhatsApp and Facebook); put it in `public/` and point",
    "`socialImage` at it.",
    "",
    frameworkId === "next"
      ? "The `metadata` export in `src/app/layout.tsx` reads those values."
      : "The `siteHead()` plugin in `vite.config.ts` injects the tags into `index.html` at build time.",
    "",
    "Change it there and both follow: nothing has to be edited in `index.html` or `layout.tsx`.",
  );
  lines.push(
    "",
    "## Project structure",
    "",
    ...structure(frameworkId, selection),
    "",
    "## Links",
    "",
    `- [raulmoracode.com](${SITE_URL})`,
    `- Repository: [${githubUrl.replace(/^https?:\/\//, "")}](${githubUrl})`,
  );
  return `${lines.join("\n")}\n`;
}
