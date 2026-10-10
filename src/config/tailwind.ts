import { viteSiteHeadImport, viteSiteHeadPlugin } from "./site.js";

export function tailwindCss(): string {
  return '@import "tailwindcss";\n';
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
