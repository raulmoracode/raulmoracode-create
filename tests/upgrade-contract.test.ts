import { describe, expect, it } from "vitest";
import { agentsMd } from "../src/config/agents.js";
import { biomeConfig } from "../src/config/biome.js";
import { componentsJson } from "../src/config/components.js";
import { huskyPreCommit } from "../src/config/husky.js";
import { pullRequestTemplate } from "../src/config/pull-request.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../src/config/tech.js";
import { getFramework } from "../src/frameworks/index.js";
import {
  devDependencies,
  pinnedPackages,
  runtimeDependencies,
} from "../src/generators/configure-project.js";
import {
  EXECUTABLE_MANAGED_FILES,
  managedDependencyPins,
  managedFiles,
  managedPackageJson,
} from "../src/upgrade/managed-files.js";
import {
  hashContent,
  parseManifest,
  serializeManifest,
} from "../src/upgrade/manifest.js";
import { notesBetween } from "../src/upgrade/notes.js";
import {
  MANIFEST_FILE,
  MANIFEST_VERSION,
  type ProjectManifest,
} from "../src/upgrade/types.js";
import {
  compareVersions,
  isVersionInRange,
  parseVersion,
} from "../src/upgrade/version.js";

const NONE: TechSelection = {
  tailwind: false,
  shadcn: false,
  theme: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: false,
  testing: false,
  husky: false,
  vscode: false,
};

function manifest(overrides: Partial<ProjectManifest> = {}): ProjectManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: "1.0.8",
    framework: "vite",
    selection: FULL_TECH_SELECTION,
    projectName: "my-app",
    githubUrl: "https://github.com/raulmoracode/my-app",
    files: { "biome.json": hashContent("x"), ".nvmrc": hashContent("24\n") },
    dependencies: { vite: "8.3.1", husky: "9.1.7" },
    ...overrides,
  };
}

describe("versions", () => {
  it("parses and compares X.Y.Z", () => {
    expect(parseVersion("1.0.8")).toEqual([1, 0, 8]);
    expect(() => parseVersion("1.0")).toThrow();
    expect(compareVersions("1.0.8", "1.0.10")).toBe(-1);
    expect(compareVersions("1.1.0", "1.0.10")).toBe(1);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
  });

  it("checks the (from, to] range", () => {
    expect(isVersionInRange("1.0.9", "1.0.8", "1.0.10")).toBe(true);
    expect(isVersionInRange("1.0.8", "1.0.8", "1.0.10")).toBe(false);
    expect(isVersionInRange("1.0.10", "1.0.8", "1.0.10")).toBe(true);
    expect(isVersionInRange("1.0.11", "1.0.8", "1.0.10")).toBe(false);
  });

  it("selects and sorts upgrade notes between two versions", () => {
    const notes = [
      { version: "1.0.10", summary: "c", changes: [] },
      { version: "1.0.8", summary: "a", changes: [] },
      { version: "1.0.9", summary: "b", changes: [] },
    ];
    expect(
      notesBetween("1.0.8", "1.0.10", notes).map((entry) => entry.version),
    ).toEqual(["1.0.9", "1.0.10"]);
  });
});

describe("manifest", () => {
  it("is named raulmoracode.json (visible, no leading dot)", () => {
    expect(MANIFEST_FILE).toBe("raulmoracode.json");
  });

  it("round-trips through serialize/parse with sorted maps", () => {
    const original = manifest({
      files: { "b.txt": "2", "a.txt": "1" },
    });
    const raw = serializeManifest(original);
    expect(raw.endsWith("}\n")).toBe(true);
    expect(raw.indexOf('"a.txt"')).toBeLessThan(raw.indexOf('"b.txt"'));
    expect(parseManifest(raw)).toEqual(original);
  });

  it("hashes content with sha256", () => {
    expect(hashContent("24\n")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashContent("a")).not.toBe(hashContent("b"));
  });

  it("rejects invalid manifests with a Spanish message", () => {
    expect(() => parseManifest("nope")).toThrow(
      /raulmoracode.json no es válido/,
    );
    expect(() =>
      parseManifest(JSON.stringify({ ...manifest(), manifestVersion: 2 })),
    ).toThrow(/manifestVersion/);
    expect(() =>
      parseManifest(JSON.stringify({ ...manifest(), framework: "astro" })),
    ).toThrow(/framework/);
    expect(() =>
      parseManifest(
        JSON.stringify({
          ...manifest(),
          selection: { ...FULL_TECH_SELECTION, biome: "yes" },
        }),
      ),
    ).toThrow(/selection.biome/);
    expect(() =>
      parseManifest(JSON.stringify({ ...manifest(), cliVersion: "latest" })),
    ).toThrow(/cliVersion/);
  });
});

