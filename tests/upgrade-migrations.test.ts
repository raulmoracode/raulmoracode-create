import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureVscodeSettingsTracked,
  mergeGitignoreEntries,
  REQUIRED_GITIGNORE_ENTRIES,
  VSCODE_EDITOR_EXCLUSION,
  VSCODE_SETTINGS_EXCEPTION,
} from "../src/config/gitignore.js";
import { readmeMd } from "../src/config/readme.js";
import {
  SITE_CONFIG_PATH,
  siteConfigTs,
  siteValues,
} from "../src/config/site.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../src/config/tech.js";
import {
  augmentGitignore,
  requiredGitignoreEntries,
} from "../src/generators/configure-node.js";
import {
  GITIGNORE_PATH,
  migrateGitignore,
} from "../src/upgrade/migrations/gitignore.js";
import {
  MIGRATIONS,
  migrationHandledPaths,
  selectMigrations,
} from "../src/upgrade/migrations/index.js";
import {
  currentReadmeStructure,
  migrateReadmeStructure,
  README_PATH,
  readmeStructureOptions,
  replaceReadmeStructure,
} from "../src/upgrade/migrations/readme.js";
import {
  mergeSiteConfigFields,
  migrateSiteConfig,
  siteConfigTemplateFields,
} from "../src/upgrade/migrations/site-config.js";
import { migrateVscodeSettingsTracked } from "../src/upgrade/migrations/vscode-settings.js";
import {
  MANIFEST_VERSION,
  type MigrationContext,
  type ProjectManifest,
} from "../src/upgrade/types.js";

const SELECTION: TechSelection = FULL_TECH_SELECTION;

const OLD_SITE_TS = `/**
 * Single source of truth for the identity of this site.
 */

export const site = {
  name: "my-app",
  title: "Mi aplicación",
  description: "Un texto propio",
  url: "",
  favicon: "/favicon.svg",
} as const;
`;

/** A `site` object the user reshaped: a spread, so no field can be trusted. */
const SPREAD_SITE_TS = `import { defaults } from "./defaults";

export const site = {
  ...defaults,
  name: "my-app",
} as const;
`;

/** What the CLI renders today for a project called `my-app`. */
const CURRENT_SITE_TS = siteConfigTs(
  siteValues({ projectName: "my-app", packageJson: {} }),
);

const UNTYPED_SITE_TS = `export const site = {
  name: "my-app",
  title: "Mi aplicación",
};
`;

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "raulmoracode-migrations-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

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

function context(
  projectDir: string,
  overrides: Partial<ProjectManifest> = {},
): MigrationContext {
  return { projectDir, manifest: manifest(overrides), verbose: false };
}

async function writeProject(
  projectDir: string,
  path: string,
  content: string,
): Promise<void> {
  await mkdir(join(projectDir, ...path.split("/").slice(0, -1)), {
    recursive: true,
  });
  await writeFile(join(projectDir, path), content, "utf8");
}

async function readProject(projectDir: string, path: string): Promise<string> {
  return readFile(join(projectDir, path), "utf8");
}

async function projectFileExists(
  projectDir: string,
  path: string,
): Promise<boolean> {
  try {
    await readFile(join(projectDir, path), "utf8");
    return true;
  } catch {
    return false;
  }
}

