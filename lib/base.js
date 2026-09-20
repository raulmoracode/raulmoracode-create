import { PNPM_VERSION } from "./pnpm.js";

export const FRAMEWORKS = ["vite", "next"];
export const TEMPLATES = ["marketing", "saas", "portfolio"];

/** Canonical Biome config for every generated project. */
export function baseBiomeJson() {
  return {
    $schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
    organizeImports: { enabled: true },
    files: {
      ignore: ["node_modules", ".next", "dist", "build", "public/r"],
    },
    // Official scaffolds ship tsconfig files with comments (JSONC).
    json: { parser: { allowComments: true } },
    linter: {
      enabled: true,
      rules: { recommended: true },
    },
    formatter: {
      enabled: true,
      indentStyle: "space",
      indentWidth: 2,
    },
    javascript: {
      formatter: {
        arrowParentheses: "always",
        bracketSameLine: false,
        bracketSpacing: true,
        jsxQuoteStyle: "double",
        quoteProperties: "asNeeded",
        semicolons: "always",
        trailingCommas: "all",
      },
    },
  };
}

/**
 * biome.json serialized exactly as `biome format` prints it, so
 * `pnpm check` is green in a fresh project. JSON.stringify would expand
 * the short `ignore` array; Biome keeps it inline.
 */
export function baseBiomeJsonText() {
  const text = JSON.stringify(baseBiomeJson(), null, 2);
  return `${text.replace(
    `"ignore": [\n      "node_modules",\n      ".next",\n      "dist",\n      "build",\n      "public/r"\n    ]`,
    `"ignore": ["node_modules", ".next", "dist", "build", "public/r"]`,
  )}\n`;
}

/** Installed @biomejs/biome major declared by the scaffold (1 when absent). */
export function scaffoldBiomeMajor(pkg) {
  const raw =
    pkg?.devDependencies?.["@biomejs/biome"] ??
    pkg?.dependencies?.["@biomejs/biome"];
  const match = String(raw ?? "").match(/(\d+)\.\d+\.\d+/);
  return match ? Number(match[1]) : 1;
}

/**
 * Canonical Biome 2 config for Next.js scaffolds (which install Biome 2).
 * Mirrors the official create-next-app shape, plus JSONC tolerance for
 * tsconfigs and the registry build output ignore. The $schema version
 * tracks the installed Biome version: Biome 2 requires an exact match.
 */
export function baseBiomeJsonV2(installedVersion) {
  const version =
    String(installedVersion ?? "").match(/(\d+\.\d+\.\d+)/)?.[1] ?? "2.4.2";
  return {
    $schema: `https://biomejs.dev/schemas/${version}/schema.json`,
    vcs: { enabled: true, clientKind: "git", useIgnoreFile: true },
    files: {
      ignoreUnknown: true,
      includes: [
        "**",
        "!node_modules",
        "!.next",
        "!dist",
        "!build",
        "!public/r",
      ],
    },
    json: { parser: { allowComments: true } },
    formatter: { enabled: true, indentStyle: "space", indentWidth: 2 },
    css: { parser: { tailwindDirectives: true } },
    linter: {
      enabled: true,
      rules: { recommended: true },
      domains: { next: "recommended", react: "recommended" },
    },
    assist: { actions: { source: { organizeImports: "on" } } },
  };
}

export function baseBiomeJsonTextV2(installedVersion) {
  const text = JSON.stringify(baseBiomeJsonV2(installedVersion), null, 2);
  // Biome 2 keeps this 6-item array expanded; JSON.stringify inlines it.
  return `${text.replace(
    `"includes": ["**", "!node_modules", "!.next", "!dist", "!build", "!public/r"]`,
    `"includes": [\n        "**",\n        "!node_modules",\n        "!.next",\n        "!dist",\n        "!build",\n        "!public/r"\n      ]`,
  )}\n`;
}

/**
 * Canonical shadcn config. The @raulmoracode registry entry is what makes
 * `pnpm dlx shadcn@latest add @raulmoracode/<name>` resolve.
 */
