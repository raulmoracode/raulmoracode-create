import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    success: vi.fn(),
    message: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    info: vi.fn(),
  },
}));

import { VERSION } from "../src/cli/args.js";
import { MigrationError, migrate } from "../src/cli/migrate.js";
import { PROJECT_MARKER_FILE } from "../src/config/project-marker.js";
import {
  describeStack,
  hasViteSocialMeta,
  nextSocialMetaFields,
  socialMetaOptions,
  viteSocialMetaTags,
  withNextSocialMeta,
  withViteSocialMeta,
} from "../src/config/social-meta.js";
import { nextFramework } from "../src/frameworks/next.js";
import { viteFramework } from "../src/frameworks/vite.js";
import { writeProjectMarker } from "../src/generators/configure-project.js";
import { MIGRATION_IDS, MIGRATIONS } from "../src/migrations/index.js";
import { socialMetaMigration } from "../src/migrations/social-meta.js";
import { writeTextFile } from "../src/utils/filesystem.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "raulmoracode-migrate-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  execMock.mockReset();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const PACKAGE_JSON = JSON.stringify(
  {
    name: "legacy-project",
    dependencies: { react: "19.3.0", next: "16.3.6" },
    devDependencies: { typescript: "7.0.2" },
  },
  null,
  2,
);

const VITE_HTML = [
  "<!doctype html>",
  '<html lang="en">',
  "  <head>",
  '    <meta charset="UTF-8" />',
  '    <link rel="icon" type="image/x-icon" href="https://cdn.raulmoracode.com/icons/favicon.ico" />',
  "    <title>raulmoracode</title>",
  "  </head>",
  "  <body>",
  '    <div id="root"></div>',
  '    <script type="module" src="/src/main.tsx"></script>',
  "  </body>",
  "</html>",
  "",
].join("\n");

const NEXT_LAYOUT = [
  'import type { Metadata } from "next";',
  "",
  "export const metadata: Metadata = {",
  '  title: "raulmoracode",',
  "  icons: {",
  '    icon: "https://cdn.raulmoracode.com/icons/favicon.ico",',
  "  },",
  "};",
  "",
  "export default function RootLayout({",
  "  children,",
  "}: Readonly<{ children: React.ReactNode }>) {",
  "  return (",
  '    <html lang="en">',
  "      <body>{children}</body>",
  "    </html>",
  "  );",
  "}",
  "",
].join("\n");

async function makeViteProject(): Promise<string> {
  const dir = await makeTempDir();
  await writeFile(join(dir, "package.json"), PACKAGE_JSON, "utf8");
  await writeFile(join(dir, "index.html"), VITE_HTML, "utf8");
  await writeFile(join(dir, "vite.config.ts"), "export default {}\n", "utf8");
  return dir;
}

async function makeNextProject(): Promise<string> {
  const dir = await makeTempDir();
  await writeFile(join(dir, "package.json"), PACKAGE_JSON, "utf8");
  await writeFile(join(dir, "next.config.mjs"), "export default {}\n", "utf8");
  await writeTextFile(join(dir, "src", "app", "layout.tsx"), NEXT_LAYOUT);
  return dir;
}

async function readProject(dir: string, file: string): Promise<string> {
  return readFile(join(dir, file), "utf8");
}

