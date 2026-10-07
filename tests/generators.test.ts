import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

import { SHADCN_VERSION } from "../src/config/components.js";
import { nextErrorPage, nextNotFoundPage } from "../src/config/error-pages.js";
import { SITE_HEAD_COMMENT } from "../src/config/site.js";
import { FULL_TECH_SELECTION } from "../src/config/tech.js";
import { nextFramework } from "../src/frameworks/next.js";
import { viteFramework } from "../src/frameworks/vite.js";
import {
  configureBiome,
  TOOLING_CONFIG_FILES,
} from "../src/generators/configure-biome.js";
import { configureChangelog } from "../src/generators/configure-changelog.js";
import { configureCi } from "../src/generators/configure-ci.js";
import { configureGitHooks } from "../src/generators/configure-git-hooks.js";
import { configureManifest } from "../src/generators/configure-manifest.js";
import {
  augmentGitignore,
  configureEditorconfig,
  configureNode,
  requiredGitignoreEntries,
} from "../src/generators/configure-node.js";
import {
  PROJECT_AUTHOR,
  refreshPnpmWorkspaceExcludes,
  writeProjectLicense,
} from "../src/generators/configure-project.js";
import { configureReadme } from "../src/generators/configure-readme.js";
import { configureShadcn } from "../src/generators/configure-shadcn.js";
import { configureSite } from "../src/generators/configure-site.js";
import { configureTesting } from "../src/generators/configure-testing.js";
import {
  applyRegistryTheme,
  themeAddArgs,
} from "../src/generators/configure-theme.js";
import { configureVscode } from "../src/generators/configure-vscode.js";
import {
  managedDependencyPins,
  managedFiles,
} from "../src/upgrade/managed-files.js";
import { hashContent, parseManifest } from "../src/upgrade/manifest.js";
import { MANIFEST_FILE } from "../src/upgrade/types.js";
import { listDirEntries, writeTextFile } from "../src/utils/filesystem.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "raulmoracode-gen-"));
  tempDirs.push(dir);
  return dir;
}

async function readFromFile(dir: string, ...parts: string[]): Promise<string> {
  return readFile(join(dir, ...parts), "utf8");
}

afterEach(async () => {
  execMock.mockReset();
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("configureNode", () => {
  it("writes .nvmrc with Node 24", async () => {
    const dir = await makeTempDir();
    await configureNode(dir);
    expect(await readFromFile(dir, ".nvmrc")).toBe("24\n");
  });

  it("writes .editorconfig", async () => {
    const dir = await makeTempDir();
    await configureEditorconfig(dir);
    const content = await readFromFile(dir, ".editorconfig");
    expect(content).toContain("root = true");
    expect(content).toContain("indent_size = 2");
  });

  it("augments .gitignore without duplicating entries", async () => {
    const dir = await makeTempDir();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(dir, ".gitignore"), "node_modules\ndist\n", "utf8");
    await augmentGitignore(dir);
    const first = await readFromFile(dir, ".gitignore");
    expect(first).toContain("node_modules");
    expect(first).toContain("dist");
    expect(first).toContain(".env");
    expect(first).toContain(".env.*");

    await augmentGitignore(dir);
    const second = await readFromFile(dir, ".gitignore");
    expect(second).toBe(first);
  });

  it("requires at least the base ignore entries", () => {
    const entries = requiredGitignoreEntries();
    for (const required of ["node_modules", "dist", ".env", ".env.*"]) {
      expect(entries).toContain(required);
    }
  });
});

describe("configureBranding (vite)", () => {
  it("leaves a single head placeholder and removes the template title and icon", async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "my-project" }),
      "utf8",
    );
    await writeFile(
      join(dir, "index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <head>",
        '    <meta charset="UTF-8" />',
        '    <link rel="icon" type="image/svg+xml" href="/vite.svg" />',
        "    <title>vite-react-typescript-starter</title>",
        "  </head>",
        "</html>",
        "",
      ].join("\n"),
      "utf8",
    );
    await viteFramework.configureBranding(dir);
    const branded = await readFromFile(dir, "index.html");
    expect(branded).toContain(SITE_HEAD_COMMENT);
    expect(branded).not.toContain("<title>");
    expect(branded).not.toContain("/vite.svg");
    expect(branded).toContain('<meta charset="UTF-8" />');
    expect(branded.match(SITE_HEAD_COMMENT)).toHaveLength(1);
    expect(branded.indexOf(SITE_HEAD_COMMENT)).toBeLessThan(
      branded.indexOf("</head>"),
    );
  });

  it("fails clearly when index.html has no head to patch", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "package.json"), '{"name":"my-project"}', "utf8");
    await writeFile(
      join(dir, "index.html"),
      "<html><body></body></html>",
      "utf8",
    );
    await expect(viteFramework.configureBranding(dir)).rejects.toThrow();
  });

  it("fails clearly when index.html has no title or icon", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "index.html"), "<html></html>", "utf8");
    await expect(viteFramework.configureBranding(dir)).rejects.toThrow();
  });
});

