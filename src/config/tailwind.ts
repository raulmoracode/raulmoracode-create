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
