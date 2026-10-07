import { describe, expect, it } from "vitest";
import type { TechSelection } from "../src/config/tech.js";
import {
  ghRepoViewDefaultBranchArgs,
  parseDefaultBranch,
} from "../src/github/default-branch.js";
import {
  EXECUTABLE_MANAGED_FILES,
  managedFiles,
  managedPackageJson,
} from "../src/upgrade/managed-files.js";
import { hashContent } from "../src/upgrade/manifest.js";
import {
  isUpgradeMigration,
  migrationHandledPaths,
  selectMigrations,
} from "../src/upgrade/migrations/index.js";
import { patchManagedPackageJson } from "../src/upgrade/package-json.js";
import {
  buildUpgradePlan,
  classifyDependencies,
  classifyManagedFiles,
  type ProjectDiskState,
  planOverwrittenFiles,
  upgradeBranchName,
  upgradeOutcome,
} from "../src/upgrade/plan.js";
import { isGitHubRemote } from "../src/upgrade/preflight.js";
import {
  MANIFEST_VERSION,
  type Migration,
  type ProjectManifest,
} from "../src/upgrade/types.js";

const SELECTION: TechSelection = {
  tailwind: true,
  shadcn: false,
  theme: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: true,
  testing: true,
  husky: true,
  vscode: true,
};

function manifest(overrides: Partial<ProjectManifest> = {}): ProjectManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: "1.0.8",
    framework: "vite",
    selection: SELECTION,
    projectName: "my-app",
    githubUrl: "https://github.com/raulmoracode/my-app",
    files: {},
    dependencies: {},
    ...overrides,
  };
}

function state(files: Record<string, string | null>): ProjectDiskState {
  return {
    files,
    dependencies: { dependencies: {}, devDependencies: {} },
  };
}

function migration(
  version: string,
  id: string,
  handles: string[] = [],
): Migration {
  return {
    id,
    version,
    description: `${id} description`,
    why: `${id} why`,
    handles,
    run: async () => ({ touched: [], removed: [] }),
  };
}

describe("upgrade outcome", () => {
  it("detects equal, older and newer manifests", () => {
    expect(upgradeOutcome("1.0.7", "1.0.7")).toBe("up-to-date");
    expect(upgradeOutcome("1.0.8", "1.0.7")).toBe("cli-outdated");
    expect(upgradeOutcome("1.0.6", "1.0.7")).toBe("upgrade");
  });

  it("names the branch after the target version", () => {
    expect(upgradeBranchName("1.0.7")).toBe("chore/raulmoracode-update-1.0.7");
  });
});

describe("managed file classification", () => {
  const templates = {
    "updated.txt": "new updated",
    "overwritten.txt": "new overwritten",
    "created.txt": "brand new",
    "deleted-locally.txt": "still the same",
  };
  const manifestFiles = {
    "updated.txt": hashContent("old updated"),
    "overwritten.txt": hashContent("old overwritten"),
    "deleted-locally.txt": hashContent("still the same"),
    "dropped.txt": hashContent("dropped content"),
    "vanished.txt": hashContent("vanished content"),
  };
  const disk = state({
    "updated.txt": "old updated",
    "overwritten.txt": "my own version",
    "deleted-locally.txt": null,
    "dropped.txt": "dropped content",
    "vanished.txt": null,
  });

  it("classifies updated, overwritten, new, removed and deleted-locally", () => {
    const { files, skippedFiles, needsAttention } = classifyManagedFiles({
      manifestFiles,
      templates,
      state: disk,
      handledRemovals: new Set(["dropped.txt"]),
    });

    expect(files).toEqual([
      {
        path: "created.txt",
        status: "new",
        previousContent: null,
        nextContent: "brand new",
      },
      {
        path: "dropped.txt",
        status: "removed",
        previousContent: "dropped content",
        nextContent: null,
      },
      {
        path: "overwritten.txt",
        status: "overwritten",
        previousContent: "my own version",
        nextContent: "new overwritten",
      },
      {
        path: "updated.txt",
        status: "updated",
        previousContent: "old updated",
        nextContent: "new updated",
      },
    ]);
    expect(skippedFiles).toEqual([
      { path: "deleted-locally.txt", reason: "deleted-locally" },
      { path: "vanished.txt", reason: "deleted-locally" },
    ]);
    expect(needsAttention).toEqual([]);
  });

  it("never rewrites a managed file whose template did not change", () => {
    const { files } = classifyManagedFiles({
      manifestFiles: { "same.txt": hashContent("same") },
      templates: { "same.txt": "same" },
      state: state({ "same.txt": "same" }),
      handledRemovals: new Set(),
    });
    expect(files).toEqual([]);
  });

  it("asks for attention when no migration removes a dropped file", () => {
    const { files, needsAttention } = classifyManagedFiles({
      manifestFiles: { "dropped.txt": hashContent("dropped content") },
      templates: {},
      state: state({ "dropped.txt": "dropped content" }),
      handledRemovals: new Set(),
    });
    expect(files).toEqual([]);
    expect(needsAttention).toEqual(["dropped.txt"]);
  });

  it("recreates a managed file the user deleted when the template changed", () => {
    const { files, skippedFiles } = classifyManagedFiles({
      manifestFiles: { "gone.txt": hashContent("old") },
      templates: { "gone.txt": "new" },
      state: state({ "gone.txt": null }),
      handledRemovals: new Set(),
    });
    expect(files).toEqual([
      {
        path: "gone.txt",
        status: "new",
        previousContent: null,
        nextContent: "new",
      },
    ]);
    expect(skippedFiles).toEqual([]);
  });

  it("takes over a managed path the manifest never recorded", () => {
    const { files } = classifyManagedFiles({
      manifestFiles: {},
      templates: { "tooling.json": "generated" },
      state: state({ "tooling.json": "hand written" }),
      handledRemovals: new Set(),
    });
    expect(files).toEqual([
      {
        path: "tooling.json",
        status: "overwritten",
        previousContent: "hand written",
        nextContent: "generated",
      },
    ]);
  });
});