export function baseComponentsJson() {
  return {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: true,
    tsx: true,
    tailwind: {
      config: "",
      css: "src/app/globals.css",
      baseColor: "neutral",
      cssVariables: true,
      prefix: "",
    },
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    iconLibrary: "lucide",
    registries: {
      "@raulmoracode": {
        url: "https://registry.raulmoracode.com/r/{name}.json",
        headers: {
          Authorization: "Bearer ${RAUL_REGISTRY_TOKEN}",
        },
      },
    },
  };
}

/** Minimal .npmrc: enforce the Node floor pnpm 12 needs when installed via npm. */
export function baseNpmrc() {
  return [
    "# RaulMoraCode uses pnpm as its official package manager.",
    "engine-strict=true",
    "",
  ].join("\n");
}

/**
 * pnpm 12 requires explicit build-script approvals: without this file a
 * fresh `pnpm install` fails with ERR_PNPM_IGNORED_BUILDS. These packages
 * ship prebuilt binaries, so denying their install scripts is safe
 * (verified: `pnpm check` and `pnpm build` pass with them denied).
 * NOT a monorepo: no `packages:` field.
 */
export function basePnpmWorkspaceYaml() {
  return [
    "# NOT a monorepo: no `packages:` field. Build approvals only, so fresh",
    "# clones install non-interactively without trusting install scripts.",
    "allowBuilds:",
    "  '@biomejs/biome': false",
    "  '@swc/core': false",
    "  esbuild: false",
    "",
  ].join("\n");
}

const GITIGNORE_MANAGED_START = "# >>> raulmoracode (pnpm-only) >>>";
const GITIGNORE_MANAGED_BLOCK = [
  "# >>> raulmoracode (pnpm-only) >>>",
  "# pnpm is the official package manager. Never commit other lockfiles.",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "node_modules",
  ".next",
  "dist",
  "# <<< raulmoracode (pnpm-only) <<<",
  "",
].join("\n");

/** Merge pnpm-only ignore rules into an existing .gitignore (idempotent). */
export function mergeGitignore(existing) {
  const current = existing ?? "";
  if (current.includes(GITIGNORE_MANAGED_START)) return current;
  const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  return `${current}${prefix}\n${GITIGNORE_MANAGED_BLOCK}`;
}

/**
 * Normalize a scaffolded package.json into a RaulMoraCode project:
 * pnpm pin, pnpm-only scripts, Node floor. Schrodinger-safe: pure function.
 */
export function normalizePackageJson(input, { projectName, framework }) {
  const pkg = { ...(input ?? {}) };
  pkg.name = projectName;
  pkg.private = true;
  pkg.packageManager = `pnpm@${PNPM_VERSION}`;
  if (!pkg.engines || typeof pkg.engines !== "object") pkg.engines = {};
  pkg.engines.node = ">=22";

  const scripts = { ...(pkg.scripts ?? {}) };
  if (framework === "vite") {
    scripts.dev = scripts.dev ?? "vite";
    scripts.build = scripts.build ?? "vite build";
    scripts.preview = scripts.preview ?? "vite preview";
  } else {
    scripts.dev = scripts.dev ?? "next dev";
    scripts.build = scripts.build ?? "next build";
    scripts.start = scripts.start ?? "next start";
  }
  scripts.check = "biome check .";
  scripts.format = "biome format --write .";
  pkg.scripts = scripts;

  pkg.devDependencies = { ...(pkg.devDependencies ?? {}) };
  if (!pkg.devDependencies["@biomejs/biome"]) {
    pkg.devDependencies["@biomejs/biome"] = "1.9.4";
  }
  return pkg;
}

