import { type ReadmeOptions, readmeMd } from "../../config/readme.js";
import { getFramework } from "../../frameworks/index.js";
import {
  PNPM_VERSION,
  projectScripts,
} from "../../generators/configure-project.js";
import { managedDependencyPins } from "../managed-files.js";
import type { MigrationResult, ProjectManifest } from "../types.js";
import type { UpgradeMigration } from "./index.js";
import { patchProjectFile } from "./support.js";

export const README_PATH = "README.md";
const STRUCTURE_HEADING = "## Project structure";
const HEADING_PATTERN = /^## /;

function findStructureSection(lines: string[]): {
  start: number;
  end: number;
} | null {
  const start = lines.findIndex((line) => line.trim() === STRUCTURE_HEADING);
  if (start < 0) {
    return null;
  }
  const end = lines.findIndex(
    (line, index) => index > start && HEADING_PATTERN.test(line),
  );
  if (end < 0) {
    return null;
  }
  return { start, end };
}

/**
 * The `## Project structure` block exactly as the CLI renders it today, from
 * the heading up to (but excluding) the next `##` heading. Built from
 * `readmeMd()` so it can never drift from the file a new project gets.
 */
export function currentReadmeStructure(
  options: ReadmeOptions,
): string[] | null {
  const lines = readmeMd(options).split("\n");
  const section = findStructureSection(lines);
  if (section === null) {
    return null;
  }
  return lines.slice(section.start, section.end);
}

/** The options `readmeMd()` needs, taken from the project's own manifest. */
export function readmeStructureOptions(
  manifest: ProjectManifest,
): ReadmeOptions {
  const framework = getFramework(manifest.framework);
  return {
    projectName: manifest.projectName,
    githubUrl: manifest.githubUrl,
    frameworkId: framework.id,
    frameworkLabel: framework.label,
    scripts: projectScripts(framework, manifest.selection),
    versions: managedDependencyPins(manifest.framework, manifest.selection),
    pnpmVersion: PNPM_VERSION,
    selection: manifest.selection,
  };
}

/**
 * Replaces only the `## Project structure` block of an existing README,
 * preserving the rest of the document verbatim: a README the project rewrote
 * is a file the CLI does not own, so it is patched, never regenerated.
 * Returns `null` when the headings are missing or the section is already
 * current, so the migration is idempotent.
 */
export function replaceReadmeStructure(
  content: string,
  structure: readonly string[],
): string | null {
  const lines = content.split("\n");
  const section = findStructureSection(lines);
  if (section === null) {
    return null;
  }
  const next = [
    ...lines.slice(0, section.start),
    ...structure,
    ...lines.slice(section.end),
  ].join("\n");
  return next === content ? null : next;
}

/**
 * `README.md` is written once, when the project is scaffolded, so the file
 * tree it documents goes stale as soon as the selection changes: files the
 * CLI now generates are missing from it and files the project deleted are
 * still listed. Only that section is refreshed.
 */
export const migrateReadmeStructure: UpgradeMigration = {
  id: "readme-project-structure",
  version: "1.0.9",
  handles: [],
  description: `Regenerates the \`## Project structure\` tree of \`${README_PATH}\`, leaving every other section of the document untouched.`,
  why: "The README is not a managed file, so its project tree is never refreshed by an upgrade and stops matching the files the CLI generates (CI workflow, Husky hooks, shadcn, testing, VS Code). Regenerating only that section documents the project again without rewriting the prose the user owns.",
  async run(context): Promise<MigrationResult> {
    const structure = currentReadmeStructure(
      readmeStructureOptions(context.manifest),
    );
    if (structure === null) {
      return { touched: [], removed: [] };
    }
    const written = await patchProjectFile(
      context.projectDir,
      README_PATH,
      (content) => replaceReadmeStructure(content, structure),
    );
    return { touched: written ? [README_PATH] : [], removed: [] };
  },
};