describe("dependency classification", () => {
  const managedPins = {
    dependencies: { react: "19.2.0", vite: "8.4.0" },
    devDependencies: { husky: "9.1.7" },
  };

  it("bumps a pin the user never touched", () => {
    const { dependencies, keptDependencies } = classifyDependencies({
      manifestPins: { react: "19.1.0", vite: "8.3.1", husky: "9.1.7" },
      managedPins,
      state: {
        files: {},
        dependencies: {
          dependencies: { react: "19.1.0", vite: "8.3.1" },
          devDependencies: { husky: "9.1.7" },
        },
      },
    });
    expect(dependencies).toEqual([
      {
        name: "react",
        type: "dependencies",
        from: "19.1.0",
        to: "19.2.0",
        hadLocalVersion: false,
      },
      {
        name: "vite",
        type: "dependencies",
        from: "8.3.1",
        to: "8.4.0",
        hadLocalVersion: false,
      },
    ]);
    expect(keptDependencies).toEqual([]);
  });

  it("bumps a locally changed pin anyway and flags it", () => {
    const { dependencies } = classifyDependencies({
      manifestPins: { vite: "8.3.1" },
      managedPins: { dependencies: { vite: "8.4.0" }, devDependencies: {} },
      state: {
        files: {},
        dependencies: {
          dependencies: { vite: "^8.0.0" },
          devDependencies: {},
        },
      },
    });
    expect(dependencies).toEqual([
      {
        name: "vite",
        type: "dependencies",
        from: "^8.0.0",
        to: "8.4.0",
        hadLocalVersion: true,
      },
    ]);
  });

  it("adds a pin the project does not have yet without a local flag", () => {
    const { dependencies } = classifyDependencies({
      manifestPins: {},
      managedPins,
      state: {
        files: {},
        dependencies: { dependencies: {}, devDependencies: {} },
      },
    });
    expect(dependencies.map((change) => change.name)).toEqual([
      "react",
      "vite",
      "husky",
    ]);
    expect(dependencies.every((change) => change.hadLocalVersion)).toBe(false);
    expect(dependencies[0]?.from).toBeNull();
  });

  it("keeps a pin the CLI no longer owns and reports it", () => {
    const { keptDependencies } = classifyDependencies({
      manifestPins: { postcss: "8.5.6", vite: "8.3.1" },
      managedPins,
      state: {
        files: {},
        dependencies: {
          dependencies: { postcss: "8.5.6", vite: "8.3.1" },
          devDependencies: {},
        },
      },
    });
    expect(keptDependencies).toEqual([
      { name: "postcss", pinned: "8.5.6", reason: "removed-locally" },
    ]);
  });

  it("leaves an already matching pin alone", () => {
    const { dependencies } = classifyDependencies({
      manifestPins: { husky: "9.1.7" },
      managedPins: { dependencies: {}, devDependencies: { husky: "9.1.7" } },
      state: {
        files: {},
        dependencies: {
          dependencies: {},
          devDependencies: { husky: "9.1.7" },
        },
      },
    });
    expect(dependencies).toEqual([]);
  });
});

