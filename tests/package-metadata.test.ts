import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { nextFramework } from "../src/frameworks/next.js";
import type { PackageJson } from "../src/frameworks/types.js";
import { viteFramework } from "../src/frameworks/vite.js";
import {
  devDependencies,
  normalizePackageJson,
  patchPackageJson,
  pinnedPackages,
} from "../src/generators/configure-project.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  bin: Record<string, string>;
  files: string[];
  scripts: Record<string, string>;
  engines: { node: string };
  packageManager: string;
  publishConfig: { registry: string; access: string };
  license: string;
  dependencies: Record<string, string>;
}

describe("package metadata", () => {
  let metadata: PackageMetadata;

  beforeAll(async () => {
    metadata = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    ) as PackageMetadata;
  });

  it("is named @raulmoracode/create", () => {
    expect(metadata.name).toBe("@raulmoracode/create");
  });

  it("exposes exactly the raulmoracode-create bin", () => {
    expect(metadata.bin).toEqual({ "raulmoracode-create": "./dist/index.js" });
    expect(Object.keys(metadata.bin)).toEqual(["raulmoracode-create"]);
    expect(metadata.bin).not.toHaveProperty("create");
  });

  it("ships the compiled dist directory", () => {
    expect(metadata.files).toContain("dist");
    expect(metadata.main).toBe("./dist/index.js");
  });

  it("targets npmjs", () => {
    expect(metadata.publishConfig.registry).toBe("https://registry.npmjs.org/");
    expect(metadata.publishConfig.access).toBe("public");
  });

  it("requires Node.js 24 or higher", () => {
    expect(metadata.engines.node).toBe(">=24");
  });

  it("pins the package manager", () => {
    expect(metadata.packageManager).toBe("pnpm@12.6.0");
  });

  it("declares the expected scripts", () => {
    expect(metadata.scripts.build).toBe("tsc -p tsconfig.json");
    expect(metadata.scripts.test).toBe("vitest run");
    expect(metadata.scripts.check).toBe("biome check .");
    expect(metadata.scripts.format).toBe("biome format --write .");
    expect(metadata.scripts.lint).toBe("biome lint .");
  });

  it("declares exact dependency versions without ranges", () => {
    const all = { ...metadata.dependencies, ...metadata.devDependencies };
    for (const [name, version] of Object.entries(all)) {
      expect(version, name).not.toMatch(/[\^~]/);
    }
    expect(metadata.dependencies["@clack/prompts"]).toBe("1.8.1");
    expect(metadata.devDependencies["@biomejs/biome"]).toBe("2.5.14");
    expect(metadata.devDependencies.typescript).toBe("7.0.2");
    expect(metadata.devDependencies.vitest).toBe("5.0.2");
  });

  it("declares repository, bugs, license and keywords", () => {
    expect(metadata.license).toBe("MIT");
    expect(metadata.repository.url).toContain("raulmoracode-create");
    expect(metadata.bugs.url).toContain("raulmoracode-create");
    expect(metadata.keywords.length).toBeGreaterThan(0);
  });
});

describe("generated package.json with Git hooks", () => {
  it("includes husky and commitlint in devDependencies with exact versions", () => {
    for (const framework of [viteFramework, nextFramework]) {
      const dev = devDependencies(framework);
      expect(dev.husky).toBe("9.1.7");
      expect(dev["@commitlint/cli"]).toBe("21.2.3");
      expect(dev["@commitlint/config-conventional"]).toBe("21.2.3");
      for (const name of [
        "husky",
        "@commitlint/cli",
        "@commitlint/config-conventional",
      ]) {
        expect(dev[name], `${framework.id}:${name}`).not.toMatch(/^[\^~]/);
      }
    }
  });

  it("adds the prepare script while preserving framework scripts", async () => {
    for (const framework of [viteFramework, nextFramework]) {
      const dir = await mkdtemp(join(tmpdir(), "raulmoracode-pkgmeta-"));
      try {
        const template: PackageJson = {
          name: "template",
          scripts: { dev: "vite" },
          dependencies: {},
          devDependencies: {},
        };
        await writeFile(
          join(dir, "package.json"),
          JSON.stringify(template),
          "utf8",
        );
        await patchPackageJson(
          dir,
          framework,
          "my-project",
          "https://github.com/raulmoracode/my-project",
        );
        const patched = JSON.parse(
          await readFile(join(dir, "package.json"), "utf8"),
        ) as PackageJson;
        expect(patched.scripts?.prepare).toBe("husky");
        expect(patched.scripts?.dev).toBe(framework.scripts().dev);
        expect(patched.scripts?.build).toBe(framework.scripts().build);
        expect(patched.scripts?.check).toBe("biome check .");
        expect(patched.scripts?.test).toBe("vitest");
        if (framework.id === "next") {
          expect(patched.scripts?.start).toBe("next start");
        }
        const dev = patched.devDependencies ?? {};
        expect(dev.husky).toBe("9.1.7");
        expect(dev["@commitlint/cli"]).toBe("21.2.3");
        expect(dev["@commitlint/config-conventional"]).toBe("21.2.3");
        for (const [name, version] of Object.entries(dev)) {
          expect(version, name).not.toMatch(/^[\^~]/);
        }
        const raw = await readFile(join(dir, "package.json"), "utf8");
        expect(raw).not.toMatch(/[\^~]/);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("exposes husky and commitlint via pinnedPackages for workspace excludes", () => {
    for (const framework of [viteFramework, nextFramework]) {
      const pinned = pinnedPackages(framework);
      expect(pinned).toContain("husky@9.1.7");
      expect(pinned).toContain("@commitlint/cli@21.2.3");
      expect(pinned).toContain("@commitlint/config-conventional@21.2.3");
    }
  });

  it("normalizePackageJson keeps Git hooks versions exact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "raulmoracode-pkgmeta-"));
    try {
      const pkg: PackageJson = {
        name: "my-project",
        scripts: { prepare: "husky" },
        devDependencies: {
          husky: "^9.1.7",
          "@commitlint/cli": "~21.2.3",
          "@commitlint/config-conventional": "^21.2.3",
        },
      };
      await writeFile(join(dir, "package.json"), JSON.stringify(pkg), "utf8");
      await normalizePackageJson(dir);
      const normalized = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8"),
      ) as PackageJson;
      expect(normalized.scripts?.prepare).toBe("husky");
      expect(normalized.devDependencies?.husky).toBe("9.1.7");
      expect(normalized.devDependencies?.["@commitlint/cli"]).toBe("21.2.3");
      expect(
        normalized.devDependencies?.["@commitlint/config-conventional"],
      ).toBe("21.2.3");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