describe("migration registry", () => {
it("registers every write-once migration at the version it ships in", () => {
    expect(
      MIGRATIONS.map((migration) => [migration.id, migration.version]),
    ).toEqual([
      ["gitignore-required-entries", "1.1.0"],
      ["site-config-missing-fields", "1.0.9"],
      ["readme-project-structure", "1.0.9"],
      ["vscode-settings-tracked", "1.1.0"],
    ]);
    for (const migration of MIGRATIONS) {
      expect(migration.description.trim(), migration.id).not.toBe("");
      expect(migration.why.trim(), migration.id).not.toBe("");
    }
  });

it("selects the migrations when the project crosses their version", () => {
    // The gitignore and vscode-settings migrations ship in 1.1.0; a project
    // crossing 1.0.9 only fires the two 1.0.9 migrations.
    expect(selectMigrations("1.0.8", "1.0.9").map((entry) => entry.id)).toEqual(
      ["site-config-missing-fields", "readme-project-structure"],
    );
  });

  it("selects every registered migration when the project crosses 1.1.0", () => {
    expect(selectMigrations("1.0.6", "1.1.0").map((entry) => entry.id)).toEqual(
      [
        "site-config-missing-fields",
        "readme-project-structure",
        "gitignore-required-entries",
        "vscode-settings-tracked",
      ],
    );
    // The vscode-settings-tracked migration stays dormant below 1.1.0, so the
    // current CLI (1.0.9) never re-touches a .gitignore that already ignores
    // `.vscode/settings.json`.
    expect(selectMigrations("1.0.9", "1.1.0").map((entry) => entry.id)).toEqual(
      ["vscode-settings-tracked"],
    );
  });

  it("stays dormant below 1.0.9, so the current CLI changes nothing", () => {
    expect(selectMigrations("1.0.8", "1.0.8")).toEqual([]);
    expect(selectMigrations("1.0.8", "1.0.9").length).toBe(2);
    expect(selectMigrations("1.0.9", "1.0.9")).toEqual([]);
  });

  it("declares no removal, so the upgrade never deletes a patched file", () => {
    for (const migration of MIGRATIONS) {
      expect(migration.handles, migration.id).toEqual([]);
    }
    expect([
      ...migrationHandledPaths(selectMigrations("1.0.8", "1.0.9")),
    ]).toEqual([]);
  });
});

describe(".gitignore migration", () => {
  it("adds only the missing entries and keeps the user's ones", async () => {
    const projectDir = join(workDir, "gitignore-add");
    await writeProject(
      projectDir,
      GITIGNORE_PATH,
      "# mis reglas\nmi-cache\nnode_modules\ndist\n",
    );

    const result = await migrateGitignore.run(context(projectDir));

    expect(result).toEqual({ touched: [GITIGNORE_PATH], removed: [] });
    const content = await readProject(projectDir, GITIGNORE_PATH);
    expect(content).toBe(
      "# mis reglas\nmi-cache\nnode_modules\ndist\n.env\n.env.*\n# Keep .env.example trackable (negates .env.*)\n!.env.example\n.next\ncoverage\n",
    );
  });

  it("keeps `.env` ignored while making `.env.example` trackable", () => {
    const merged = mergeGitignoreEntries("");
    const entries = requiredGitignoreEntries();
    expect(entries).toContain(".env");
    expect(entries).toContain(".env.*");
    expect(entries).toContain("!.env.example");
    // The negation must come after `.env.*`, or git would re-ignore the file.
    expect(merged?.indexOf("!.env.example") ?? -1).toBeGreaterThan(
      merged?.indexOf(".env.*") ?? -1,
    );
    // A second merge keeps the whole block, so the negation survives.
    expect(mergeGitignoreEntries(merged ?? "")).toBeNull();
  });

  it("is idempotent: the second run writes nothing", async () => {
    const projectDir = join(workDir, "gitignore-idempotent");
    await writeProject(projectDir, GITIGNORE_PATH, "node_modules\n");
    await migrateGitignore.run(context(projectDir));
    const first = await readProject(projectDir, GITIGNORE_PATH);

    const second = await migrateGitignore.run(context(projectDir));

    expect(second).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(first);
  });

  it("writes every entry into a .gitignore the scaffold left empty", async () => {
    const projectDir = join(workDir, "gitignore-empty");
    await writeProject(projectDir, GITIGNORE_PATH, "\n");

    const result = await migrateGitignore.run(context(projectDir));

    expect(result.touched).toEqual([GITIGNORE_PATH]);
    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(
      `${requiredGitignoreEntries().join("\n")}\n`,
    );
  });

  it("does not resurrect a .gitignore the project deleted", async () => {
    const projectDir = join(workDir, "gitignore-deleted");
    await mkdir(projectDir, { recursive: true });

    const result = await migrateGitignore.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await projectFileExists(projectDir, GITIGNORE_PATH)).toBe(false);
  });

  it("leaves a .gitignore that already satisfies the list alone", async () => {
    const projectDir = join(workDir, "gitignore-complete");
    const content = `${REQUIRED_GITIGNORE_ENTRIES.join("\n")}\n`;
    await writeProject(projectDir, GITIGNORE_PATH, content);

    const result = await migrateGitignore.run(context(projectDir));

    expect(result.touched).toEqual([]);
    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(content);
  });

  it("merges exactly what project creation would have written", async () => {
    const projectDir = join(workDir, "gitignore-parity-create");
    await writeProject(
      projectDir,
      GITIGNORE_PATH,
      "node_modules\nsecret.txt\n",
    );
    await augmentGitignore(projectDir);
    const created = await readProject(projectDir, GITIGNORE_PATH);

    const upgradedDir = join(workDir, "gitignore-parity-upgrade");
    await writeProject(
      upgradedDir,
      GITIGNORE_PATH,
      "node_modules\nsecret.txt\n",
    );
    await migrateGitignore.run(context(upgradedDir));

    expect(await readProject(upgradedDir, GITIGNORE_PATH)).toBe(created);
  });

  it("exposes the same entry list the generator uses", () => {
    expect(requiredGitignoreEntries()).toEqual([...REQUIRED_GITIGNORE_ENTRIES]);
    expect(mergeGitignoreEntries("")).toBe(
      `${REQUIRED_GITIGNORE_ENTRIES.join("\n")}\n`,
    );
    expect(
      mergeGitignoreEntries(`${REQUIRED_GITIGNORE_ENTRIES.join("\n")}\n`),
    ).toBeNull();
    expect(mergeGitignoreEntries("a\nb\n", [])).toBeNull();
  });
});