describe("migrations", () => {
  it("keeps the registry empty until a version needs one", () => {
    expect(selectMigrations("1.0.8", "1.0.7")).toEqual([]);
  });

  it("selects the migrations in (from, to] ascending", () => {
    const registry = [
      migration("1.0.11", "third"),
      migration("1.0.9", "first"),
      migration("1.0.8", "baseline"),
      migration("1.0.10", "second"),
      migration("1.2.0", "future"),
    ];
    expect(
      selectMigrations("1.0.8", "1.0.11", registry).map((entry) => entry.id),
    ).toEqual(["first", "second", "third"]);
  });

  it("collects the paths the selected migrations delete", () => {
    const registry = [
      migration("1.0.9", "first", ["a.txt"]),
      migration("1.0.10", "second", ["b.txt", "a.txt"]),
    ];
    expect(
      [
        ...migrationHandledPaths(selectMigrations("1.0.8", "1.0.10", registry)),
      ].sort(),
    ).toEqual(["a.txt", "b.txt"]);
    expect(isUpgradeMigration(registry[0] as Migration)).toBe(true);
    expect(
      isUpgradeMigration({ ...(registry[0] as Migration), handles: undefined }),
    ).toBe(false);
  });
});

describe("buildUpgradePlan", () => {
  const templates = managedFiles("vite", SELECTION);
  const realManifest = manifest({
    files: Object.fromEntries(
      Object.entries(templates).map(([path, content]) => [
        path,
        hashContent(content),
      ]),
    ),
  });

  it("finds no work when the project matches the CLI templates", () => {
    const plan = buildUpgradePlan({
      manifest: realManifest,
      toVersion: "1.0.9",
      state: {
        files: { ...templates },
        dependencies: { dependencies: {}, devDependencies: {} },
      },
      templates,
      notes: [],
      migrations: [],
    });
    expect(plan.files).toEqual([]);
    expect(plan.branch).toBe("chore/raulmoracode-update-1.0.9");
    expect(plan.fromVersion).toBe("1.0.8");
    expect(planOverwrittenFiles(plan)).toEqual([]);
  });

  it("separates an updated file from an overwritten one", () => {
    const stateCopy: ProjectDiskState = {
      files: { ...templates, "AGENTS.md": "mine" },
      dependencies: { dependencies: {}, devDependencies: {} },
    };
    const plan = buildUpgradePlan({
      manifest: realManifest,
      toVersion: "1.0.9",
      state: stateCopy,
      templates: { ...templates, ".nvmrc": "25\n", "AGENTS.md": "brand new" },
      notes: [],
      migrations: [],
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      ".nvmrc",
      "AGENTS.md",
    ]);
    expect(plan.files.map((file) => file.status)).toEqual([
      "updated",
      "overwritten",
    ]);
    expect(planOverwrittenFiles(plan)).toEqual(["AGENTS.md"]);
  });
});

describe("package.json patch", () => {
  it("keeps user fields, pins exact versions and merges managed scripts", () => {
    const managed = managedPackageJson("vite", SELECTION);
    const patched = patchManagedPackageJson(
      {
        name: "my-app",
        customField: "kept",
        dependencies: { react: "^19.1.0", mine: "1.0.0" },
        devDependencies: { vite: "^8.3.1" },
        scripts: { custom: "echo hi" },
      },
      managed,
      [
        {
          name: "vite",
          type: "devDependencies",
          from: "^8.3.1",
          to: "8.4.0",
          hadLocalVersion: true,
        },
      ],
    );
    expect(patched.customField).toBe("kept");
    expect(patched.packageManager).toBe(managed.packageManager);
    expect(patched.engines).toEqual({ node: ">=24" });
    expect(patched.dependencies).toEqual({ react: "^19.1.0", mine: "1.0.0" });
    expect(patched.devDependencies?.vite).toBe("8.4.0");
    expect(patched.scripts?.custom).toBe("echo hi");
    expect(patched.scripts?.prepare).toBe("husky");
    expect(EXECUTABLE_MANAGED_FILES).toContain(".husky/pre-commit");
  });
});

describe("preflight helpers", () => {
  it("accepts only GitHub remotes", () => {
    expect(isGitHubRemote("https://github.com/raulmoracode/my-app.git")).toBe(
      true,
    );
    expect(isGitHubRemote("git@github.com:raulmoracode/my-app.git")).toBe(true);
    expect(isGitHubRemote("ssh://git@github.com/raulmoracode/my-app.git")).toBe(
      true,
    );
    expect(isGitHubRemote("https://gitlab.com/raulmoracode/my-app.git")).toBe(
      false,
    );
    expect(isGitHubRemote("")).toBe(false);
    expect(isGitHubRemote("not a url")).toBe(false);
  });

  it("reads the default branch out of the gh payload", () => {
    expect(ghRepoViewDefaultBranchArgs()).toEqual([
      "repo",
      "view",
      "--json",
      "defaultBranchRef",
    ]);
    expect(parseDefaultBranch('{"defaultBranchRef":{"name":"trunk"}}')).toBe(
      "trunk",
    );
    expect(parseDefaultBranch("{}")).toBeNull();
    expect(parseDefaultBranch("boom")).toBeNull();
  });
});