describe("social meta templates", () => {
  it("summarises the stack from package.json", () => {
    expect(describeStack({ dependencies: { react: "19.3.0" } })).toBe(
      "React 19",
    );
    expect(
      describeStack({
        dependencies: { next: "16.3.6", react: "^19.3.0" },
        devDependencies: { typescript: "7.0.2" },
      }),
    ).toBe("React 19 + Next.js 16 + TypeScript 7");
    expect(describeStack({})).toBe("");
    expect(describeStack(null)).toBe("");
  });

  it("uses the project name as title and truncates the description", () => {
    const options = socialMetaOptions("my-project", {
      dependencies: { react: "19.3.0" },
    });
    expect(options.title).toBe("my-project");
    expect(options.description.length).toBeLessThanOrEqual(200);
    expect(options.description).toContain("React 19");
    expect(options.imageAlt).toBe("my-project — React 19");
  });

  it("escapes attribute values and keeps every tag on its own line", () => {
    const block = viteSocialMetaTags(
      socialMetaOptions('weird "name"', { dependencies: {} }),
    );
    expect(block).toContain('content="weird &quot;name&quot;"');
    expect(block.split("\n")).toHaveLength(7);
    expect(block).not.toContain("\n\n");
  });

  it("renders Next fields through JSON.stringify", () => {
    const fields = nextSocialMetaFields(
      socialMetaOptions('say "hi"', { dependencies: {} }),
    );
    expect(fields).toContain('title: "say \\"hi\\""');
    expect(fields).toContain("twitter: {");
    expect(fields).toContain("openGraph: {");
    expect(fields).toContain('card: "summary_large_image",');
  });

  it("indents the Vite block relative to the closing head tag", () => {
    const patch = withViteSocialMeta(
      VITE_HTML,
      socialMetaOptions("my-project", { dependencies: {} }),
    );
    expect(patch.kind).toBe("ready");
    if (patch.kind !== "ready") {
      return;
    }
    expect(patch.content).toContain(
      '    <meta name="twitter:card" content="summary_large_image" />',
    );
  });

  it("reports a conflict with the manual snippet when head is missing", () => {
    const patch = withViteSocialMeta(
      "<html><body>hi</body></html>",
      socialMetaOptions("my-project", { dependencies: {} }),
    );
    expect(patch.kind).toBe("conflict");
    if (patch.kind !== "conflict") {
      return;
    }
    expect(patch.message).toContain("</head>");
    expect(patch.manual.join("\n")).toContain("twitter:card");
  });

  it("reports a conflict when the Next metadata export is missing", () => {
    const patch = withNextSocialMeta(
      "export default function Layout() { return null; }",
      socialMetaOptions("my-project", { dependencies: {} }),
    );
    expect(patch.kind).toBe("conflict");
    if (patch.kind !== "conflict") {
      return;
    }
    expect(patch.message).toContain("export const metadata");
  });

  it("detects social meta already present", () => {
    const withMeta = withViteSocialMeta(
      VITE_HTML,
      socialMetaOptions("my-project", { dependencies: {} }),
    );
    expect(withMeta.kind).toBe("ready");
    if (withMeta.kind !== "ready") {
      return;
    }
    expect(hasViteSocialMeta(withMeta.content)).toBe(true);
    expect(hasViteSocialMeta(VITE_HTML)).toBe(false);
  });
});