describe("configureStarter (vite)", () => {
  it("removes public and assets files and writes the minimal starter", async () => {
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "public", "favicon.svg"), "<svg></svg>");
    await writeTextFile(join(dir, "public", "icons.svg"), "<svg></svg>");
    await writeTextFile(join(dir, "src", "assets", "hero.png"), "fake-png");
    await writeTextFile(join(dir, "src", "App.tsx"), "old app");
    await writeTextFile(join(dir, "src", "App.css"), "old css");
    await writeTextFile(
      join(dir, "tsconfig.app.json"),
      [
        "{",
        "  /* Bundler mode */",
        '  "compilerOptions": {',
        '    "target": "es2023", // keep me',
        '    "types": ["vite/client"]',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    await writeTextFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [{ path: "./tsconfig.app.json" }],
      }),
    );

    await viteFramework.configureStarter?.(dir);

    expect(await listDirEntries(join(dir, "public"))).toEqual([]);
    expect(await listDirEntries(join(dir, "src", "assets"))).toEqual([]);
    expect(await readFromFile(dir, "src", "App.tsx")).toBe(
      'import "./App.css";\n\nfunction App() {\n  return <div>hello</div>;\n}\n\nexport default App;\n',
    );
    expect(await readFromFile(dir, "src", "App.css")).toBe("");
    expect(await readFromFile(dir, "AGENTS.md")).toContain(
      "`@raulmoracode/create`",
    );
    const tsconfig = JSON.parse(
      await readFromFile(dir, "tsconfig.app.json"),
    ) as {
      compilerOptions: { baseUrl?: string; paths: Record<string, string[]> };
    };
    // TypeScript 7 removed baseUrl (TS5102): paths must resolve without it.
    expect(tsconfig.compilerOptions.baseUrl).toBeUndefined();
    expect(tsconfig.compilerOptions.paths).toEqual({ "@/*": ["./src/*"] });
    expect(tsconfig.compilerOptions.target).toBe("es2023");
    expect(tsconfig.compilerOptions.types).toEqual(["vite/client"]);
    const rootTsconfig = JSON.parse(
      await readFromFile(dir, "tsconfig.json"),
    ) as {
      compilerOptions: { baseUrl?: string; paths: Record<string, string[]> };
    };
    expect(rootTsconfig.compilerOptions.baseUrl).toBeUndefined();
    expect(rootTsconfig.compilerOptions.paths).toEqual({
      "@/*": ["./src/*"],
    });
  });

  it("does nothing harmful when the directories do not exist", async () => {
    const dir = await makeTempDir();
    await viteFramework.configureStarter?.(dir);
    expect(await readFromFile(dir, "src", "App.tsx")).toContain(
      "return <div>hello</div>;",
    );
  });

  it("preserves the @raulmoracode registry aliases written by configureShadcn", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "tsconfig.app.json"),
      JSON.stringify({
        compilerOptions: {
          target: "es2023",
          types: ["vite/client"],
        },
      }),
    );
    await writeTextFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [{ path: "./tsconfig.app.json" }],
      }),
    );

    // Real pipeline order in run.ts: configureShadcn first, starter after.
    await configureShadcn(dir, viteFramework);
    await viteFramework.configureStarter?.(dir);

    for (const file of ["tsconfig.app.json", "tsconfig.json"]) {
      const parsed = JSON.parse(await readFromFile(dir, file)) as {
        compilerOptions: { paths: Record<string, string[]> };
      };
      expect(parsed.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
      expect(parsed.compilerOptions.paths["@components/*"]).toEqual([
        "./src/components/*",
      ]);
      expect(parsed.compilerOptions.paths["@lib/*"]).toEqual(["./src/lib/*"]);
    }
  });
});

