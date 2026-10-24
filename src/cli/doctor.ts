import { intro, log, outro } from "@clack/prompts";
import {
  type Diagnostic,
  type DoctorFacts,
  diagnoseProject,
} from "../doctor/checks.js";
import type { PackageJson } from "../frameworks/types.js";
import { repositoryRoot } from "../git/upgrade.js";
import { parseManifest } from "../upgrade/manifest.js";
import { MANIFEST_FILE, type ProjectManifest } from "../upgrade/types.js";
import { exec } from "../utils/exec.js";
import { joinPath, pathExists, readTextFile } from "../utils/filesystem.js";
import { VERSION } from "./args.js";

export interface DoctorOptions {
  verbose?: boolean;
}

async function versionOf(
  tool: string,
  verbose: boolean,
): Promise<string | null> {
  try {
    const result = await exec(tool, ["--version"], { verbose });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

async function readPackageJson(
  projectDir: string,
): Promise<PackageJson | null> {
  try {
    return JSON.parse(
      await readTextFile(joinPath(projectDir, "package.json")),
    ) as PackageJson;
  } catch {
    return null;
  }
}

async function readManifest(
  projectDir: string,
): Promise<{ manifest: ProjectManifest | null; error: string | null }> {
  const path = joinPath(projectDir, MANIFEST_FILE);
  if (!(await pathExists(path))) {
    return { manifest: null, error: null };
  }
  try {
    return { manifest: parseManifest(await readTextFile(path)), error: null };
  } catch (error) {
    return {
      manifest: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readManagedFiles(
  projectDir: string,
  manifest: ProjectManifest | null,
): Promise<Record<string, string | null>> {
  const files: Record<string, string | null> = {};
  if (manifest === null) {
    return files;
  }
  for (const path of Object.keys(manifest.files)) {
    try {
      files[path] = await readTextFile(
        joinPath(projectDir, ...path.split("/")),
      );
    } catch {
      files[path] = null;
    }
  }
  return files;
}

async function collectFacts(
  projectDir: string,
  verbose: boolean,
): Promise<DoctorFacts> {
  const [{ manifest, error }, packageJson, pnpmVersion, gitVersion] =
    await Promise.all([
      readManifest(projectDir),
      readPackageJson(projectDir),
      versionOf("pnpm", verbose),
      versionOf("git", verbose),
    ]);

  let insideRepository = false;
  if (gitVersion !== null) {
    try {
      await repositoryRoot(projectDir, verbose);
      insideRepository = true;
    } catch {
      insideRepository = false;
    }
  }

  return {
    nodeVersion: process.version,
    pnpmVersion,
    gitVersion,
    insideRepository,
    packageJson,
    manifest,
    manifestError: error,
    files: await readManagedFiles(projectDir, manifest),
    currentCliVersion: VERSION,
  };
}

function printDiagnostic(diagnostic: Diagnostic): void {
  const text =
    diagnostic.hint === undefined
      ? diagnostic.message
      : `${diagnostic.message}\n${diagnostic.hint}`;
  if (diagnostic.level === "ok") {
    log.success(text);
  } else if (diagnostic.level === "warning") {
    log.warn(text);
  } else {
    log.error(text);
  }
}

/**
 * Read-only diagnostics for the project in the current directory. Exits 1 when
 * at least one check reports an error, so it can gate CI; warnings do not fail.
 */
export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const verbose = options.verbose ?? false;
  intro("Raulmoracode Doctor");

  const facts = await collectFacts(process.cwd(), verbose);
  const diagnostics = diagnoseProject(facts);
  for (const diagnostic of diagnostics) {
    printDiagnostic(diagnostic);
  }

  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.level === "error",
  ).length;
  const warnings = diagnostics.filter(
    (diagnostic) => diagnostic.level === "warning",
  ).length;
  outro(
    errors > 0
      ? `${errors} error(es) y ${warnings} aviso(s).`
      : `Sin errores y ${warnings} aviso(s).`,
  );
  if (errors > 0) {
    process.exit(1);
  }
}
