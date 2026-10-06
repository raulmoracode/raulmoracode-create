import { agentsMd } from "../config/agents.js";
import { nextErrorPage, nextNotFoundPage } from "../config/error-pages.js";
import { queryClientConfig } from "../config/query.js";
import { nextSiteMetadata } from "../config/site.js";
import { nextPostcssConfig, tailwindCss } from "../config/tailwind.js";
import { exec } from "../utils/exec.js";
import {
  isDirectory,
  joinPath,
  listDirEntries,
  readTextFile,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";
import type { ProjectFramework } from "./types.js";

const CREATE_NEXT_APP_VERSION = "16.3.6";

const NEXT_PAGE_TSX = [
  "export default function Home() {",
  "  return <div>hello</div>;",
  "}",
  "",
].join("\n");

const PROVIDERS_TSX = [
  '"use client";',
  "",
  'import { QueryClientProvider } from "@tanstack/react-query";',
  'import type { ReactNode } from "react";',
  'import { queryClient } from "@/lib/query-client";',
  "",
  "export function Providers({ children }: { children: ReactNode }) {",
  "  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;",
  "}",
  "",
].join("\n");

export const nextFramework: ProjectFramework = {
  id: "next",
  label: "Next.js",

  async createProject(name, cwd, verbose) {
    await exec(
      "pnpm",
      [
        "create",
        `next-app@${CREATE_NEXT_APP_VERSION}`,
        name,
        "--ts",
        "--app",
        "--src-dir",
        "--import-alias",
        "@/*",
        "--biome",
        "--use-pnpm",
        "--disable-git",
        "--yes",
      ],
      { cwd, verbose },
    );
    return joinPath(cwd, name);
  },

  scripts() {
    return {
      dev: "next dev",
      build: "next build",
      start: "next start",
      check: "biome check .",
      format: "biome format --write .",
      lint: "biome lint .",
      test: "vitest",
    };
  },

  pinnedDependencies() {
    return {
      next: "16.3.6",
      react: "19.3.0",
      "react-dom": "19.3.0",
    };
  },

  pinnedDevDependencies() {
    return {
      typescript: "7.0.2",
    };
  },

  removedDependencyPatterns() {
    return [/eslint/i, /oxlint/i];
  },

  componentsJsonOptions() {
    return { rsc: true, tailwindCssPath: "src/app/globals.css" };
  },

  async configureStarter(projectDir) {
    const publicDir = joinPath(projectDir, "public");
    if (await isDirectory(publicDir)) {
      for (const entry of await listDirEntries(publicDir)) {
        await removeIfExists(joinPath(publicDir, entry));
      }
    }
    await writeTextFile(
      joinPath(projectDir, "src", "app", "page.tsx"),
      NEXT_PAGE_TSX,
    );
    await removeIfExists(joinPath(projectDir, "src", "app", "page.module.css"));
    await writeTextFile(
      joinPath(projectDir, "src", "app", "error.tsx"),
      nextErrorPage(),
    );
    await writeTextFile(
      joinPath(projectDir, "src", "app", "not-found.tsx"),
      nextNotFoundPage(),
    );
    await removeIfExists(joinPath(projectDir, "CLAUDE.md"));
    await writeTextFile(joinPath(projectDir, "AGENTS.md"), agentsMd());
  },

  async configureBranding(projectDir) {
    const layoutPath = joinPath(projectDir, "src", "app", "layout.tsx");
    const layout = await readTextFile(layoutPath);
    const anchor = /(export const metadata: Metadata = \{)[\s\S]*?\n\};/;
    if (!anchor.test(layout)) {
      throw new Error(
        'No se encontró "export const metadata: Metadata = {...}" en el layout de Next.js.',
      );
    }
    const branded = layout.replace(
      anchor,
      `import { site } from "@/config/site";\n\n${nextSiteMetadata()}`,
    );
    if (
      !branded.includes('import { site } from "@/config/site";') ||
      !branded.includes("description: site.description")
    ) {
      throw new Error(
        "No se pudo configurar el layout de Next.js (metadatos del sitio).",
      );
    }
    await writeTextFile(layoutPath, branded);
    await removeIfExists(joinPath(projectDir, "src", "app", "favicon.ico"));
  },

  async configureTailwind(projectDir) {
    await writeTextFile(
      joinPath(projectDir, "src", "app", "globals.css"),
      tailwindCss(),
    );
    await writeTextFile(
      joinPath(projectDir, "postcss.config.mjs"),
      nextPostcssConfig(),
    );
  },

  async configureTanStackQuery(projectDir) {
    await writeTextFile(
      joinPath(projectDir, "src", "lib", "query-client.ts"),
      queryClientConfig(),
    );
    await writeTextFile(
      joinPath(projectDir, "src", "app", "providers.tsx"),
      PROVIDERS_TSX,
    );

    const layoutPath = joinPath(projectDir, "src", "app", "layout.tsx");
    const layout = await readTextFile(layoutPath);
    const wrapped = layout
      .replace(
        /<body([^>]*)>\{children\}<\/body>/,
        "<body$1><Providers>{children}</Providers></body>",
      )
      .replace(
        'import "./globals.css";',
        'import "./globals.css";\nimport { Providers } from "./providers";',
      );
    if (!wrapped.includes("<Providers>{children}</Providers>")) {
      throw new Error(
        "No se pudo configurar el layout de Next.js para envolver la aplicación con los providers.",
      );
    }
    await writeTextFile(layoutPath, wrapped);
  },
};