describe(".vscode/settings.json migration", () => {
  /** Exactly what create-vite@9.2.1 ships: every editor file ignored but extensions.json. */
  const VITE_GITIGNORE =
    "# Logs\nlogs\n*.log\n\nnode_modules\ndist\n\n# Editor directories and files\n.vscode/*\n!.vscode/extensions.json\n.idea\n.DS_Store\n*.sw?\n";

  it("adds the exception for settings.json under the template .vscode/* exclusion", async () => {
    const projectDir = join(workDir, "vscode-tracked-add");
    await writeProject(projectDir, GITIGNORE_PATH, VITE_GITIGNORE);

    const result = await migrateVscodeSettingsTracked.run(context(projectDir));

    expect(result).toEqual({ touched: [GITIGNORE_PATH], removed: [] });
    const content = await readProject(projectDir, GITIGNORE_PATH);
    expect(content).toBe(`${VITE_GITIGNORE}${VSCODE_SETTINGS_EXCEPTION}\n`);
    // Every other line survives: the exception is appended, nothing is removed.
    expect(content).toContain(".vscode/*");
    expect(content).toContain("!.vscode/extensions.json");
    expect(content).toContain("node_modules");
    expect(content).toContain("*.sw?");
  });

  it("is idempotent: the second run writes nothing", async () => {
    const projectDir = join(workDir, "vscode-tracked-idempotent");
    await writeProject(projectDir, GITIGNORE_PATH, VITE_GITIGNORE);
    await migrateVscodeSettingsTracked.run(context(projectDir));
    const first = await readProject(projectDir, GITIGNORE_PATH);

    const second = await migrateVscodeSettingsTracked.run(context(projectDir));

    expect(second).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(first);
  });

  it("leaves a .gitignore without the .vscode/* exclusion alone", async () => {
    // create-next-app's template never ignores `.vscode`, so settings.json is
    // already trackable and the migration must not add any noise.
    const projectDir = join(workDir, "vscode-tracked-next");
    const nextGitignore =
      "# deps\n/node_modules\n\n# next.js\n/.next/\n/out/\n";
    await writeProject(projectDir, GITIGNORE_PATH, nextGitignore);

    const result = await migrateVscodeSettingsTracked.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(nextGitignore);
  });

  it("does not resurrect a .gitignore the project deleted", async () => {
    const projectDir = join(workDir, "vscode-tracked-deleted");
    await mkdir(projectDir, { recursive: true });

    const result = await migrateVscodeSettingsTracked.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await projectFileExists(projectDir, GITIGNORE_PATH)).toBe(false);
  });

  it("keeps local entries when appending the exception", async () => {
    const projectDir = join(workDir, "vscode-tracked-local");
    const content = ".vscode/*\n# mi regla\nmi-cache\n";
    await writeProject(projectDir, GITIGNORE_PATH, content);

    await migrateVscodeSettingsTracked.run(context(projectDir));

    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(
      `${content}${VSCODE_SETTINGS_EXCEPTION}\n`,
    );
  });

  it("merges exactly what project creation would have written", async () => {
    const fixture =
      "node_modules\nsecret.txt\n# Editor\n.vscode/*\n!.vscode/extensions.json\n";

    const createdDir = join(workDir, "vscode-tracked-parity-create");
    await writeProject(createdDir, GITIGNORE_PATH, fixture);
    await augmentGitignore(createdDir);
    const created = await readProject(createdDir, GITIGNORE_PATH);

    // The upgrade replays creation in two migrations: the required entries
    // (migrateGitignore) and the .vscode/settings.json exception.
    const upgradedDir = join(workDir, "vscode-tracked-parity-upgrade");
    await writeProject(upgradedDir, GITIGNORE_PATH, fixture);
    await migrateGitignore.run(context(upgradedDir));
    await migrateVscodeSettingsTracked.run(context(upgradedDir));

    expect(await readProject(upgradedDir, GITIGNORE_PATH)).toBe(created);
  });
});