describe("configureBranding (next)", () => {
  const nextPackageJson = JSON.stringify(
    {
      name: "my-project",
      dependencies: { next: "16.3.6", react: "19.3.0" },
      devDependencies: { typescript: "7.0.2" },
    },
    null,
    2,
  );
  const layout = [
    'import type { Metadata } from "next";',
    'import "./globals.css";',
    "",
    "export const metadata: Metadata = {",
    '  title: "Create Next App",',
    '  description: "Generated by create next app",',
    "};",
    "",
  ].join("\n");

  it("removes the template favicon file", async () => {
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "package.json"), nextPackageJson);
    await writeTextFile(join(dir, "src", "app", "layout.tsx"), layout);
    await writeTextFile(join(dir, "src", "app", "favicon.ico"), "fake-icon");
    await nextFramework.configureBranding(dir);
    await expect(
      readFile(join(dir, "src", "app", "favicon.ico")),
    ).rejects.toThrow();
  });

  it("replaces the metadata export with one driven by the site config", async () => {
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "package.json"), nextPackageJson);
    await writeTextFile(join(dir, "src", "app", "layout.tsx"), layout);
    await nextFramework.configureBranding(dir);
    const branded = await readFromFile(dir, "src", "app", "layout.tsx");
    expect(branded).toContain('import { site } from "@/config/site";');
    expect(branded).toContain("title: site.title,");
    expect(branded).toContain("openGraph: {");
    expect(branded).toContain("twitter: {");
    expect(branded).toContain(
      "images: [{ url: site.socialImage, alt: site.socialImageAlt }]",
    );
    // Empty values are spread away so no blank meta tag is ever emitted.
    expect(branded).toContain(
      "...(site.description ? { description: site.description } : {}),",
    );
    expect(branded).not.toContain('title: "Create Next App"');
    expect(branded).not.toContain('title: "raulmoracode"');
    expect(branded).not.toContain("cdn.raulmoracode.com/icons/favicon.ico");
  });

  it("fails clearly when the layout has no metadata export", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "src", "app", "layout.tsx"),
      "export default function Layout() {\n  return null;\n}\n",
    );
    await expect(nextFramework.configureBranding(dir)).rejects.toThrow();
  });

  it("fails clearly when the layout has no title", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "src", "app", "layout.tsx"),
      "export default function RootLayout() { return null; }",
    );
    await expect(nextFramework.configureBranding(dir)).rejects.toThrow();
  });
});

describe("configureStarter (next)", () => {
  it("removes public files and writes the minimal home page", async () => {
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "public", "next.svg"), "<svg></svg>");
    await writeTextFile(join(dir, "public", "vercel.svg"), "<svg></svg>");
    await writeTextFile(join(dir, "src", "app", "page.tsx"), "old page");
    await writeTextFile(join(dir, "src", "app", "page.module.css"), "old css");
    await writeTextFile(join(dir, "AGENTS.md"), "old agent guide");
    await writeTextFile(join(dir, "CLAUDE.md"), "@AGENTS.md");

    await nextFramework.configureStarter?.(dir);

    expect(await readFromFile(dir, "AGENTS.md")).toContain(
      "`@raulmoracode/create`",
    );
    expect(await listDirEntries(join(dir, "public"))).toEqual([]);
    expect(await readFromFile(dir, "src", "app", "page.tsx")).toBe(
      "export default function Home() {\n  return <div>hello</div>;\n}\n",
    );
    await expect(
      readFile(join(dir, "src", "app", "page.module.css")),
    ).rejects.toThrow();
    await expect(readFile(join(dir, "CLAUDE.md"))).rejects.toThrow();
  });

  it("does nothing harmful when the directories do not exist", async () => {
    const dir = await makeTempDir();
    await nextFramework.configureStarter?.(dir);
    expect(await readFromFile(dir, "src", "app", "page.tsx")).toContain(
      "return <div>hello</div>;",
    );
  });

  it("writes the error and not-found pages", async () => {
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "src", "app", "layout.tsx"), "layout");
    await writeTextFile(join(dir, "package.json"), "{}");
    await nextFramework.configureStarter(dir);
    const errorPage = await readFromFile(dir, "src", "app", "error.tsx");
    const notFound = await readFromFile(dir, "src", "app", "not-found.tsx");
    expect(errorPage).toBe(nextErrorPage());
    expect(notFound).toBe(nextNotFoundPage());
  });
});

