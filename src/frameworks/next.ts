import { agentsMd } from "../config/agents.js";
import { FAVICON_URL, SITE_TITLE } from "../config/branding.js";
import { queryClientConfig } from "../config/query.js";
import {
  socialMetaOptions,
  withNextSocialMeta,
} from "../config/social-meta.js";
import { nextPostcssConfig, tailwindCss } from "../config/tailwind.js";
import { exec } from "../utils/exec.js";
import {
  isDirectory,
  joinPath,
  listDirEntries,
  readJsonFile,
  readTextFile,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";
import type { PackageJson, ProjectFramework } from "./types.js";

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
    await removeIfExists(joinPath(projectDir, "CLAUDE.md"));
    await writeTextFile(joinPath(projectDir, "AGENTS.md"), agentsMd());
  },

  async configureBranding(projectDir) {
    const layoutPath = joinPath(projectDir, "src", "app", "layout.tsx");
    const layout = await readTextFile(layoutPath);
    const branded = layout.replace(
      /title:\s*"[^"]*",?/,
      `title: "${SITE_TITLE}",\n  icons: {\n    icon: "${FAVICON_URL}",\n  },`,
    );
    if (
      !branded.includes(`title: "${SITE_TITLE}"`) ||
      !branded.includes(FAVICON_URL)
    ) {
      throw new Error(
        "No se pudo configurar el layout de Next.js (título o favicon).",
      );
    }
    const packageJson = await readJsonFile<PackageJson>(
      joinPath(projectDir, "package.json"),
    );
    const withMeta = withNextSocialMeta(
      branded,
      socialMetaOptions(packageJson.name ?? SITE_TITLE, packageJson),
    );
    if (withMeta === null) {
      throw new Error(
        'No se encontró "export const metadata: Metadata = {" en el layout de Next.js (metadatos sociales).',
      );
    }
    await writeTextFile(layoutPath, withMeta);
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