describe("ensureVscodeSettingsTracked", () => {
  it("returns null when the exclusion is absent or the exception is present", () => {
    expect(ensureVscodeSettingsTracked("node_modules\n")).toBeNull();
    expect(
      ensureVscodeSettingsTracked(`.vscode/*\n${VSCODE_SETTINGS_EXCEPTION}\n`),
    ).toBeNull();
    expect(ensureVscodeSettingsTracked("")).toBeNull();
  });

  it("appends the exception to an empty-ish file that still excludes .vscode", () => {
    expect(ensureVscodeSettingsTracked(VSCODE_EDITOR_EXCLUSION)).toBe(
      `${VSCODE_EDITOR_EXCLUSION}\n${VSCODE_SETTINGS_EXCEPTION}\n`,
    );
  });

  it("counteracts the very exclusion create-vite ships", () => {
    const next = ensureVscodeSettingsTracked(
      `# Editor directories and files\n${VSCODE_EDITOR_EXCLUSION}\n!.vscode/extensions.json\n`,
    );
    expect(next).toContain(VSCODE_SETTINGS_EXCEPTION);
    expect(next?.indexOf(VSCODE_SETTINGS_EXCEPTION) ?? -1).toBeGreaterThan(
      next?.indexOf(VSCODE_EDITOR_EXCLUSION) ?? -1,
    );
  });
});