describe("refreshPnpmWorkspaceExcludes", () => {
  it("excludes every locked package reported by pnpm list", async () => {
    execMock.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify([
        {
          name: "my-project",
          dependencies: {
            react: { version: "19.3.0" },
          },
          devDependencies: {
            vite: {
              version: "8.3.1",
              dependencies: {
                "@vitest/mocker": { version: "1.0.0" },
              },
            },
          },
        },
      ]),
      stderr: "",
    });
    const dir = await makeTempDir();
    await refreshPnpmWorkspaceExcludes(dir, viteFramework, false);
    const content = await readFromFile(dir, "pnpm-workspace.yaml");
    expect(content).toContain("minimumReleaseAge: 10080");
    expect(content).toContain("'react@19.3.0'");
    expect(content).toContain("'vite@8.3.1'");
    expect(content).toContain("'@vitest/mocker@1.0.0'");
    expect(content).toContain("'zustand@5.0.15'");
    expect(content).toContain("'class-variance-authority@0.7.1'");
    expect(content).toContain("'husky@9.1.7'");
    expect(content).toContain("'@commitlint/cli@21.2.3'");
    expect(content).toContain("'@commitlint/config-conventional@21.2.3'");
    expect(content).toContain("'@raulmoracode/*'");
    expect(execMock).toHaveBeenCalledWith(
      "pnpm",
      ["list", "--depth", "Infinity", "--json"],
      expect.objectContaining({ cwd: dir }),
    );
  });

  it("falls back to pinned packages when pnpm list fails", async () => {
    execMock.mockRejectedValue(new Error("pnpm list failed"));
    const dir = await makeTempDir();
    await refreshPnpmWorkspaceExcludes(dir, viteFramework, false);
    const content = await readFromFile(dir, "pnpm-workspace.yaml");
    expect(content).toContain("minimumReleaseAge: 10080");
    expect(content).toContain("'vite@8.3.1'");
    expect(content).toContain("'husky@9.1.7'");
    expect(content).toContain("'@raulmoracode/*'");
  });

  it("omits the registry scope exclusion when shadcn is deselected", async () => {
    execMock.mockRejectedValue(new Error("pnpm list failed"));
    const dir = await makeTempDir();
    await refreshPnpmWorkspaceExcludes(dir, viteFramework, false, {
      tailwind: true,
      shadcn: false,
      theme: false,
      "tanstack-query": false,
      zustand: false,
      forms: false,
      biome: false,
      testing: false,
      husky: false,
      vscode: false,
    });
    const content = await readFromFile(dir, "pnpm-workspace.yaml");
    expect(content).toContain("minimumReleaseAge: 10080");
    expect(content).not.toContain("@raulmoracode");
  });

  it("preserves existing workspace settings", async () => {
    execMock.mockRejectedValue(new Error("pnpm list failed"));
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "pnpm-workspace.yaml"),
      "minimumReleaseAgeExclude:\n  - react@19.3.0\n",
      "utf8",
    );
    await refreshPnpmWorkspaceExcludes(dir, viteFramework, false);
    const merged = await readFromFile(dir, "pnpm-workspace.yaml");
    expect(merged).toContain("minimumReleaseAge: 10080");
    expect(merged).toContain("minimumReleaseAgeExclude:");
    expect(merged).toContain("react@19.3.0");
  });
});