describe("social-meta migration", () => {
  it("is registered once in the ordered migration list", () => {
    expect(MIGRATIONS.map((migration) => migration.id)).toEqual([
      "social-meta",
    ]);
    expect(MIGRATION_IDS).toEqual(["social-meta"]);
  });

  it("targets index.html on Vite and the layout on Next.js", async () => {
    expect(socialMetaMigration.target({ framework: "vite" } as never)).toBe(
      "index.html",
    );
    expect(socialMetaMigration.target({ framework: "next" } as never)).toBe(
      join("src", "app", "layout.tsx"),
    );
    expect(socialMetaMigration.target({ framework: null } as never)).toBeNull();
  });

  it("inserts the block into a legacy Vite project", async () => {
    const dir = await makeViteProject();
    expect(
      await socialMetaMigration.isApplied({
        root: dir,
        framework: "vite",
      } as never),
    ).toBe(false);
    const outcome = await socialMetaMigration.apply({
      root: dir,
      framework: "vite",
      projectName: "legacy-project",
      packageJson: JSON.parse(PACKAGE_JSON),
      marker: null,
      hasBiome: false,
    });
    expect(outcome.status).toBe("applied");
    expect(outcome.target).toBe("index.html");
    const html = await readProject(dir, "index.html");
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
    expect(html).toContain(
      '<meta name="twitter:title" content="legacy-project" />',
    );
    expect(html).toContain("React 19 + Next.js 16 + TypeScript 7");
  });

  it("inserts twitter and openGraph into a legacy Next.js project", async () => {
    const dir = await makeNextProject();
    const outcome = await socialMetaMigration.apply({
      root: dir,
      framework: "next",
      projectName: "legacy-project",
      packageJson: JSON.parse(PACKAGE_JSON),
      marker: null,
      hasBiome: false,
    });
    expect(outcome.status).toBe("applied");
    const layout = await readProject(dir, join("src", "app", "layout.tsx"));
    expect(layout).toContain("twitter: {");
    expect(layout).toContain("openGraph: {");
    expect(layout).toContain('title: "raulmoracode",');
    expect(layout.indexOf("twitter: {")).toBeLessThan(
      layout.indexOf('title: "raulmoracode",'),
    );
  });

  it("is idempotent: applying it twice leaves one single block", async () => {
    const dir = await makeViteProject();
    const project = {
      root: dir,
      framework: "vite",
      projectName: "legacy-project",
      packageJson: JSON.parse(PACKAGE_JSON),
      marker: null,
      hasBiome: false,
    } as const;
    await socialMetaMigration.apply({ ...project, framework: "vite" });
    const afterFirst = await readProject(dir, "index.html");
    await socialMetaMigration.apply({ ...project, framework: "vite" });
    const afterSecond = await readProject(dir, "index.html");
    await socialMetaMigration.apply({ ...project, framework: "vite" });
    const afterThird = await readProject(dir, "index.html");
    expect(afterSecond).toBe(afterFirst);
    expect(afterThird).toBe(afterFirst);
    expect(afterThird.match(/twitter:card/g)).toHaveLength(1);
  });

  it("reports a conflict and leaves the file untouched", async () => {
    const dir = await makeViteProject();
    await writeFile(
      join(dir, "index.html"),
      "<html><body>hi</body></html>",
      "utf8",
    );
    const outcome = await socialMetaMigration.apply({
      root: dir,
      framework: "vite",
      projectName: "legacy-project",
      packageJson: JSON.parse(PACKAGE_JSON),
      marker: null,
      hasBiome: false,
    });
    expect(outcome.status).toBe("conflict");
    expect(outcome.manual?.join("\n")).toContain("twitter:card");
    expect(await readProject(dir, "index.html")).toBe(
      "<html><body>hi</body></html>",
    );
  });

  it("skips projects whose framework cannot be detected", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "package.json"), PACKAGE_JSON, "utf8");
    const outcome = await socialMetaMigration.apply({
      root: dir,
      framework: null,
      projectName: "legacy-project",
      packageJson: JSON.parse(PACKAGE_JSON),
      marker: null,
      hasBiome: false,
    });
    expect(outcome.status).toBe("skipped");
    expect(existsSync(join(dir, PROJECT_MARKER_FILE))).toBe(false);
  });
});

describe("project marker", () => {
  it("records the CLI version and every migration for new projects", async () => {
    const dir = await makeTempDir();
    await writeProjectMarker(dir, "1.1.0");
    const marker = JSON.parse(
      await readFile(join(dir, PROJECT_MARKER_FILE), "utf8"),
    ) as { createdBy: string; migrations: string[] };
    expect(marker).toEqual({
      createdBy: "1.1.0",
      migrations: ["social-meta"],
    });
  });
});