describe("src/config/site.ts migration", () => {
  it("adds the missing template fields and keeps every existing value", async () => {
    const projectDir = join(workDir, "site-add");
    await writeProject(projectDir, SITE_CONFIG_PATH, OLD_SITE_TS);

    const result = await migrateSiteConfig.run(context(projectDir));

    expect(result).toEqual({
      touched: [SITE_CONFIG_PATH],
      removed: [],
    });
    const content = await readProject(projectDir, SITE_CONFIG_PATH);
    const fields = siteConfigTemplateFields(manifest());
    expect(content).toBe(
      `/**
 * Single source of truth for the identity of this site.
 */

export const site = {
  name: "my-app",
  title: "Mi aplicación",
  description: "Un texto propio",
  url: "",
  favicon: "/favicon.svg",
${fields
  .filter((field) => !OLD_SITE_TS.includes(field))
  .map((field) => `  ${field}: "",`)
  .join("\n")}
} as const;
`,
    );
  });

  it("adds an empty value that is never rendered, inventing no content", async () => {
    const projectDir = join(workDir, "site-empty-values");
    await writeProject(projectDir, SITE_CONFIG_PATH, OLD_SITE_TS);

    await migrateSiteConfig.run(context(projectDir));

    const content = await readProject(projectDir, SITE_CONFIG_PATH);
    expect(content).toContain('socialImage: "",');
    expect(content).toContain('themeColor: "",');
    expect(content).not.toContain("imagen.png");
    expect(content).not.toContain("#ffffff");
  });

  it("matches the indentation the project already uses", async () => {
    const projectDir = join(workDir, "site-indent");
    await writeProject(
      projectDir,
      SITE_CONFIG_PATH,
      OLD_SITE_TS.replace(/^ {2}/gm, "    "),
    );

    await migrateSiteConfig.run(context(projectDir));

    const content = await readProject(projectDir, SITE_CONFIG_PATH);
    const lines = content.split("\n");
    expect(lines).toContain('    socialImage: "",');
    expect(lines).not.toContain('  socialImage: "",');
    expect(lines).toContain('    name: "my-app",');
  });

  it("is idempotent: the second run writes nothing", async () => {
    const projectDir = join(workDir, "site-idempotent");
    await writeProject(projectDir, SITE_CONFIG_PATH, OLD_SITE_TS);
    await migrateSiteConfig.run(context(projectDir));
    const first = await readProject(projectDir, SITE_CONFIG_PATH);

    const second = await migrateSiteConfig.run(context(projectDir));

    expect(second).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, SITE_CONFIG_PATH)).toBe(first);
  });

  it("leaves a file that already has every field alone", async () => {
    const projectDir = join(workDir, "site-complete");
    expect(siteConfigTemplateFields(manifest()).length).toBeGreaterThan(0);
    await writeProject(projectDir, SITE_CONFIG_PATH, CURRENT_SITE_TS);

    const result = await migrateSiteConfig.run(context(projectDir));

    expect(result.touched).toEqual([]);
    expect(await readProject(projectDir, SITE_CONFIG_PATH)).toBe(
      CURRENT_SITE_TS,
    );
  });

  it("does not touch a site.ts the user reshaped with a spread", async () => {
    const projectDir = join(workDir, "site-spread");
    await writeProject(projectDir, SITE_CONFIG_PATH, SPREAD_SITE_TS);

    const result = await migrateSiteConfig.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, SITE_CONFIG_PATH)).toBe(
      SPREAD_SITE_TS,
    );
  });

  it("does not touch a site.ts without the `as const` the template writes", async () => {
    const projectDir = join(workDir, "site-untyped");
    await writeProject(projectDir, SITE_CONFIG_PATH, UNTYPED_SITE_TS);

    const result = await migrateSiteConfig.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, SITE_CONFIG_PATH)).toBe(
      UNTYPED_SITE_TS,
    );
  });

  it("does not recreate a site.ts the user deleted", async () => {
    const projectDir = join(workDir, "site-deleted");
    await mkdir(join(projectDir, "src", "config"), { recursive: true });

    const result = await migrateSiteConfig.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await projectFileExists(projectDir, SITE_CONFIG_PATH)).toBe(false);
  });

  it("reports no work for content that is not a site object", () => {
    expect(mergeSiteConfigFields("export default {}", ["name"])).toBeNull();
    expect(
      mergeSiteConfigFields('export const site = {\n  name: "a",\n', ["name"]),
    ).toBeNull();
  });
});