describe("configureShadcn", () => {
  it("writes components.json with the @raulmoracode registry and the cn() helper", async () => {
    const dir = await makeTempDir();
    await configureShadcn(dir, viteFramework);
    const content = await readFromFile(dir, "components.json");
    expect(content).toContain(
      "https://registry.raulmoracode.com/r/{name}.json",
    );
    expect(content).toContain("ui.shadcn.com/schema.json");
    expect(await readFromFile(dir, "src", "lib", "utils.ts")).toContain(
      "export function cn(",
    );
  });

  it("adds the registry path aliases to every tsconfig present", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "tsconfig.app.json"),
      [
        "{",
        "  /* Bundler mode */",
        '  "compilerOptions": {',
        '    "target": "es2023" // keep me',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    await writeTextFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [{ path: "./tsconfig.app.json" }],
      }),
    );

    await configureShadcn(dir, viteFramework);

    for (const file of ["tsconfig.app.json", "tsconfig.json"]) {
      const parsed = JSON.parse(await readFromFile(dir, file)) as {
        compilerOptions: { paths: Record<string, string[]> };
      };
      expect(parsed.compilerOptions.paths["@components/*"]).toEqual([
        "./src/components/*",
      ]);
      expect(parsed.compilerOptions.paths["@lib/*"]).toEqual(["./src/lib/*"]);
      expect(parsed.compilerOptions.paths["@hooks/*"]).toEqual([
        "./src/hooks/*",
      ]);
    }
    const appConfig = JSON.parse(
      await readFromFile(dir, "tsconfig.app.json"),
    ) as { compilerOptions: { target: string } };
    expect(appConfig.compilerOptions.target).toBe("es2023");
  });

  it("preserves existing tsconfig paths when adding registry aliases", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          paths: { "@/*": ["./src/*"], "@lib/*": ["./custom/lib/*"] },
        },
      }),
    );

    await configureShadcn(dir, viteFramework);

    const parsed = JSON.parse(await readFromFile(dir, "tsconfig.json")) as {
      compilerOptions: {
        paths: Record<string, string[]>;
      };
    };
    expect(parsed.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
    expect(parsed.compilerOptions.paths["@lib/*"]).toEqual(["./custom/lib/*"]);
    expect(parsed.compilerOptions.paths["@components/*"]).toEqual([
      "./src/components/*",
    ]);
  });

  it("skips missing tsconfigs without failing", async () => {
    const dir = await makeTempDir();
    await configureShadcn(dir, viteFramework);
    const content = await readFromFile(dir, "components.json");
    expect(content).toContain("@raulmoracode");
  });
});

describe("configureReadme", () => {
  it("overwrites the scaffold README with the project name and final scripts", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-project",
        scripts: {
          dev: "vite",
          build: "vite build",
          check: "biome check .",
          test: "vitest",
          prepare: "husky",
        },
      }),
    );
    await writeTextFile(join(dir, "README.md"), "# Vite template\n");

    await configureReadme(
      dir,
      viteFramework,
      "my-project",
      "https://github.com/raulmoracode/my-project",
    );

    const content = await readFromFile(dir, "README.md");
    expect(content).toContain("# my-project");
    expect(content).toContain("**React + Vite** project generated with");
    expect(content).toContain("| `pnpm dev` | Start the development server |");
    expect(content).toContain("**React 19.3.0 + Vite 8.3.1");
    expect(content).not.toContain("Vite template");
    expect(content).not.toContain("pnpm prepare");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("adapts sections to the selected techs", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-app",
        scripts: { dev: "next dev", build: "next build" },
      }),
    );

    await configureReadme(
      dir,
      nextFramework,
      "my-app",
      "https://github.com/raulmoracode/my-app",
      {
        tailwind: false,
        shadcn: false,
        "tanstack-query": false,
        zustand: false,
        forms: false,
        biome: false,
        testing: false,
        husky: false,
        vscode: false,
      },
    );

    const content = await readFromFile(dir, "README.md");
    expect(content).toContain("# my-app");
    expect(content).toContain("**Next.js** project generated with");
    expect(content).not.toContain("shadcn components");
    expect(content).not.toContain("components.json");
    expect(content).not.toContain("Git workflow");
  });
});