describe("migrate command", () => {
  it("fails clearly outside a project", async () => {
    const dir = await makeTempDir();
    await expect(
      migrate({ cwd: dir, dryRun: false, verbose: false }),
    ).rejects.toBeInstanceOf(MigrationError);
  });

  it("--dry-run reports what is pending and writes nothing", async () => {
    const dir = await makeViteProject();
    const code = await migrate({ cwd: dir, dryRun: true, verbose: false });
    expect(code).toBe(0);
    expect(await readProject(dir, "index.html")).toBe(VITE_HTML);
    expect(existsSync(join(dir, PROJECT_MARKER_FILE))).toBe(false);
    expect(execMock).not.toHaveBeenCalled();
  });

  it("applies the migration and writes the marker on a legacy project", async () => {
    const dir = await makeViteProject();
    const code = await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(code).toBe(0);
    expect(await readProject(dir, "index.html")).toContain("twitter:card");
    const marker = JSON.parse(
      await readFile(join(dir, PROJECT_MARKER_FILE), "utf8"),
    ) as { createdBy: string; migratedBy: string; migrations: string[] };
    expect(marker.createdBy).toBe("unknown");
    expect(marker.migratedBy).toBe(VERSION);
    expect(marker.migrations).toEqual(["social-meta"]);
  });

  it("is a no-op on the second run", async () => {
    const dir = await makeViteProject();
    await migrate({ cwd: dir, dryRun: false, verbose: false });
    const afterFirst = await readProject(dir, "index.html");
    const code = await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(code).toBe(0);
    expect(await readProject(dir, "index.html")).toBe(afterFirst);
  });

  it("migrates a Next.js project", async () => {
    const dir = await makeNextProject();
    const code = await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(code).toBe(0);
    expect(await readProject(dir, join("src", "app", "layout.tsx"))).toContain(
      "twitter: {",
    );
  });

  it("returns exit code 1 on conflict without touching other files", async () => {
    const dir = await makeViteProject();
    await writeFile(
      join(dir, "index.html"),
      "<html><body>hi</body></html>",
      "utf8",
    );
    const code = await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(code).toBe(1);
    expect(await readProject(dir, "index.html")).toBe(
      "<html><body>hi</body></html>",
    );
    const marker = JSON.parse(
      await readFile(join(dir, PROJECT_MARKER_FILE), "utf8"),
    ) as { migrations: string[] };
    expect(marker.migrations).toEqual([]);
  });

  it("skips projects without a recognizable framework", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "package.json"), PACKAGE_JSON, "utf8");
    const code = await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(code).toBe(0);
    const marker = JSON.parse(
      await readFile(join(dir, PROJECT_MARKER_FILE), "utf8"),
    ) as { createdBy: string; migrations: string[] };
    expect(marker.createdBy).toBe("unknown");
    expect(marker.migrations).toEqual([]);
  });

  it("runs Biome over the touched files when the project has it", async () => {
    const dir = await makeNextProject();
    await writeTextFile(join(dir, "node_modules", ".bin", "biome"), "");
    await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock.mock.calls[0]?.[0]).toBe("pnpm");
    expect(execMock.mock.calls[0]?.[1]).toEqual([
      "exec",
      "biome",
      "check",
      "--write",
      join("src", "app", "layout.tsx"),
    ]);
    expect(execMock.mock.calls[0]?.[2]).toMatchObject({ cwd: dir });
  });

  it("does not run Biome when the project does not have it", async () => {
    const dir = await makeViteProject();
    await migrate({ cwd: dir, dryRun: false, verbose: false });
    expect(execMock).not.toHaveBeenCalled();
  });
});

describe("scaffold and migration share the same template", () => {
  it("configureBranding and the migration produce the same block", async () => {
    const scaffolded = await makeTempDir();
    await writeFile(
      join(scaffolded, "package.json"),
      JSON.stringify({
        name: "legacy-project",
        dependencies: { react: "19.3.0", next: "16.3.6" },
        devDependencies: { typescript: "7.0.2" },
      }),
      "utf8",
    );
    await writeFile(join(scaffolded, "index.html"), VITE_HTML, "utf8");
    await viteFramework.configureBranding(scaffolded);

    const migrated = await makeViteProject();
    await socialMetaMigration.apply({
      root: migrated,
      framework: "vite",
      projectName: "legacy-project",
      packageJson: JSON.parse(PACKAGE_JSON),
      marker: null,
      hasBiome: false,
    });

    const expected = viteSocialMetaTags(
      socialMetaOptions("legacy-project", JSON.parse(PACKAGE_JSON)),
      "    ",
    );
    expect(await readProject(scaffolded, "index.html")).toContain(expected);
    expect(await readProject(migrated, "index.html")).toContain(expected);
  });

  it("configureBranding on Next.js writes twitter and openGraph", async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "legacy-project",
        dependencies: { next: "16.3.6", react: "19.3.0" },
        devDependencies: { typescript: "7.0.2" },
      }),
      "utf8",
    );
    await writeTextFile(join(dir, "src", "app", "layout.tsx"), NEXT_LAYOUT);
    await nextFramework.configureBranding(dir);
    const layout = await readProject(dir, join("src", "app", "layout.tsx"));
    expect(layout).toContain("twitter: {");
    expect(layout).toContain("openGraph: {");
    expect(layout).toContain("</html>");
  });
});
