import { describe, expect, it } from "vitest";
import type { TechSelection } from "../src/config/tech.js";
import type { PackageJson } from "../src/frameworks/types.js";
import {
  type AdoptionFacts,
  buildAdoptionManifest,
  inferFramework,
  inferTechSelection,
  normalizeGitHubUrl,
  PRE_MANIFEST_CLI_VERSION,
  projectNameFrom,
  RETIRED_MANAGED_PATHS,
} from "../src/upgrade/adopt.js";
import {
  managedDependencyPins,
  managedFiles,
} from "../src/upgrade/managed-files.js";
import { hashContent } from "../src/upgrade/manifest.js";
import { MANIFEST_VERSION } from "../src/upgrade/types.js";

const NO_TECH: TechSelection = {
  tailwind: false,
  shadcn: false,
  theme: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: false,
  testing: false,
  playwright: false,
  husky: false,
  vscode: false,
};

function facts(
  paths: string[] = [],
  packageJson: PackageJson = {},
): AdoptionFacts {
  return { paths, packageJson };
}

const EVERYTHING: AdoptionFacts = facts(
  [
    "components.json",
    "biome.json",
    "vitest.config.ts",
    "playwright.config.ts",
    ".husky/pre-commit",
    ".husky/commit-msg",
    ".vscode/settings.json",
    ".vscode/extensions.json",
  ],
  {
    dependencies: {
      tailwindcss: "4.3.3",
      "tw-animate-css": "1.4.0",
      "@tanstack/react-query": "5.104.0",
      zustand: "5.0.15",
      "react-hook-form": "7.66.0",
      zod: "4.2.0",
    },
    devDependencies: {
      "@biomejs/biome": "2.5.14",
      vitest: "5.0.2",
      "@playwright/test": "1.64.0",
      husky: "9.1.7",
    },
  },
);

describe("inferFramework", () => {
  it("detects Next.js and React + Vite from the dependencies", () => {
    expect(
      inferFramework(facts([], { dependencies: { next: "16.3.6" } })),
    ).toBe("next");
    expect(inferFramework(facts([], { dependencies: { vite: "8.3.1" } }))).toBe(
      "vite",
    );
  });

  it("falls back to the bundler config file", () => {
    expect(inferFramework(facts(["next.config.ts"]))).toBe("next");
    expect(inferFramework(facts(["vite.config.ts"]))).toBe("vite");
    expect(inferFramework(facts(["vite.config.mjs"]))).toBe("vite");
  });

  it("returns null when the project is ambiguous or unidentified", () => {
    expect(
      inferFramework(
        facts([], { dependencies: { next: "16.3.6", vite: "8.3.1" } }),
      ),
    ).toBeNull();
    expect(
      inferFramework(facts(["next.config.ts", "vite.config.ts"])),
    ).toBeNull();
    expect(inferFramework(facts([], { dependencies: {} }))).toBeNull();
  });
});

describe("inferTechSelection", () => {
  it("enables every tech backed by evidence on disk", () => {
    expect(inferTechSelection(EVERYTHING)).toEqual({
      tailwind: true,
      shadcn: true,
      theme: true,
      "tanstack-query": true,
      zustand: true,
      forms: true,
      biome: true,
      testing: true,
      playwright: true,
      husky: true,
      vscode: true,
    });
  });

  it("disables everything without evidence", () => {
    expect(inferTechSelection(facts())).toEqual(NO_TECH);
  });

  it("enforces the shadcn → Tailwind and theme → shadcn cascade", () => {
    const noTailwind = inferTechSelection(
      facts(["components.json"], { devDependencies: {} }),
    );
    expect(noTailwind.shadcn).toBe(false);
    expect(noTailwind.theme).toBe(false);

    const noShadcn = inferTechSelection(
      facts([], {
        dependencies: { tailwindcss: "4.3.3" },
        devDependencies: { "tw-animate-css": "1.4.0" },
      }),
    );
    expect(noShadcn.shadcn).toBe(false);
    expect(noShadcn.theme).toBe(false);
  });

  it("requires both halves of every paired signal", () => {
    const onlyDep = inferTechSelection(
      facts([], {
        dependencies: { "react-hook-form": "7.66.0" },
        devDependencies: {
          vitest: "5.0.2",
          husky: "9.1.7",
          "@biomejs/biome": "2.5.14",
        },
      }),
    );
    expect(onlyDep.forms).toBe(false);
    expect(onlyDep.testing).toBe(false);
    expect(onlyDep.husky).toBe(false);
    expect(onlyDep.biome).toBe(false);

    const onlyFiles = inferTechSelection(
      facts([
        "vitest.config.ts",
        ".husky/pre-commit",
        ".vscode/settings.json",
        "biome.json",
      ]),
    );
    expect(onlyFiles.testing).toBe(false);
    expect(onlyFiles.husky).toBe(false);
    expect(onlyFiles.vscode).toBe(false);
    expect(onlyFiles.biome).toBe(false);
  });
});