describe("configureTheme", () => {
  it("invokes the shadcn CLI with an args array in the project dir", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const dir = await makeTempDir();
    await applyRegistryTheme(dir, viteFramework, false);
    expect(execMock).toHaveBeenCalledWith(
      "pnpm",
      [
        "dlx",
        `shadcn@${SHADCN_VERSION}`,
        "add",
        "@raulmoracode/theme",
        "--yes",
        "--overwrite",
      ],
      expect.objectContaining({ cwd: dir }),
    );
    expect(themeAddArgs()).toEqual([
      "dlx",
      `shadcn@${SHADCN_VERSION}`,
      "add",
      "@raulmoracode/theme",
      "--yes",
      "--overwrite",
    ]);
  });

  it("removes the theme junk and restores aliases on Vite", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const dir = await makeTempDir();
    for (const file of [
      "package.json",
      "tsconfig.json",
      "postcss.config.mjs",
    ]) {
      await writeTextFile(join(dir, "src", file), "{}");
    }
    await writeTextFile(join(dir, "src", "app", "globals.css"), ":root{}");
    await writeTextFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: {} }),
    );

    await applyRegistryTheme(dir, viteFramework, false);

    for (const file of [
      "package.json",
      "tsconfig.json",
      "postcss.config.mjs",
    ]) {
      await expect(readFile(join(dir, "src", file))).rejects.toThrow();
    }
    await expect(
      readFile(join(dir, "src", "app", "globals.css")),
    ).rejects.toThrow();
    const parsed = JSON.parse(await readFromFile(dir, "tsconfig.json")) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    expect(parsed.compilerOptions.paths["@components/*"]).toEqual([
      "./src/components/*",
    ]);
  });

  it("keeps the themed globals.css on Next.js", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "src", "tsconfig.json"), "{}");
    await writeTextFile(
      join(dir, "src", "app", "globals.css"),
      ":root{--background: oklch(1 0 0)}",
    );

    await applyRegistryTheme(dir, nextFramework, false);

    await expect(readFile(join(dir, "src", "tsconfig.json"))).rejects.toThrow();
    expect(await readFromFile(dir, "src", "app", "globals.css")).toContain(
      "oklch",
    );
  });
});

describe("configureBiome", () => {
  it("writes biome.json and removes conflicting linter configs", async () => {
    const dir = await makeTempDir();
    const { writeFile } = await import("node:fs/promises");
    for (const file of TOOLING_CONFIG_FILES) {
      await writeFile(join(dir, file), "{}", "utf8");
    }
    await configureBiome(dir);
    const biome = await readFromFile(dir, "biome.json");
    expect(biome).toContain("biomejs");
    for (const file of TOOLING_CONFIG_FILES) {
      await expect(readFile(join(dir, file))).rejects.toThrow();
    }
  });
});

describe("configureVscode", () => {
  it("writes settings.json and extensions.json", async () => {
    const dir = await makeTempDir();
    await configureVscode(dir);
    const settings = await readFromFile(dir, ".vscode", "settings.json");
    expect(settings).toContain("biomejs.biome");
    const extensions = await readFromFile(dir, ".vscode", "extensions.json");
    expect(extensions).toContain("biomejs.biome");
  });
});

describe("configureTesting", () => {
  it("writes the vitest configuration and a smoke test", async () => {
    const dir = await makeTempDir();
    await configureTesting(dir);
    const vitestConfig = await readFromFile(dir, "vitest.config.ts");
    expect(vitestConfig).toContain('environment: "jsdom"');
    const smoke = await readFromFile(dir, "src", "test", "smoke.test.tsx");
    expect(smoke).toContain("@testing-library/react");
  });
});

