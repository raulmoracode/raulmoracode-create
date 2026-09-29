import { describe, expect, it } from "vitest";
import type { TechSelection } from "../src/config/tech.js";
import { FULL_TECH_SELECTION } from "../src/config/tech.js";
import { getFramework } from "../src/frameworks/index.js";
import { nextFramework } from "../src/frameworks/next.js";
import type { PackageJson } from "../src/frameworks/types.js";
import { viteFramework } from "../src/frameworks/vite.js";
import {
  devDependencies,
  normalizePackageJson,
  PNPM_VERSION,
  patchPackageJson,
  pinnedPackages,
  pnpmAddArgs,
  pnpmAddDevArgs,
  pnpmInstallArgs,
  runtimeDependencies,
} from "../src/generators/configure-project.js";

const NO_TECH: TechSelection = {
  tailwind: false,
  shadcn: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: false,
  testing: false,
  husky: false,
  vscode: false,
};

function viteTemplatePackageJson(): PackageJson {
  return {
    name: "vite-react-typescript-starter",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc -b && vite build",
      lint: "oxlint",
      preview: "vite preview",
    },
    dependencies: {
      react: "^19.2.8",
      "react-dom": "^19.2.8",
    },
    devDependencies: {
      "@types/node": "^24.13.3",
      "@types/react": "^19.2.18",
      "@types/react-dom": "^19.2.7",
      "@vitejs/plugin-react": "^6.1.1",
      globals: "^16.5.0",
      oxlint: "^1.81.0",
      typescript: "~6.0.2",
      vite: "^8.3.0",
    },
  };
}

describe("frameworks", () => {
  it("registers vite and next under the expected ids", () => {
    expect(getFramework("vite")).toBe(viteFramework);
    expect(getFramework("next")).toBe(nextFramework);
    expect(viteFramework.label).toBe("React + Vite");
    expect(nextFramework.label).toBe("Next.js");
  });

  it("vite pins the exact required versions", () => {
    expect(viteFramework.pinnedDependencies()).toEqual({
      react: "19.3.0",
      "react-dom": "19.3.0",
    });
    expect(viteFramework.pinnedDevDependencies()).toEqual({
      typescript: "7.0.2",
      vite: "8.3.1",
      "@vitejs/plugin-react": "6.1.1",
    });
  });

  it("next pins the exact required versions", () => {
    expect(nextFramework.pinnedDependencies()).toEqual({
      next: "16.3.6",
      react: "19.3.0",
      "react-dom": "19.3.0",
    });
    expect(nextFramework.pinnedDevDependencies()).toEqual({
      typescript: "7.0.2",
    });
  });

  it("vite scripts match the specification", () => {
    expect(viteFramework.scripts()).toEqual({
      dev: "vite",
      build: "vite build",
      check: "biome check .",
      format: "biome format --write .",
      lint: "biome lint .",
      test: "vitest",
    });
  });

  it("next scripts match the specification", () => {
    expect(nextFramework.scripts()).toEqual({
      dev: "next dev",
      build: "next build",
      start: "next start",
      check: "biome check .",
      format: "biome format --write .",
      lint: "biome lint .",
      test: "vitest",
    });
  });

  it("removes eslint and oxlint tooling", () => {
    const patterns = [
      ...viteFramework.removedDependencyPatterns(),
      ...nextFramework.removedDependencyPatterns(),
    ];
    expect(patterns.some((p) => p.test("eslint"))).toBe(true);
    expect(patterns.some((p) => p.test("oxlint"))).toBe(true);
    expect(patterns.some((p) => p.test("@eslint/js"))).toBe(true);
    expect(patterns.some((p) => p.test("globals"))).toBe(true);
    expect(patterns.some((p) => p.test("typescript"))).toBe(false);
  });
});