describe("README.md structure migration", () => {
  const options = {
    projectName: "my-app",
    githubUrl: "https://github.com/raulmoracode/my-app",
    frameworkId: "vite",
    frameworkLabel: "React + Vite",
    scripts: { dev: "vite", build: "tsc && vite build" },
    versions: { react: "19.2.0", vite: "8.3.1" },
    pnpmVersion: "12.6.0",
    selection: SELECTION,
  } as const;

  /**
   * A line only the stale fixture contains: no tree `structure()` renders can
   * ever produce it, so the assertions below never depend on which entries the
   * current tree happens to list.
   */
  const STALE_MARKER = "├── stale-tree-marker";

  const STALE_STRUCTURE = [
    "## Project structure",
    "",
    "```text",
    "├── removed-file.ts",
    "│   └── gone.ts",
    STALE_MARKER,
    "└── obsolete-entry.js",
    "```",
    "",
  ];

  function readmeWithStaleStructure(): string {
    const rendered = readmeMd(options);
    const lines = rendered.split("\n");
    const start = lines.findIndex(
      (line) => line.trim() === "## Project structure",
    );
    const end = lines.findIndex(
      (line, index) => index > start && line.startsWith("## "),
    );
    return [
      ...lines.slice(0, start),
      ...STALE_STRUCTURE,
      ...lines.slice(end),
    ].join("\n");
  }

  /** The bounds of the `## Project structure` block of a rendered README. */
  function structureSection(lines: readonly string[]): {
    start: number;
    end: number;
  } {
    const start = lines.findIndex(
      (line) => line.trim() === "## Project structure",
    );
    const end = lines.findIndex(
      (line, index) => index > start && line.startsWith("## "),
    );
    return { start, end };
  }

  it("regenerates the structure section and preserves the rest", async () => {
    const projectDir = join(workDir, "readme-regenerate");
    const staleLines = readmeWithStaleStructure().split("\n");
    const stale = structureSection(staleLines);
    // The fixture has to be genuinely stale, or the test proves nothing.
    expect(staleLines.slice(stale.start, stale.end)).toContain(STALE_MARKER);
    // And the sentinel has to stay one no tree the CLI renders can produce.
    expect(readmeMd(options)).not.toContain(STALE_MARKER);
    await writeProject(projectDir, README_PATH, staleLines.join("\n"));

    const result = await migrateReadmeStructure.run(context(projectDir));

    expect(result).toEqual({ touched: [README_PATH], removed: [] });
    const lines = (await readProject(projectDir, README_PATH)).split("\n");
    const { start, end } = structureSection(lines);
    // The title and every section before and after the block survive verbatim.
    expect(lines.slice(0, start)).toEqual(staleLines.slice(0, stale.start));
    expect(lines.slice(end)).toEqual(staleLines.slice(stale.end));
    // The block becomes the tree `readmeMd()` renders today, never a frozen copy.
    const current = structureSection(readmeMd(options).split("\n"));
    expect(lines.slice(start, end)).toEqual(
      readmeMd(options).split("\n").slice(current.start, current.end),
    );
    // The sentinel the stale block planted is gone, so the block was rewritten.
    expect(lines.slice(start, end)).not.toContain(STALE_MARKER);
    expect(lines.slice(start, end).length).toBeGreaterThan(
      stale.end - stale.start,
    );
  });

  it("keeps prose the project added to the document", async () => {
    const projectDir = join(workDir, "readme-prose");
    const stale = readmeWithStaleStructure().replace(
      "## Links",
      "## Notas del equipo\n\nAquí documentamos cosas.",
    );
    await writeProject(projectDir, README_PATH, stale);

    await migrateReadmeStructure.run(context(projectDir));

    const content = await readProject(projectDir, README_PATH);
    expect(content).toContain("## Notas del equipo");
    expect(content).toContain("Aquí documentamos cosas.");
    expect(content).toContain("- [raulmoracode.com](https://raulmoracode.com)");
  });

  it("is idempotent: a fresh README is never rewritten", async () => {
    const projectDir = join(workDir, "readme-idempotent");
    const rendered = readmeMd({
      ...options,
      projectName: "my-app",
      githubUrl: "https://github.com/raulmoracode/my-app",
    });
    await writeProject(projectDir, README_PATH, rendered);

    const result = await migrateReadmeStructure.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, README_PATH)).toBe(rendered);
    expect(
      replaceReadmeStructure(rendered, currentReadmeStructure(options) ?? []),
    ).toBeNull();
  });

  it("documents the framework and selection the manifest declares", () => {
    const nextOptions = readmeStructureOptions(
      manifest({
        framework: "next",
        selection: { ...FULL_TECH_SELECTION, testing: false, vscode: false },
      }),
    );
    const next = readmeMd(nextOptions);
    const vite = readmeMd(readmeStructureOptions(manifest()));

    expect(next).toContain("This is a **Next.js** project");
    expect(vite).toContain("This is a **React + Vite** project");
    expect(currentReadmeStructure(nextOptions)?.join("\n") ?? "").not.toContain(
      "vitest.config.ts",
    );
    expect(currentReadmeStructure(nextOptions)?.join("\n") ?? "").toContain(
      "app/",
    );
    expect(vite).toContain("main.tsx");
  });

  it("does nothing when the README is absent", async () => {
    const projectDir = join(workDir, "readme-absent");
    await mkdir(projectDir, { recursive: true });

    const result = await migrateReadmeStructure.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await projectFileExists(projectDir, README_PATH)).toBe(false);
  });

  it("does nothing when the README has no structure section", async () => {
    const projectDir = join(workDir, "readme-rewritten");
    const rewritten = "# Mi proyecto\n\nNada que ver con la plantilla.\n";
    await writeProject(projectDir, README_PATH, rewritten);

    const result = await migrateReadmeStructure.run(context(projectDir));

    expect(result).toEqual({ touched: [], removed: [] });
    expect(await readProject(projectDir, README_PATH)).toBe(rewritten);
  });

  it("does nothing when the structure section is the last heading", () => {
    const document =
      "# Título\n\n## Project structure\n\n```text\n└── x\n```\n";
    expect(
      replaceReadmeStructure(document, ["## Project structure"]),
    ).toBeNull();
  });
});