/** Starter page per template + framework. Tailwind-only, no extra deps. */
export function templatePage({ template, framework }) {
  const isNext = framework === "next";
  const open = isNext
    ? "export default function Page() {"
    : "export default function App() {";
  const bodies = {
    marketing: [
      '<main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">',
      '  <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">RaulMoraCode · Marketing</p>',
      '  <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Ship your marketing site faster</h1>',
      '  <p className="max-w-xl text-muted-foreground">Built on the RaulMoraCode Project Base: React, TypeScript, Tailwind CSS, shadcn/ui and Biome — managed with pnpm.</p>',
      '  <div className="flex gap-3">',
      '    <button type="button" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Get started</button>',
      '    <button type="button" className="rounded-md border px-5 py-2.5 text-sm font-medium">Learn more</button>',
      "  </div>",
      "</main>",
    ],
    saas: [
      '<main className="mx-auto grid min-h-screen max-w-6xl gap-6 p-6 sm:grid-cols-3">',
      '  <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground sm:col-span-3">RaulMoraCode · SaaS</p>',
      '  <h1 className="text-3xl font-bold tracking-tight sm:col-span-3">Your SaaS dashboard starts here</h1>',
      '  {["MRR", "Active users", "Churn"].map((kpi) => (',
      '    <section key={kpi} className="rounded-lg border p-5">',
      '      <p className="text-sm text-muted-foreground">{kpi}</p>',
      '      <p className="mt-2 text-2xl font-semibold">—</p>',
      "    </section>",
      "  ))}",
      "</main>",
    ],
    portfolio: [
      '<main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">',
      "  <header>",
      '    <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">RaulMoraCode · Portfolio</p>',
      '    <h1 className="mt-2 text-4xl font-bold tracking-tight">Your name</h1>',
      '    <p className="mt-2 text-muted-foreground">Designer & engineer. Replace this with your story.</p>',
      "  </header>",
      '  <section className="grid gap-4 sm:grid-cols-2">',
      '    {["Project one", "Project two"].map((project) => (',
      '      <article key={project} className="rounded-lg border p-5">',
      '        <h2 className="font-semibold">{project}</h2>',
      '        <p className="mt-1 text-sm text-muted-foreground">Short description of the work.</p>',
      "      </article>",
      "    ))}",
      "  </section>",
      "</main>",
    ],
  };
  const body = (bodies[template] ?? bodies.marketing).join("\n");
  return [`${open}`, "  return (", body, "  );", "}", ""].join("\n");
}

/**
 * Vite entry without non-null assertions: the scaffold's
 * `document.getElementById('root')!` fails `biome check`
 * (lint/style/noNonNullAssertion).
 */
export function viteMainTsx() {
  return [
    'import { StrictMode } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import "./index.css";',
    'import App from "./App.tsx";',
    "",
    'const rootElement = document.getElementById("root");',
    'if (!rootElement) throw new Error("Missing #root element");',
    "",
    "createRoot(rootElement).render(",
    "  <StrictMode>",
    "    <App />",
    "  </StrictMode>,",
    ");",
    "",
  ].join("\n");
}

/**
 * Add the Tailwind v4 Vite plugin to a scaffolded vite.config.ts.
 * Pure string patch; returns `{ patched, changed }` and leaves unknown
 * shapes untouched so the CLI never corrupts user config.
 */
export function patchViteConfig(source) {
  if (source.includes("@tailwindcss/vite"))
    return { patched: source, changed: false };
  const anchors = [
    "import react from '@vitejs/plugin-react'",
    'import react from "@vitejs/plugin-react"',
  ];
  const anchor = anchors.find((a) => source.includes(a));
  if (!anchor || !source.includes("plugins: [react()]")) {
    return { patched: source, changed: false };
  }
  const patched = source
    .replace(anchor, `${anchor}\nimport tailwindcss from "@tailwindcss/vite"`)
    .replace("plugins: [react()]", "plugins: [react(), tailwindcss()]");
  return { patched, changed: true };
}

/** Extra deps per framework, installed exclusively with `pnpm add`. */
export function templateDeps(framework) {
  if (framework === "vite") {
    return {
      prod: ["clsx", "tailwind-merge", "tw-animate-css"],
      dev: ["tailwindcss", "@tailwindcss/vite"],
    };
  }
  return { prod: ["clsx", "tailwind-merge", "tw-animate-css"], dev: [] };
}

