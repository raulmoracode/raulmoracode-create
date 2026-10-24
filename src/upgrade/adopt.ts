import type { TechSelection } from "../config/tech.js";
import type { PackageJson } from "../frameworks/types.js";
import type { Framework } from "../utils/validation.js";
import { managedDependencyPins, managedFiles } from "./managed-files.js";
import { hashContent } from "./manifest.js";
import { MANIFEST_VERSION, type ProjectManifest } from "./types.js";

/**
 * Last `raulmoracode-create` release that did not write `raulmoracode.json`
 * (the manifest shipped in 1.0.8). A pre-manifest project has no recorded CLI
 * version, so adoption uses this sentinel: the oldest migration is 1.1.0, which
 * means every pre-manifest project gets the full migration chain.
 */
export const PRE_MANIFEST_CLI_VERSION = "1.0.7";

/**
 * Managed paths a later release stopped rendering. A pre-manifest project has
 * no manifest to record them, so adoption includes the ones present on disk and
 * the removal migration can delete them instead of leaving an orphan behind.
 */
export const RETIRED_MANAGED_PATHS = [
  ".github/pull_request_template.md",
] as const;

/** Project-relative paths adoption inspects to infer the framework and stack. */
export const ADOPTION_MARKER_PATHS = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
  "components.json",
  "biome.json",
  "vitest.config.ts",
  "playwright.config.ts",
  ".husky/pre-commit",
  ".husky/commit-msg",
  ".vscode/settings.json",
  ".vscode/extensions.json",
] as const;

/** A project that cannot be adopted: the facts do not identify a framework. */
export class AdoptionError extends Error {}

export interface AdoptionFacts {
  /** Project-relative POSIX paths that exist on disk (see `ADOPTION_MARKER_PATHS`). */
  paths: readonly string[];
  packageJson: PackageJson;
}

function hasPath(facts: AdoptionFacts, path: string): boolean {
  return facts.paths.includes(path);
}

function hasDependency(facts: AdoptionFacts, name: string): boolean {
  return (
    typeof facts.packageJson.dependencies?.[name] === "string" ||
    typeof facts.packageJson.devDependencies?.[name] === "string"
  );
}

/**
 * Detects the framework from `package.json` and the builder config. Both or
 * neither signal returns `null`: adoption fails loudly instead of guessing.
 */
export function inferFramework(facts: AdoptionFacts): Framework | null {
  const next =
    hasDependency(facts, "next") ||
    facts.paths.some((path) => /^next\.config\.\w+$/.test(path));
  const vite =
    hasDependency(facts, "vite") ||
    facts.paths.some((path) => /^vite\.config\.\w+$/.test(path));
  if (next === vite) {
    return null;
  }
  return next ? "next" : "vite";
}

/**
 * Infers the tech selection from evidence on disk only. Anything without
 * evidence stays `false`, and the cascade is enforced here (shadcn needs
 * Tailwind, the theme needs shadcn) so the inferred selection can never claim a
 * managed file the project does not have.
 */
export function inferTechSelection(facts: AdoptionFacts): TechSelection {
  const tailwind = hasDependency(facts, "tailwindcss");
  const shadcn = tailwind && hasPath(facts, "components.json");
  return {
    tailwind,
    shadcn,
    theme: shadcn && hasDependency(facts, "tw-animate-css"),
    "tanstack-query": hasDependency(facts, "@tanstack/react-query"),
    zustand: hasDependency(facts, "zustand"),
    forms:
      hasDependency(facts, "react-hook-form") && hasDependency(facts, "zod"),
    biome:
      hasPath(facts, "biome.json") && hasDependency(facts, "@biomejs/biome"),
    testing:
      hasPath(facts, "vitest.config.ts") && hasDependency(facts, "vitest"),
    playwright:
      hasPath(facts, "playwright.config.ts") &&
      hasDependency(facts, "@playwright/test"),
    husky:
      hasPath(facts, ".husky/pre-commit") &&
      hasPath(facts, ".husky/commit-msg") &&
      hasDependency(facts, "husky"),
    vscode:
      hasPath(facts, ".vscode/settings.json") &&
      hasPath(facts, ".vscode/extensions.json"),
  };
}

export interface AdoptionManifestInput {
  framework: Framework;
  selection: TechSelection;
  projectName: string;
  githubUrl: string;
  /** Current content of the managed (and retired) paths that exist on disk. */
  contents: Readonly<Record<string, string>>;
  packageJson: PackageJson;
}

/**
 * Builds the manifest a pre-manifest project never received. The recorded
 * hashes are the content on disk today (there is no history to reconstruct), so
 * the first upgrade classifies those files as `updated` instead of accusing the
 * user of edits. Pins are recorded at their installed version so the plan shows
 * a clean bump, and a managed pin the project does not have is left out.
 */
export function buildAdoptionManifest(
  input: AdoptionManifestInput,
): ProjectManifest {
  const templates = Object.keys(
    managedFiles(input.framework, input.selection),
  ).sort();
  const files: Record<string, string> = {};
  for (const path of [...templates, ...RETIRED_MANAGED_PATHS]) {
    const content = input.contents[path];
    if (content !== undefined) {
      files[path] = hashContent(content);
    }
  }

  const installed = {
    ...(input.packageJson.dependencies ?? {}),
    ...(input.packageJson.devDependencies ?? {}),
  };
  const dependencies: Record<string, string> = {};
  for (const name of Object.keys(
    managedDependencyPins(input.framework, input.selection),
  ).sort()) {
    const version = installed[name];
    if (typeof version === "string") {
      dependencies[name] = version;
    }
  }

  return {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: PRE_MANIFEST_CLI_VERSION,
    framework: input.framework,
    selection: { ...input.selection },
    projectName: input.projectName,
    githubUrl: input.githubUrl,
    files,
    dependencies,
  };
}

/** `git@github.com:owner/repo.git` and `git+ssh://…` become the web URL. */
export function normalizeGitHubUrl(url: string): string {
  const trimmed = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  const scpLike = /^(?:[^@\s]+@)?github\.com[:/](.+)$/i.exec(trimmed);
  if (scpLike) {
    return `https://github.com/${(scpLike[1] ?? "").replace(/^\/+/, "")}`;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() === "github.com") {
      return `https://github.com${parsed.pathname.replace(/\.git$/i, "").replace(/\/+$/, "")}`;
    }
  } catch {
    // Not a URL: keep the trimmed remote as-is.
  }
  return trimmed;
}

/** `package.json` name, falling back to the repository slug. */
export function projectNameFrom(
  packageJson: PackageJson,
  githubUrl: string,
): string {
  const name = packageJson.name?.trim();
  if (name) {
    return name;
  }
  const segments = githubUrl.split("/").filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "project";
}