describe("configureGitHooks", () => {
  it("writes .husky hooks and commitlint.config.ts", async () => {
    const dir = await makeTempDir();
    await configureGitHooks(dir);
    expect(await readFromFile(dir, ".husky", "pre-commit")).toBe(
      "pnpm check\npnpm test\n",
    );
    expect(await readFromFile(dir, ".husky", "commit-msg")).toBe(
      'pnpm exec commitlint --edit "$1"\n',
    );
    const commitlint = await readFromFile(dir, "commitlint.config.ts");
    expect(commitlint).toContain("@commitlint/config-conventional");
    expect(commitlint).toContain("extends");
  });

  it("adapts pre-commit to the selected techs", async () => {
    const dir = await makeTempDir();
    await configureGitHooks(dir, {
      tailwind: true,
      shadcn: true,
      theme: true,
      "tanstack-query": true,
      zustand: true,
      forms: true,
      biome: false,
      testing: true,
      husky: true,
      vscode: true,
    });
    expect(await readFromFile(dir, ".husky", "pre-commit")).toBe("pnpm test\n");
    expect(await readFromFile(dir, ".husky", "commit-msg")).toBe(
      'pnpm exec commitlint --edit "$1"\n',
    );
  });

  it("marks hooks as executable where supported", async () => {
    const dir = await makeTempDir();
    await configureGitHooks(dir);
    if (process.platform === "win32") {
      return;
    }
    for (const hook of ["pre-commit", "commit-msg"]) {
      const mode = (await stat(join(dir, ".husky", hook))).mode;
      expect(mode & 0o111).toBeGreaterThan(0);
    }
  });
});

describe("writeProjectLicense", () => {
  it("writes the MIT license with the project author and the given year", async () => {
    const dir = await makeTempDir();
    await writeProjectLicense(dir, 2026);
    const text = await readFromFile(dir, "LICENSE");
    expect(text.startsWith("MIT License\n")).toBe(true);
    expect(text).toContain(`Copyright (c) 2026 ${PROJECT_AUTHOR.name}`);
    expect(text.endsWith("\n")).toBe(true);
  });
});

describe("configureSite", () => {
  it("writes src/config/site.ts with the project identity", async () => {
    const dir = await makeTempDir();
    await writeTextFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-project",
        dependencies: { react: "19.3.0" },
        devDependencies: { vite: "8.3.1", typescript: "7.0.2" },
      }),
    );
    await configureSite(dir, "my-project");
    const site = await readFromFile(dir, "src", "config", "site.ts");
    expect(site).toContain('name: "my-project",');
    expect(site).toContain('title: "my-project",');
    expect(site).toContain("React 19 + Vite 8 + TypeScript 7");
    expect(site).toContain("https://cdn.raulmoracode.com/icons/favicon.ico");
    expect(site).toContain('twitter: "@raulmoracode",');
    expect(site).toContain('url: "",');
    expect(site).toContain("} as const;");
    expect(site).toContain('socialImage: "/imagen.png",');
    expect(site).toContain(
      'favicon: "https://cdn.raulmoracode.com/icons/favicon.ico",',
    );
    expect(site.endsWith("\n")).toBe(true);
  });

  it("falls back to the brand name when there is no project name", async () => {
    const dir = await makeTempDir();
    await writeTextFile(join(dir, "package.json"), "{}");
    await configureSite(dir, "   ");
    const site = await readFromFile(dir, "src", "config", "site.ts");
    expect(site).toContain('name: "raulmoracode",');
    expect(site).not.toContain("+ TypeScript");
  });
});

describe("configureCi", () => {
  it("writes .github/workflows/ci.yml with the validation steps", async () => {
    const dir = await makeTempDir();
    await configureCi(dir);
    const workflow = await readFromFile(dir, ".github", "workflows", "ci.yml");
    expect(workflow).toContain("name: CI");
    expect(workflow).toContain("pnpm install --no-frozen-lockfile");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm build");
    expect(workflow.endsWith("\n")).toBe(true);
  });
});

describe("configureChangelog", () => {
  it("writes CHANGELOG.md following Keep a Changelog", async () => {
    const dir = await makeTempDir();
    await configureChangelog(dir);
    const changelog = await readFromFile(dir, "CHANGELOG.md");
    expect(changelog).toContain("# Changelog");
    expect(changelog).toContain("## [Unreleased]");
    expect(changelog).toContain("### Added");
    expect(changelog.endsWith("\n")).toBe(true);
  });
});