describe("dependency installation", () => {
  it("declares the exact additional runtime dependencies", () => {
    expect(runtimeDependencies()).toEqual({
      zustand: "5.0.15",
      "react-hook-form": "7.89.0",
      zod: "4.6.5",
      "@tanstack/react-query": "5.104.0",
    });
  });

  it("declares the exact dev dependencies per framework", () => {
    const viteDev = devDependencies(viteFramework);
    expect(viteDev.tailwindcss).toBe("4.3.3");
    expect(viteDev["@tailwindcss/vite"]).toBe("4.3.3");
    expect(viteDev["@tailwindcss/postcss"]).toBeUndefined();
    expect(viteDev["@biomejs/biome"]).toBe("2.5.14");
    expect(vitestOf(viteDev)).toBe("5.0.2");
    expect(viteDev["@testing-library/react"]).toBe("16.3.3");
    expect(viteDev["@testing-library/dom"]).toBe("10.4.2");

    const nextDev = devDependencies(nextFramework);
    expect(nextDev["@tailwindcss/postcss"]).toBe("4.3.3");
    expect(nextDev["@tailwindcss/vite"]).toBeUndefined();
  });

  it("builds pnpm commands from argument arrays", () => {
    expect(pnpmInstallArgs()).toEqual(["install", "--no-frozen-lockfile"]);
    expect(pnpmAddArgs({ zustand: "5.0.15" })).toEqual([
      "add",
      "zustand@5.0.15",
    ]);
    expect(pnpmAddDevArgs({ vitest: "5.0.2" })).toEqual([
      "add",
      "-D",
      "vitest@5.0.2",
    ]);
  });

  it("exposes the pinned pnpm version", () => {
    expect(PNPM_VERSION).toBe("12.6.0");
  });

  it("does not include lucide-react", () => {
    const all = { ...runtimeDependencies(), ...devDependencies(viteFramework) };
    expect(Object.keys(all)).not.toContain("lucide-react");
  });
});

function vitestOf(deps: Record<string, string>): string | undefined {
  return deps.vitest;
}

