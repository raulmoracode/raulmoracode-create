import { FULL_TECH_SELECTION, type TechSelection } from "../config/tech.js";
import type { Framework } from "../utils/validation.js";
import { managedDependencyPins, managedFiles } from "./managed-files.js";

export interface SnapshotSelection {
  id: string;
  selection: TechSelection;
}

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

const CORE: TechSelection = {
  tailwind: true,
  shadcn: false,
  theme: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: true,
  testing: true,
  husky: true,
  vscode: false,
};

/**
 * Every managed template is rendered for each of these selections: `full`
 * covers the maximal project (the preset most users pick), `none` the bare
 * scaffold (only the unconditional files) and `core` a middle ground that
 * exercises the templates whose content adapts to the rest of the selection
 * (Husky hooks without the Biome line, testing without shadcn, Tailwind without
 * shadcn). The order is part of the snapshot format.
 */
export const SNAPSHOT_SELECTIONS: SnapshotSelection[] = [
  { id: "full", selection: FULL_TECH_SELECTION },
  { id: "core", selection: CORE },
  { id: "none", selection: NONE },
];

const FRAMEWORKS: Framework[] = ["vite", "next"];

export interface TemplateSnapshotCase {
  selection: string;
  framework: Framework;
  files: Record<string, string>;
  dependencies: Record<string, string>;
}

export interface TemplateSnapshot {
  cases: TemplateSnapshotCase[];
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** Pure: renders every managed template for every snapshot selection. */
export function templateSnapshot(): TemplateSnapshot {
  const cases: TemplateSnapshotCase[] = [];
  for (const { id, selection } of SNAPSHOT_SELECTIONS) {
    for (const framework of FRAMEWORKS) {
      cases.push({
        selection: id,
        framework,
        files: sortRecord(managedFiles(framework, selection)),
        dependencies: sortRecord(managedDependencyPins(framework, selection)),
      });
    }
  }
  return { cases };
}

/** Stable serialization: two-space JSON, sorted maps, trailing newline. */
export function renderTemplateSnapshot(
  snapshot: TemplateSnapshot = templateSnapshot(),
): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Every managed path the snapshot knows about (POSIX, project relative). */
export function snapshotManagedPaths(
  snapshot: TemplateSnapshot = templateSnapshot(),
): Set<string> {
  const paths = new Set<string>();
  for (const entry of snapshot.cases) {
    for (const path of Object.keys(entry.files)) {
      paths.add(path);
    }
  }
  return paths;
}

export interface SnapshotChange {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface SnapshotDifference {
  case: string;
  files: SnapshotChange;
  dependencies: SnapshotChange;
}

function caseKey(entry: TemplateSnapshotCase): string {
  return `${entry.selection}/${entry.framework}`;
}

function diffRecord(
  stored: Record<string, string>,
  rendered: Record<string, string>,
  formatChanged: (name: string, version: string) => string,
): SnapshotChange {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [name, value] of Object.entries(rendered)) {
    const before = stored[name];
    if (before === undefined) {
      added.push(formatChanged(name, value));
    } else if (before !== value) {
      changed.push(
        before === ""
          ? formatChanged(name, value)
          : formatChanged(name, `${before} -> ${value}`),
      );
    }
  }
  for (const name of Object.keys(stored)) {
    if (rendered[name] === undefined) {
      removed.push(name);
    }
  }
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
  };
}

function isEmpty(change: SnapshotChange): boolean {
  return (
    change.added.length === 0 &&
    change.removed.length === 0 &&
    change.changed.length === 0
  );
}

/** Per case difference between the stored and the freshly rendered snapshot. */
export function diffTemplateSnapshots(
  stored: TemplateSnapshot,
  rendered: TemplateSnapshot,
): SnapshotDifference[] {
  const storedCases = new Map(
    stored.cases.map((entry) => [caseKey(entry), entry]),
  );
  const renderedCases = new Map(
    rendered.cases.map((entry) => [caseKey(entry), entry]),
  );
  const differences: SnapshotDifference[] = [];
  for (const [key, current] of renderedCases) {
    const previous = storedCases.get(key);
    const files = previous
      ? diffRecord(previous.files, current.files, (name) => name)
      : { added: Object.keys(current.files).sort(), removed: [], changed: [] };
    const dependencies = previous
      ? diffRecord(
          previous.dependencies,
          current.dependencies,
          (name, version) => `${name}@${version}`,
        )
      : {
          added: Object.keys(current.dependencies).sort(),
          removed: [],
          changed: [],
        };
    if (!previous || !isEmpty(files) || !isEmpty(dependencies)) {
      differences.push({ case: key, files, dependencies });
    }
  }
  for (const key of storedCases.keys()) {
    if (!renderedCases.has(key)) {
      differences.push({
        case: key,
        files: { added: [], removed: [], changed: [] },
        dependencies: { added: [], removed: [], changed: [] },
      });
    }
  }
  return differences;
}
