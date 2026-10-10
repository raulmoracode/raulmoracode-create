import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/cli/args.js";
import { UPGRADE_NOTES } from "../src/upgrade/notes.js";
import {
  diffTemplateSnapshots,
  renderTemplateSnapshot,
  SNAPSHOT_SELECTIONS,
  snapshotManagedPaths,
  type TemplateSnapshot,
  templateSnapshot,
} from "../src/upgrade/template-snapshot.js";

const SNAPSHOT_RELATIVE = "src/upgrade/__snapshots__/templates.json";
const SNAPSHOT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ...SNAPSHOT_RELATIVE.split("/"),
);
const UPDATE_ENV = "UPDATE_TEMPLATE_SNAPSHOT";

type Difference = ReturnType<typeof diffTemplateSnapshots>[number];

function section(
  differences: Difference[],
  pick: (difference: Difference) => {
    added: string[];
    removed: string[];
    changed: string[];
  },
): string[] {
  const lines: string[] = [];
  for (const difference of differences) {
    const change = pick(difference);
    if (
      change.added.length === 0 &&
      change.changed.length === 0 &&
      change.removed.length === 0
    ) {
      continue;
    }
    lines.push(`  case ${difference.case}`);
    if (change.added.length > 0) {
      lines.push(`    added:   ${change.added.join(", ")}`);
    }
    if (change.changed.length > 0) {
      lines.push(`    changed: ${change.changed.join(", ")}`);
    }
    if (change.removed.length > 0) {
      lines.push(`    removed: ${change.removed.join(", ")}`);
    }
  }
  return lines.length > 0 ? lines : ["  (none)"];
}

function mismatchMessage(differences: Difference[]): string {
  return [
    `Managed templates changed but ${SNAPSHOT_RELATIVE} was not updated.`,
    "",
    "Changed managed files by case (selection/framework) and path:",
    ...section(differences, (difference) => difference.files),
    "",
    "Changed dependency pins by case:",
    ...section(differences, (difference) => difference.dependencies),
    "",
    `1. Regenerate the snapshot: ${UPDATE_ENV}=1 pnpm test --run tests/upgrade-notes.test.ts`,
    `2. Add or update the UpgradeNotes entry for version ${VERSION} in src/upgrade/notes.ts,`,
    "   listing every changed file above in its changes[].files (with what and why) and",
    "   every changed pin in the what/why of that change.",
    "",
    "`raulmoracode-create upgrade` only knows about the change through UPGRADE_NOTES,",
    "so both updates are required.",
  ].join("\n");
}

describe("managed template snapshot", () => {
  it("matches the stored snapshot", async () => {
    const rendered = renderTemplateSnapshot();
    const stored = await readFile(SNAPSHOT_PATH, "utf8").catch(() => "");
    if (process.env[UPDATE_ENV] === "1") {
      await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
      await writeFile(SNAPSHOT_PATH, rendered, "utf8");
      return;
    }
    if (rendered !== stored) {
      throw new Error(
        mismatchMessage(
          diffTemplateSnapshots(
            JSON.parse(
              stored === "" ? '{"cases":[]}' : stored,
            ) as TemplateSnapshot,
            JSON.parse(rendered) as TemplateSnapshot,
          ),
        ),
      );
    }
    expect(stored.endsWith("\n")).toBe(true);
  });

  it("renders every selection and framework deterministically", () => {
    const rendered = renderTemplateSnapshot();
    expect(rendered).toBe(renderTemplateSnapshot(templateSnapshot()));
    expect(rendered).not.toContain("\r");
    expect(rendered.endsWith("\n")).toBe(true);
    const snapshot = JSON.parse(rendered) as TemplateSnapshot;
    expect(
      snapshot.cases.map((entry) => `${entry.selection}/${entry.framework}`),
    ).toEqual(
      SNAPSHOT_SELECTIONS.flatMap((entry) => [
        `${entry.id}/vite`,
        `${entry.id}/next`,
      ]),
    );
    for (const entry of snapshot.cases) {
      expect(Object.keys(entry.files)).toEqual(
        [...Object.keys(entry.files)].sort(),
      );
      expect(Object.keys(entry.dependencies)).toEqual(
        [...Object.keys(entry.dependencies)].sort(),
      );
      expect(Object.keys(entry.files).length).toBeGreaterThan(0);
      for (const [path, content] of Object.entries(entry.files)) {
        expect(path.startsWith("/")).toBe(false);
        expect(path, path).not.toContain("\\");
        expect(content, path).not.toMatch(
          /\/Users\/|\/home\/|[A-Za-z]:\\Users|\/private\/var|\/var\/folders/,
        );
        expect(content.endsWith("\n"), path).toBe(true);
      }
    }
  });
});

describe("UPGRADE_NOTES", () => {
  it("only mentions managed files the snapshot knows", () => {
    const managedPaths = snapshotManagedPaths();
    for (const note of UPGRADE_NOTES) {
      for (const change of note.changes) {
        for (const path of change.files) {
          expect(
            managedPaths.has(path),
            `${note.version} references unknown managed file "${path}"`,
          ).toBe(true);
        }
      }
    }
  });

  it("documents every note and change", () => {
    for (const note of UPGRADE_NOTES) {
      expect(note.version.trim()).not.toBe("");
      expect(note.summary.trim()).not.toBe("");
      expect(note.changes.length).toBeGreaterThan(0);
      for (const change of note.changes) {
        expect(change.files.length).toBeGreaterThan(0);
        expect(change.what.trim()).not.toBe("");
        expect(change.why.trim()).not.toBe("");
      }
    }
  });

  it("includes the 1.0.9 release notes", () => {
    const v109 = UPGRADE_NOTES.find((note) => note.version === "1.0.9");
    expect(v109).toBeDefined();
    expect(v109?.summary.trim()).not.toBe("");
    expect(v109?.changes.length).toBeGreaterThan(0);
  });
});