describe("all migrations over one project", () => {
  const REDUCED_SELECTION: TechSelection = {
    ...FULL_TECH_SELECTION,
    testing: false,
    vscode: false,
    husky: false,
  };

  it("patch every write-once file they own, nothing else", async () => {
    const projectDir = join(workDir, "full-project");
    await writeProject(projectDir, GITIGNORE_PATH, "node_modules\ncustom\n");
    await writeProject(projectDir, SITE_CONFIG_PATH, OLD_SITE_TS);
    await writeProject(
      projectDir,
      README_PATH,
      readmeMd({
        projectName: "my-app",
        githubUrl: "https://github.com/raulmoracode/my-app",
        frameworkId: "vite",
        frameworkLabel: "React + Vite",
        scripts: { dev: "vite" },
        versions: {},
        pnpmVersion: "12.6.0",
        // The fixture README documents the full selection, the manifest the
        // reduced one: the tree is stale and has to be regenerated.
        selection: FULL_TECH_SELECTION,
      }),
    );
    await writeProject(projectDir, "package.json", '{"name":"my-app"}\n');
    await writeProject(projectDir, ".nvmrc", "24\n");

    const touched: string[] = [];
    for (const migration of selectMigrations("1.0.8", "1.1.0")) {
      const result = await migration.run(
        context(projectDir, { selection: REDUCED_SELECTION }),
      );
      touched.push(...result.touched);
    }

    expect(touched).toEqual([SITE_CONFIG_PATH, README_PATH, GITIGNORE_PATH]);
    expect(await readProject(projectDir, ".nvmrc")).toBe("24\n");
    expect(await readProject(projectDir, "package.json")).toBe(
      '{"name":"my-app"}\n',
    );
    expect(await readProject(projectDir, GITIGNORE_PATH)).toBe(
      "node_modules\ncustom\ndist\n.env\n.env.*\n# Keep .env.example trackable (negates .env.*)\n!.env.example\n.next\ncoverage\n",
    );
    expect(await readProject(projectDir, SITE_CONFIG_PATH)).toContain(
      'themeColor: "",',
    );
    expect(await readProject(projectDir, README_PATH)).toContain(
      "## Project structure",
    );
    expect(await readProject(projectDir, README_PATH)).not.toContain(
      "vitest.config.ts",
    );
    expect(await readProject(projectDir, README_PATH)).toContain("AGENTS.md");
  });
});