describe("configureManifest", () => {
  const ON_DISK: Record<string, string> = {
    ".nvmrc": "24\n",
    ".editorconfig": "root = true\n\n[whatever]\nindent_size = 4\n",
    "AGENTS.md": "# AGENTS.md\n\nReformatted by Biome.\n",
    ".github/workflows/ci.yml": "name: CI\njobs:  {}\n",
    "biome.json": '{  "$schema": "x" }\n',
  };

  async function seedManagedFiles(dir: string, files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) {
      await writeTextFile(join(dir, ...path.split("/")), content);
    }
  }

  it("records the identity, the pins and the sha256 of the files on disk", async () => {
    const dir = await makeTempDir();
    await seedManagedFiles(dir, ON_DISK);

    const manifest = await configureManifest(dir, {
      framework: viteFramework,
      projectName: "my-project",
      githubUrl: "https://github.com/raulmoracode/my-project",
      selection: FULL_TECH_SELECTION,
      cliVersion: "1.0.8",
    });

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.cliVersion).toBe("1.0.8");
    expect(manifest.framework).toBe("vite");
    expect(manifest.projectName).toBe("my-project");
    expect(manifest.githubUrl).toBe(
      "https://github.com/raulmoracode/my-project",
    );
    expect(manifest.selection).toEqual(FULL_TECH_SELECTION);
    expect(manifest.dependencies).toEqual(
      managedDependencyPins("vite", FULL_TECH_SELECTION),
    );

    expect(manifest.files).toEqual({
      ".editorconfig": hashContent(ON_DISK[".editorconfig"] as string),
      ".github/workflows/ci.yml": hashContent(
        ON_DISK[".github/workflows/ci.yml"] as string,
      ),
      ".nvmrc": hashContent("24\n"),
      "AGENTS.md": hashContent(ON_DISK["AGENTS.md"] as string),
      "biome.json": hashContent(ON_DISK["biome.json"] as string),
    });
    const templates = managedFiles("vite", FULL_TECH_SELECTION);
    for (const [path, content] of Object.entries(ON_DISK)) {
      expect(manifest.files[path]).toBe(hashContent(content));
      if (content !== templates[path]) {
        expect(manifest.files[path], path).not.toBe(
          hashContent(templates[path] as string),
        );
      }
    }
    expect(
      Object.keys(ON_DISK).filter((path) => ON_DISK[path] !== templates[path]),
    ).toHaveLength(4);
    for (const missing of [
      ".husky/pre-commit",
      ".vscode/settings.json",
      "components.json",
      "vitest.config.ts",
      "vite.config.ts",
    ]) {
      expect(manifest.files[missing]).toBeUndefined();
    }
  });

  it("writes raulmoracode.json that parses back", async () => {
    const dir = await makeTempDir();
    await seedManagedFiles(dir, ON_DISK);
    const written = await configureManifest(dir, {
      framework: nextFramework,
      projectName: "my-project",
      githubUrl: "https://github.com/raulmoracode/my-project",
      selection: FULL_TECH_SELECTION,
      cliVersion: "1.0.8",
    });

    expect(await listDirEntries(dir)).toContain(MANIFEST_FILE);
    const raw = await readFromFile(dir, MANIFEST_FILE);
    expect(raw.endsWith("}\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(written);
    const parsed = parseManifest(raw);
    expect(parsed.framework).toBe("next");
    expect(parsed.files[".nvmrc"]).toBe(hashContent("24\n"));
    expect(parsed.dependencies).toEqual(
      managedDependencyPins("next", FULL_TECH_SELECTION),
    );
    expect(raw.indexOf('"cliVersion"')).toBeLessThan(raw.indexOf('"files"'));
  });

  it("hashes the hooks the CLI wrote without touching them", async () => {
    const dir = await makeTempDir();
    await configureGitHooks(dir, FULL_TECH_SELECTION);
    const hook = join(dir, ".husky", "pre-commit");
    const before = await readFile(hook, "utf8");
    const modeBefore = (await stat(hook)).mode;

    const manifest = await configureManifest(dir, {
      framework: viteFramework,
      projectName: "my-project",
      githubUrl: "https://github.com/raulmoracode/my-project",
      selection: FULL_TECH_SELECTION,
      cliVersion: "1.0.8",
    });

    expect(await readFile(hook, "utf8")).toBe(before);
    expect((await stat(hook)).mode).toBe(modeBefore);
    expect(manifest.files[".husky/pre-commit"]).toBe(hashContent(before));
  });
});