/** cn() helper: identical to the registry's lib/utils (registry/common/utils.ts). */
export function utilsTs() {
  return [
    'import { type ClassValue, clsx } from "clsx";',
    'import { twMerge } from "tailwind-merge";',
    "",
    "export function cn(...inputs: ClassValue[]) {",
    "  return twMerge(clsx(inputs));",
    "}",
    "",
  ].join("\n");
}

/**
 * Project theme CSS (Tailwind v4 + shadcn tokens).
 * Source of truth: registry/common/globals.css — mirrored here so the
 * published CLI package stays self-contained (zero-dep, no file reads
 * outside the package).
 */
export function themeCss() {
  return [
    "@import \"tailwindcss\";",
    "@import \"tw-animate-css\";",
    "",
    "@custom-variant dark (&:is(.dark *));",
    "",
    ":root {",
    "  --background: oklch(0.97 0.01 80.72);",
    "  --foreground: oklch(0.3 0.04 30.2);",
    "",
    "  --card: oklch(0.97 0.01 80.72);",
    "  --card-foreground: oklch(0.3 0.04 30.2);",
    "",
    "  --popover: oklch(0.97 0.01 80.72);",
    "  --popover-foreground: oklch(0.3 0.04 30.2);",
    "",
    "  --primary: oklch(0.52 0.13 144.17);",
    "  --primary-foreground: oklch(1.0 0 0);",
    "",
    "  --secondary: oklch(0.96 0.02 147.64);",
    "  --secondary-foreground: oklch(0.43 0.12 144.31);",
    "",
    "  --muted: oklch(0.94 0.01 74.42);",
    "  --muted-foreground: oklch(0.45 0.05 39.21);",
    "",
    "  --accent: oklch(0.9 0.05 146.04);",
    "  --accent-foreground: oklch(0.43 0.12 144.31);",
    "",
    "  --destructive: oklch(0.54 0.19 26.72);",
    "  --destructive-foreground: oklch(1.0 0 0);",
    "",
    "  --border: oklch(0.88 0.02 74.64);",
    "  --input: oklch(0.88 0.02 74.64);",
    "  --ring: oklch(0.52 0.13 144.17);",
    "",
    "  --chart-1: oklch(0.67 0.16 144.21);",
    "  --chart-2: oklch(0.58 0.14 144.18);",
    "  --chart-3: oklch(0.52 0.13 144.17);",
    "  --chart-4: oklch(0.43 0.12 144.31);",
    "  --chart-5: oklch(0.22 0.05 145.73);",
    "",
    "  --sidebar: oklch(0.94 0.01 74.42);",
    "  --sidebar-foreground: oklch(0.3 0.04 30.2);",
    "  --sidebar-primary: oklch(0.52 0.13 144.17);",
    "  --sidebar-primary-foreground: oklch(1.0 0 0);",
    "  --sidebar-accent: oklch(0.9 0.05 146.04);",
    "  --sidebar-accent-foreground: oklch(0.43 0.12 144.31);",
    "  --sidebar-border: oklch(0.88 0.02 74.64);",
    "  --sidebar-ring: oklch(0.52 0.13 144.17);",
    "",
    "  --radius: 0.5rem;",
    "",
    "  /* RaulMoraCode shared tokens — same CSS across templates, override per use case */",
    "  --font-sans: \"Geist\", system-ui, sans-serif;",
    "  --font-mono: \"Geist Mono\", ui-monospace, monospace;",
    "  --clr-main: oklch(0.145 0 0);",
    "  --clr-sub: oklch(0.27 0 0);",
    "  --clr-dim: oklch(0.556 0 0);",
    "  --clr-dim-plus: oklch(0.3 0 0);",
    "  --clr-dim-tag: oklch(0.2 0 0);",
    "  --clr-faint: oklch(0.645 0 0);",
    "  --clr-hover: oklch(0 0 0);",
    "  --clr-border-subtle: oklch(0.922 0 0);",
    "  --clr-border-card: oklch(0.37 0 0);",
    "  --clr-bg-badge: oklch(0.87 0 0);",
    "  --clr-bg-card-hover: #ececec;",
    "}",
    "",
    ".dark {",
    "  --background: oklch(0.15 0.01 74.42);",
    "  --foreground: oklch(0.95 0.02 80.72);",
    "",
    "  --card: oklch(0.12 0.01 80.72);",
    "  --card-foreground: oklch(0.95 0.02 80.72);",
    "",
    "  --popover: oklch(0.12 0.01 80.72);",
    "  --popover-foreground: oklch(0.95 0.02 80.72);",
    "",
    "  --primary: oklch(0.58 0.15 144.17);",
    "  --primary-foreground: oklch(0.09 0.01 80.72);",
    "",
    "  --secondary: oklch(0.15 0.02 147.64);",
    "  --secondary-foreground: oklch(0.65 0.12 144.31);",
    "",
    "  --muted: oklch(0.18 0.01 74.42);",
    "  --muted-foreground: oklch(0.65 0.03 74.42);",
    "",
    "  --accent: oklch(0.22 0.04 146.04);",
    "  --accent-foreground: oklch(0.65 0.12 144.31);",
    "",
    "  --destructive: oklch(0.62 0.22 26.72);",
    "  --destructive-foreground: oklch(0.95 0.02 80.72);",
    "",
    "  --border: oklch(0.22 0.02 74.64);",
    "  --input: oklch(0.22 0.02 74.64);",
    "  --ring: oklch(0.58 0.15 144.17);",
    "",
    "  --chart-1: oklch(0.72 0.16 144.21);",
    "  --chart-2: oklch(0.63 0.14 144.18);",
    "  --chart-3: oklch(0.58 0.15 144.17);",
    "  --chart-4: oklch(0.48 0.12 144.31);",
    "  --chart-5: oklch(0.35 0.08 145.73);",
    "",
    "  --sidebar: oklch(0.15 0.01 74.42);",
    "  --sidebar-foreground: oklch(0.95 0.02 80.72);",
    "  --sidebar-primary: oklch(0.58 0.15 144.17);",
    "  --sidebar-primary-foreground: oklch(0.09 0.01 80.72);",
    "  --sidebar-accent: oklch(0.22 0.04 146.04);",
    "  --sidebar-accent-foreground: oklch(0.65 0.12 144.31);",
    "  --sidebar-border: oklch(0.22 0.02 74.64);",
    "  --sidebar-ring: oklch(0.58 0.15 144.17);",
    "",
    "  /* RaulMoraCode shared tokens (dark) */",
    "  --clr-main: oklch(0.985 0 0);",
    "  --clr-sub: oklch(0.708 0 0);",
    "  --clr-dim: oklch(0.556 0 0);",
    "  --clr-dim-plus: oklch(0.8 0 0);",
    "  --clr-dim-tag: oklch(0.9 0 0);",
    "  --clr-faint: oklch(0.556 0 0);",
    "  --clr-hover: oklch(1 0 0);",
    "  --clr-border-subtle: oklch(1 0 0 / 10%);",
    "  --clr-border-card: oklch(0.269 0 0);",
    "  --clr-bg-badge: oklch(0.269 0 0);",
    "  --clr-bg-card-hover: oklch(0.205 0 0);",
    "}",
    "",
    "@theme inline {",
    "  --color-background: var(--background);",
    "  --color-foreground: var(--foreground);",
    "",
    "  --color-primary: var(--primary);",
    "  --color-primary-foreground: var(--primary-foreground);",
    "",
    "  --color-secondary: var(--secondary);",
    "  --color-secondary-foreground: var(--secondary-foreground);",
    "  --color-accent: var(--accent);",
    "  --color-accent-foreground: var(--accent-foreground);",
    "",
    "  --color-muted: var(--muted);",
    "  --color-muted-foreground: var(--muted-foreground);",
    "  --color-card: var(--card);",
    "  --color-card-foreground: var(--card-foreground);",
    "  --color-popover: var(--popover);",
    "  --color-popover-foreground: var(--popover-foreground);",
    "",
    "  --color-border: var(--border);",
    "  --color-input: var(--input);",
    "  --color-ring: var(--ring);",
    "",
    "  --color-destructive: var(--destructive);",
    "  --color-destructive-foreground: var(--destructive-foreground);",
    "",
    "  --color-chart-1: var(--chart-1);",
    "  --color-chart-2: var(--chart-2);",
    "  --color-chart-3: var(--chart-3);",
    "  --color-chart-4: var(--chart-4);",
    "  --color-chart-5: var(--chart-5);",
    "",
    "  --color-sidebar: var(--sidebar);",
    "  --color-sidebar-foreground: var(--sidebar-foreground);",
    "  --color-sidebar-primary: var(--sidebar-primary);",
    "  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);",
    "  --color-sidebar-accent: var(--sidebar-accent);",
    "  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);",
    "  --color-sidebar-border: var(--sidebar-border);",
    "  --color-sidebar-ring: var(--sidebar-ring);",
    "",
    "  /* RaulMoraCode shared utilities: text-sub, text-dim, bg-bg-badge, border-border-card… */",
    "  --color-main: var(--clr-main);",
    "  --color-sub: var(--clr-sub);",
    "  --color-dim: var(--clr-dim);",
    "  --color-dim-plus: var(--clr-dim-plus);",
    "  --color-dim-tag: var(--clr-dim-tag);",
    "  --color-faint: var(--clr-faint);",
    "  --color-hover: var(--clr-hover);",
    "  --color-border-subtle: var(--clr-border-subtle);",
    "  --color-border-card: var(--clr-border-card);",
    "  --color-bg-badge: var(--clr-bg-badge);",
    "  --color-bg-card-hover: var(--clr-bg-card-hover);",
    "",
    "  --font-sans: var(--font-sans);",
    "  --font-serif: var(--font-serif);",
    "  --font-mono: var(--font-mono);",
    "",
    "  --radius-sm: calc(var(--radius) - 4px);",
    "  --radius-md: calc(var(--radius) - 2px);",
    "  --radius-lg: var(--radius);",
    "  --radius-xl: calc(var(--radius) + 4px);",
    "",
    "  --shadow-2xs: var(--shadow-2xs);",
    "  --shadow-xs: var(--shadow-xs);",
    "  --shadow-sm: var(--shadow-sm);",
    "  --shadow: var(--shadow);",
    "  --shadow-md: var(--shadow-md);",
    "  --shadow-lg: var(--shadow-lg);",
    "  --shadow-xl: var(--shadow-xl);",
    "  --shadow-2xl: var(--shadow-2xl);",
    "}",
    "",
    "@layer base {",
    "  *,",
    "  ::after,",
    "  ::before,",
    "  ::backdrop,",
    "  ::file-selector-button {",
    "    border-color: var(--color-border, currentColor);",
    "  }",
    "}",
    "",
    "/* RaulMoraCode fonts (CDN) */",
    "@font-face {",
    "  font-family: \"Geist\";",
    "  src: url(\"https://cdn.raulmoracode.com/fonts/Geist-Sans/normal/Geist-Regular.woff2\")",
    "    format(\"woff2\");",
    "  font-weight: 400;",
    "  font-style: normal;",
    "  font-display: swap;",
    "}",
    "@font-face {",
    "  font-family: \"Geist Mono\";",
    "  src: url(\"https://cdn.raulmoracode.com/fonts/Geist-Mono/normal/GeistMono-Regular.woff2\")",
    "    format(\"woff2\");",
    "  font-weight: 400;",
    "  font-style: normal;",
    "  font-display: swap;",
    "}",
    "",
  ].join("\n");
}