describe("patchPackageJson", () => {
  it("pins versions, scripts, engines and removes eslint tooling", async () => {
    const { mkdtemp, writeFile, readFile, rm } = await import(
      "node:fs/promises"
    );
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "raulmoracode-patch-"));
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify(viteTemplatePackageJson()),
        "utf8",
      );
      await patchPackageJson(
        dir,
        viteFramework,
        "my-project",
        "https://github.com/raulmoracode/my-project",
      );
      const patched = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      ) as PackageJson;

      expect(patched.name).toBe("my-project");
      expect(patched.private).toBe(true);
      expect(patched.type).toBe("module");
      expect(patched.version).toBe("0.1.0");
      expect(patched.author).toEqual({
        name: "Raul Mora",
        url: "https://raulmoracode.com",
      });
      expect(patched.homepage).toBe(
        "https://github.com/raulmoracode/my-project",
      );
      expect(patched.repository).toEqual({
        type: "git",
        url: "https://github.com/raulmoracode/my-project",
      });
      expect(patched.packageManager).toBe(`pnpm@${PNPM_VERSION}`);
      expect(patched.engines).toEqual({ node: ">=24" });
      expect(patched.scripts).toEqual({
        ...viteFramework.scripts(),
        prepare: "husky",
      });
      expect(patched.scripts?.dev).toBe("vite");
      expect(patched.scripts?.build).toBe("vite build");
      expect(patched.scripts?.check).toBe("biome check .");
      expect(patched.scripts?.format).toBe("biome format --write .");
      expect(patched.scripts?.lint).toBe("biome lint .");
      expect(patched.scripts?.test).toBe("vitest");

      const dependencies = patched.dependencies ?? {};
      expect(dependencies.react).toBe("19.3.0");
      expect(dependencies["react-dom"]).toBe("19.3.0");

      const dev = patched.devDependencies ?? {};
      expect(dev.typescript).toBe("7.0.2");
      expect(dev.vite).toBe("8.3.1");
      expect(dev["@vitejs/plugin-react"]).toBe("6.1.1");
      expect(dev["@types/react"]).toBe("19.2.18");
      expect(dev.husky).toBe("9.1.7");
      expect(dev["@commitlint/cli"]).toBe("21.2.3");
      expect(dev["@commitlint/config-conventional"]).toBe("21.2.3");
      expect(dev.oxlint).toBeUndefined();
      expect(dev.globals).toBeUndefined();
      expect(dev.eslint).toBeUndefined();

      const raw = await readFile(join(dir, "package.json"), "utf8");
      expect(raw).not.toMatch(/[\^~]/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("leaves no trace of deselected techs in scripts and dependencies", async () => {
    const { mkdtemp, writeFile, readFile, rm } = await import(
      "node:fs/promises"
    );
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "raulmoracode-patch-min-"));
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify(viteTemplatePackageJson()),
        "utf8",
      );
      await patchPackageJson(
        dir,
        viteFramework,
        "my-project",
        "https://github.com/raulmoracode/my-project",
        NO_TECH,
      );
      const patched = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      ) as PackageJson;

      expect(patched.scripts).toEqual({
        dev: "vite",
        build: "vite build",
      });
      expect(patched.scripts?.prepare).toBeUndefined();

      const dev = patched.devDependencies ?? {};
      expect(dev.typescript).toBe("7.0.2");
      expect(dev.husky).toBeUndefined();
      expect(dev["@commitlint/cli"]).toBeUndefined();
      expect(dev.vitest).toBeUndefined();
      expect(dev["@biomejs/biome"]).toBeUndefined();
      expect(dev.clsx).toBeUndefined();
      expect(dev.tailwindcss).toBeUndefined();

      const raw = await readFile(join(dir, "package.json"), "utf8");
      expect(raw).not.toContain("husky");
      expect(raw).not.toContain("commitlint");
      expect(raw).not.toContain("vitest");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps prepare and core scripts when only Husky is deselected", async () => {
    const { mkdtemp, writeFile, readFile, rm } = await import(
      "node:fs/promises"
    );
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "raulmoracode-patch-nohusky-"));
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify(viteTemplatePackageJson()),
        "utf8",
      );
      await patchPackageJson(
        dir,
        viteFramework,
        "my-project",
        "https://github.com/raulmoracode/my-project",
        { ...FULL_TECH_SELECTION, husky: false },
      );
      const patched = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      ) as PackageJson;
      expect(patched.scripts?.prepare).toBeUndefined();
      expect(patched.scripts?.check).toBe("biome check .");
      expect(patched.scripts?.test).toBe("vitest");
      expect(patched.devDependencies?.husky).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("filters runtime, dev and pinned packages by selection", () => {
    expect(runtimeDependencies(NO_TECH)).toEqual({});
    expect(runtimeDependencies(FULL_TECH_SELECTION).zustand).toBe("5.0.15");

    const dev = devDependencies(viteFramework, NO_TECH);
    expect(dev["@biomejs/biome"]).toBeUndefined();
    expect(dev.vitest).toBeUndefined();
    expect(dev.clsx).toBeUndefined();
    expect(dev.husky).toBeUndefined();
    expect(dev.tailwindcss).toBeUndefined();
    expect(dev["@tailwindcss/vite"]).toBeUndefined();

    const pinned = pinnedPackages(viteFramework, NO_TECH);
    expect(pinned).not.toContain("husky@9.1.7");
    expect(pinned).not.toContain("vitest@5.0.2");
    expect(pinned).toContain("react@19.3.0");
    expect(pinned).toContain("vite@8.3.1");
  });

  it("normalizePackageJson strips range prefixes added by pnpm", async () => {
    const { mkdtemp, writeFile, readFile, rm } = await import(
      "node:fs/promises"
    );
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "raulmoracode-normalize-"));
    try {
      const pkg: PackageJson = {
        name: "my-project",
        dependencies: { zustand: "^5.0.15" },
        devDependencies: { vitest: "~5.0.2" },
      };
      await writeFile(join(dir, "package.json"), JSON.stringify(pkg), "utf8");
      await normalizePackageJson(dir);
      const normalized = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      ) as PackageJson;
      expect(normalized.dependencies?.zustand).toBe("5.0.15");
      expect(normalized.devDependencies?.vitest).toBe("5.0.2");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
