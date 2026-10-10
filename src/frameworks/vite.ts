import { agentsMd } from "../config/agents.js";
import { queryClientConfig } from "../config/query.js";
import { SITE_HEAD_COMMENT } from "../config/site.js";
import {
  tailwindCss,
  viteBaseConfig,
  viteTailwindConfig,
} from "../config/tailwind.js";
import { exec } from "../utils/exec.js";
import {
  isDirectory,
  joinPath,
  listDirEntries,
  parseJsonc,
  readTextFile,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";
import type { ProjectFramework } from "./types.js";

const CREATE_VITE_VERSION = "9.2.1";

const VITE_MAIN_TSX = [
  'import { StrictMode } from "react";',
  'import { createRoot } from "react-dom/client";',
  'import { QueryClientProvider } from "@tanstack/react-query";',
  'import "./index.css";',
  'import App from "./App.tsx";',
  'import { queryClient } from "./lib/query-client";',
  "",
  'const rootElement = document.getElementById("root");',
  "",
  "if (!rootElement) {",
  '  throw new Error("No se encontró el elemento raíz #root");',
  "}",
  "",
  "createRoot(rootElement).render(",
  "  <StrictMode>",
  "    <QueryClientProvider client={queryClient}>",
  "      <App />",
  "    </QueryClientProvider>",
  "  </StrictMode>",
  ");",
  "",
].join("\n");

async function ensurePathAlias(projectDir: string): Promise<void> {
  for (const file of ["tsconfig.app.json", "tsconfig.json"]) {
    const tsconfigPath = joinPath(projectDir, file);
    let raw: string | null = null;
    try {
      raw = await readTextFile(tsconfigPath);
    } catch {
      continue;
    }
    const tsconfig = parseJsonc<{
      compilerOptions?: Record<string, unknown>;
    }>(raw);
    const compilerOptions = tsconfig.compilerOptions ?? {};
    // No baseUrl: TypeScript 7 removed the option (TS5102), and `paths`
    // resolve fine without it. Merge instead of replacing: configureShadcn
    // may have already written the @raulmoracode registry aliases and they
    // must be preserved.
    const existingPaths = (compilerOptions.paths ?? {}) as Record<
      string,
      string[]
    >;
    compilerOptions.paths = { ...existingPaths, "@/*": ["./src/*"] };
    tsconfig.compilerOptions = compilerOptions;
    await writeTextFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
  }
}

/**
 * Guarantees a `vite.config.ts` that consumes `src/config/site.ts`.
 *
 * `configureTailwind` writes the Tailwind variant (which also carries the
 * `siteHead()` plugin and the `@` alias), but it only runs when Tailwind is
 * selected. Without it the scaffold's own config would survive untouched, the
 * `siteHead()` plugin would never run and the site identity would stay dead in
 * `src/config/site.ts`, so the minimal template is written instead. A config
 * that already wires `siteHead()` (the Tailwind one, or a hand-edited variant)
 * is left as it is.
 */
async function ensureSiteHeadConfig(projectDir: string): Promise<void> {
  const viteConfigPath = joinPath(projectDir, "vite.config.ts");
  let current: string | null = null;
  try {
    current = await readTextFile(viteConfigPath);
  } catch {
    current = null;
  }
  if (current?.includes("siteHead")) {
    return;
  }
  await writeTextFile(viteConfigPath, viteBaseConfig());
}

const VITE_APP_TSX = [
  'import "./App.css";',
  "",
  "function App() {",
  "  return <div>hello</div>;",
  "}",
  "",
  "export default App;",
  "",
].join("\n");

export const viteFramework: ProjectFramework = {
  id: "vite",
  label: "React + Vite",

  async createProject(name, cwd, verbose) {
    await exec(
      "pnpm",
      ["create", `vite@${CREATE_VITE_VERSION}`, name, "--template", "react-ts"],
      {
        cwd,
        verbose,
      },
    );
    return joinPath(cwd, name);
  },

  scripts() {
    return {
      dev: "vite",
      build: "vite build",
      check: "biome check .",
      format: "biome format --write .",
      lint: "biome lint .",
      test: "vitest",
    };
  },

  pinnedDependencies() {
    return {
      react: "19.3.0",
      "react-dom": "19.3.0",
    };
  },

  pinnedDevDependencies() {
    return {
      typescript: "7.0.2",
      vite: "8.3.1",
      "@vitejs/plugin-react": "6.1.1",
    };
  },

  removedDependencyPatterns() {
    return [/eslint/i, /oxlint/i, /^globals$/];
  },

  async configureTailwind(projectDir) {
    await writeTextFile(
      joinPath(projectDir, "vite.config.ts"),
      viteTailwindConfig(),
    );
    await writeTextFile(
      joinPath(projectDir, "src", "index.css"),
      tailwindCss(),
    );
  },

  async configureTanStackQuery(projectDir) {
    await writeTextFile(
      joinPath(projectDir, "src", "lib", "query-client.ts"),
      queryClientConfig(),
    );
    await writeTextFile(joinPath(projectDir, "src", "main.tsx"), VITE_MAIN_TSX);
  },

  componentsJsonOptions() {
    return { rsc: false, tailwindCssPath: "src/index.css" };
  },

  async configureStarter(projectDir) {
    for (const dir of [
      joinPath(projectDir, "public"),
      joinPath(projectDir, "src", "assets"),
    ]) {
      if (!(await isDirectory(dir))) {
        continue;
      }
      for (const entry of await listDirEntries(dir)) {
        await removeIfExists(joinPath(dir, entry));
      }
    }
    await writeTextFile(joinPath(projectDir, "src", "App.tsx"), VITE_APP_TSX);
    await writeTextFile(joinPath(projectDir, "src", "App.css"), "");
    await writeTextFile(joinPath(projectDir, "AGENTS.md"), agentsMd());
    await ensurePathAlias(projectDir);
  },

  async configureBranding(projectDir) {
    await ensureSiteHeadConfig(projectDir);
    const indexPath = joinPath(projectDir, "index.html");
    const html = await readTextFile(indexPath);
    // The title, favicon and social tags are injected by the siteHead() plugin
    // from src/config/site.ts, so the template ones are removed instead of
    // being replaced: two <title> tags would be invalid.
    const branded = html
      .replace(/[ \t]*<title>.*?<\/title>\r?\n/, "")
      .replace(/[ \t]*<link[^>]*rel="icon"[^>]*>\r?\n/, "")
      .replace(/([ \t]*)<\/head>/, `$1  ${SITE_HEAD_COMMENT}\n$1</head>`);
    if (!branded.includes(SITE_HEAD_COMMENT) || branded.includes("<title>")) {
      throw new Error(
        "No se pudo configurar el index.html del proyecto Vite (cabecera).",
      );
    }
    await writeTextFile(indexPath, branded);
  },
};