describe("buildAdoptionManifest", () => {
  const selection: TechSelection = { ...NO_TECH, biome: true, husky: true };
  const contents = {
    "biome.json": '{\n  "formatter": { "enabled": true }\n}\n',
    ".editorconfig": "root = true\n",
    ".husky/pre-commit": "pnpm check\n",
    ".github/pull_request_template.md": "# PR\n",
  };
  const packageJson: PackageJson = {
    name: "sample-site",
    dependencies: { react: "19.3.0", lodash: "4.17.21" },
    devDependencies: { "@biomejs/biome": "2.5.0", husky: "9.1.7" },
  };

  it("uses the pre-manifest sentinel and the inferred identity", () => {
    const manifest = buildAdoptionManifest({
      framework: "vite",
      selection,
      projectName: projectNameFrom(packageJson, "https://github.com/o/r"),
      githubUrl: "https://github.com/o/r",
      contents,
      packageJson,
    });
    expect(PRE_MANIFEST_CLI_VERSION).toBe("1.0.7");
    expect(manifest).toMatchObject({
      manifestVersion: MANIFEST_VERSION,
      cliVersion: "1.0.7",
      framework: "vite",
      selection,
      projectName: "sample-site",
      githubUrl: "https://github.com/o/r",
    });
  });

  it("hashes only the managed paths present on disk, plus the retired ones", () => {
    const manifest = buildAdoptionManifest({
      framework: "vite",
      selection,
      projectName: "sample-site",
      githubUrl: "https://github.com/o/r",
      contents,
      packageJson,
    });
    const managed = Object.keys(managedFiles("vite", selection));
    expect(manifest.files["biome.json"]).toBe(
      hashContent(contents["biome.json"]),
    );
    expect(manifest.files[".editorconfig"]).toBe(
      hashContent(contents[".editorconfig"]),
    );
    expect(manifest.files[".husky/pre-commit"]).toBe(
      hashContent(contents[".husky/pre-commit"]),
    );
    expect(manifest.files[RETIRED_MANAGED_PATHS[0]]).toBe(
      hashContent(contents[".github/pull_request_template.md"]),
    );
    for (const path of ["AGENTS.md", ".nvmrc"]) {
      expect(managed).toContain(path);
      expect(manifest.files[path]).toBeUndefined();
    }
  });

  it("records the installed version of each managed pin and omits absent ones", () => {
    const manifest = buildAdoptionManifest({
      framework: "vite",
      selection,
      projectName: "sample-site",
      githubUrl: "https://github.com/o/r",
      contents,
      packageJson,
    });
    const pins = managedDependencyPins("vite", selection);
    const installed = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };
    expect(manifest.dependencies).toEqual(
      Object.fromEntries(
        Object.keys(pins)
          .filter((name) => typeof installed[name] === "string")
          .map((name) => [name, installed[name]]),
      ),
    );
    expect(manifest.dependencies.lodash).toBeUndefined();
    expect(manifest.dependencies.react).toBe("19.3.0");
  });
});

describe("normalizeGitHubUrl", () => {
  it("normalizes every GitHub remote form to the web URL", () => {
    expect(normalizeGitHubUrl("https://github.com/o/r")).toBe(
      "https://github.com/o/r",
    );
    expect(normalizeGitHubUrl("https://github.com/o/r.git")).toBe(
      "https://github.com/o/r",
    );
    expect(normalizeGitHubUrl("https://github.com/o/r/")).toBe(
      "https://github.com/o/r",
    );
    expect(normalizeGitHubUrl("git@github.com:o/r.git")).toBe(
      "https://github.com/o/r",
    );
    expect(normalizeGitHubUrl("ssh://git@github.com/o/r.git")).toBe(
      "https://github.com/o/r",
    );
  });

  it("leaves a non-GitHub remote untouched", () => {
    expect(normalizeGitHubUrl(" https://gitlab.com/o/r.git ")).toBe(
      "https://gitlab.com/o/r",
    );
  });
});

describe("projectNameFrom", () => {
  it("prefers package.json and falls back to the repository slug", () => {
    expect(
      projectNameFrom({ name: "sample-site" }, "https://github.com/o/r"),
    ).toBe("sample-site");
    expect(
      projectNameFrom({ name: "  " }, "https://github.com/o/sample-site"),
    ).toBe("sample-site");
    expect(projectNameFrom({}, "https://github.com/o/sample-site")).toBe(
      "sample-site",
    );
    expect(projectNameFrom({}, "")).toBe("project");
  });
});