describe("managed files", () => {
  it("renders the exact templates the generators write", () => {
    const files = managedFiles("vite", FULL_TECH_SELECTION);
    expect(files["biome.json"]).toBe(biomeConfig());
    expect(files["AGENTS.md"]).toBe(agentsMd());
    expect(files[".github/pull_request_template.md"]).toBe(
      pullRequestTemplate(),
    );
    expect(files[".husky/pre-commit"]).toBe(
      huskyPreCommit(FULL_TECH_SELECTION),
    );
    expect(files["components.json"]).toBe(
      componentsJson(getFramework("vite").componentsJsonOptions()),
    );
    expect(files["vite.config.ts"]).toBeDefined();
    expect(files["postcss.config.mjs"]).toBeUndefined();
  });

  it("follows the tech selection and framework", () => {
    expect(Object.keys(managedFiles("vite", NONE)).sort()).toEqual([
      ".editorconfig",
      ".github/pull_request_template.md",
      ".github/workflows/ci.yml",
      ".nvmrc",
      "AGENTS.md",
    ]);
    const next = managedFiles("next", FULL_TECH_SELECTION);
    expect(next["postcss.config.mjs"]).toBeDefined();
    expect(next["vite.config.ts"]).toBeUndefined();
    expect(next["components.json"]).toContain('"rsc": true');
  });

  it("never manages application code or user-owned docs", () => {
    for (const framework of ["vite", "next"] as const) {
      const paths = Object.keys(managedFiles(framework, FULL_TECH_SELECTION));
      for (const path of paths) {
        expect(path.startsWith("src/")).toBe(false);
        expect(path).not.toContain("\\");
      }
      for (const owned of [
        "README.md",
        "CHANGELOG.md",
        "LICENSE",
        "package.json",
        "pnpm-workspace.yaml",
        MANIFEST_FILE,
      ]) {
        expect(paths).not.toContain(owned);
      }
    }
    expect(EXECUTABLE_MANAGED_FILES).toEqual([
      ".husky/pre-commit",
      ".husky/commit-msg",
    ]);
  });

  it("exposes the package.json fields and pins the CLI owns", () => {
    for (const id of ["vite", "next"] as const) {
      const framework = getFramework(id);
      const pkg = managedPackageJson(id, FULL_TECH_SELECTION);
      expect(pkg.packageManager).toMatch(/^pnpm@12\./);
      expect(pkg.engines).toEqual({ node: ">=24" });
      expect(pkg.scripts.prepare).toBe("husky");
      expect(pkg.dependencies.dependencies).toEqual({
        ...framework.pinnedDependencies(),
        ...runtimeDependencies(FULL_TECH_SELECTION),
      });
      expect(pkg.dependencies.devDependencies).toEqual({
        ...framework.pinnedDevDependencies(),
        ...devDependencies(framework, FULL_TECH_SELECTION),
      });
      const pins = managedDependencyPins(id, FULL_TECH_SELECTION);
      expect(
        Object.entries(pins)
          .map(([name, version]) => `${name}@${version}`)
          .sort(),
      ).toEqual([...pinnedPackages(framework, FULL_TECH_SELECTION)].sort());
    }
    const minimal = managedPackageJson("vite", NONE);
    expect(minimal.scripts.check).toBeUndefined();
    expect(minimal.scripts.prepare).toBeUndefined();
  });
});
