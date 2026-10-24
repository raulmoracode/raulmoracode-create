import { viteSiteHeadImport, viteSiteHeadPlugin } from "./site.js";

/**
 * The Tailwind entry file the CLI writes. `@theme inline` maps the shadcn
 * tokens (`:root`/`.dark`, added by the shadcn CLI when a component or the
 * registry theme is installed) into Tailwind's theme: without it `bg-background`,
 * `border-input`, `ring-ring` and the `rounded-*` scale generate no CSS, which
 * leaves every shadcn component unstyled.
 */
export function tailwindCss(): string {
  return [
    '@import "tailwindcss";',
    "",
    "@theme inline {",
    "  --color-background: var(--background);",
    "  --color-foreground: var(--foreground);",
    "  --color-card: var(--card);",
    "  --color-card-foreground: var(--card-foreground);",
    "  --color-popover: var(--popover);",
    "  --color-popover-foreground: var(--popover-foreground);",
    "  --color-primary: var(--primary);",
    "  --color-primary-foreground: var(--primary-foreground);",
    "  --color-secondary: var(--secondary);",
    "  --color-secondary-foreground: var(--secondary-foreground);",
    "  --color-muted: var(--muted);",
    "  --color-muted-foreground: var(--muted-foreground);",
    "  --color-accent: var(--accent);",
    "  --color-accent-foreground: var(--accent-foreground);",
    "  --color-destructive: var(--destructive);",
    "  --color-destructive-foreground: var(--destructive-foreground);",
    "  --color-border: var(--border);",
    "  --color-input: var(--input);",
    "  --color-ring: var(--ring);",
    "  --color-chart-1: var(--chart-1);",
    "  --color-chart-2: var(--chart-2);",
    "  --color-chart-3: var(--chart-3);",
    "  --color-chart-4: var(--chart-4);",
    "  --color-chart-5: var(--chart-5);",
    "  --color-sidebar: var(--sidebar);",
    "  --color-sidebar-foreground: var(--sidebar-foreground);",
    "  --color-sidebar-primary: var(--sidebar-primary);",
    "  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);",
    "  --color-sidebar-accent: var(--sidebar-accent);",
    "  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);",
    "  --color-sidebar-border: var(--sidebar-border);",
    "  --color-sidebar-ring: var(--sidebar-ring);",
    "  --radius-sm: calc(var(--radius) - 4px);",
    "  --radius-md: calc(var(--radius) - 2px);",
    "  --radius-lg: var(--radius);",
    "  --radius-xl: calc(var(--radius) + 4px);",
    "}",
    "",
  ].join("\n");
}

export function viteTailwindConfig(): string {
  return [
    'import { fileURLToPath, URL } from "node:url";',
    'import { defineConfig } from "vite";',
    'import react from "@vitejs/plugin-react";',
    'import tailwindcss from "@tailwindcss/vite";',
    viteSiteHeadImport(),
    viteSiteHeadPlugin(),
    "",
    "export default defineConfig({",
    "  plugins: [react(), tailwindcss(), siteHead()],",
    "  resolve: {",
    "    alias: {",
    '      "@": fileURLToPath(new URL("./src", import.meta.url)),',
    "    },",
    "  },",
    "});",
    "",
  ].join("\n");
}

/**
 * Vite config used when Tailwind is deselected.
 *
 * `viteTailwindConfig()` is the only writer of `vite.config.ts` and it only
 * runs when Tailwind is selected, so a project without it would keep the bare
 * `create-vite` config: no `siteHead()` plugin and no `@` alias, which leaves
 * `src/config/site.ts` without any consumer. This template is the same config
 * minus the Tailwind plugin, so the site identity always reaches `index.html`.
 */
export function viteBaseConfig(): string {
  return [
    'import { fileURLToPath, URL } from "node:url";',
    'import { defineConfig } from "vite";',
    'import react from "@vitejs/plugin-react";',
    viteSiteHeadImport(),
    viteSiteHeadPlugin(),
    "",
    "export default defineConfig({",
    "  plugins: [react(), siteHead()],",
    "  resolve: {",
    "    alias: {",
    '      "@": fileURLToPath(new URL("./src", import.meta.url)),',
    "    },",
    "  },",
    "});",
    "",
  ].join("\n");
}

export function nextPostcssConfig(): string {
  return [
    "const config = {",
    '  plugins: ["@tailwindcss/postcss"],',
    "};",
    "",
    "export default config;",
    "",
  ].join("\n");
}
