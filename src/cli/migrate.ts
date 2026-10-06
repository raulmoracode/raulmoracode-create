import { intro, log, outro } from "@clack/prompts";
import {
  PROJECT_MARKER_FILE,
  parseProjectMarker,
  projectMarker,
} from "../config/project-marker.js";
import type { PackageJson } from "../frameworks/types.js";
import { MIGRATIONS } from "../migrations/index.js";
import type {
  MigrationOutcome,
  ProjectFacts,
  ProjectFrameworkId,
} from "../migrations/types.js";
import { exec } from "../utils/exec.js";
import {
  joinPath,
  pathExists,
  readJsonFile,
  readTextFile,
  resolvePath,
  writeTextFile,
} from "../utils/filesystem.js";
import { VERSION } from "./args.js";

export interface MigrateOptions {
  cwd: string;
  dryRun: boolean;
  verbose: boolean;
}

export class MigrationError extends Error {}

const NEXT_LAYOUT = joinPath("src", "app", "layout.tsx");
const VITE_CONFIG = "vite.config.ts";
const VITE_INDEX = "index.html";
const FORMATABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".jsonc"];

async function detectFramework(
  root: string,
): Promise<ProjectFrameworkId | null> {
  if (await pathExists(joinPath(root, NEXT_LAYOUT))) {
    return "next";
  }
  if (
    (await pathExists(joinPath(root, VITE_INDEX))) &&
    (await pathExists(joinPath(root, VITE_CONFIG)))
  ) {
    return "vite";
  }
  return null;
}

async function readMarker(root: string): Promise<ProjectFacts["marker"]> {
  try {
    const raw = await readTextFile(joinPath(root, PROJECT_MARKER_FILE));
    return parseProjectMarker(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isFormatable(file: string): boolean {
  return FORMATABLE_EXTENSIONS.some((extension) => file.endsWith(extension));
}

async function formatTouchedFiles(
  root: string,
  files: string[],
  verbose: boolean,
): Promise<void> {
  const targets = files.filter(isFormatable);
  if (targets.length === 0) {
    return;
  }
  try {
    await exec("pnpm", ["exec", "biome", "check", "--write", ...targets], {
      cwd: root,
      verbose,
    });
  } catch {
    log.warn(
      "No se pudo ejecutar Biome sobre los archivos modificados: revísalos con `pnpm check`.",
    );
  }
}

function report(outcome: MigrationOutcome): void {
  const target = outcome.target ?? "(sin archivo)";
  if (outcome.status === "applied") {
    log.success(`${outcome.id} → ${target}`);
    return;
  }
  if (outcome.status === "pending") {
    log.info(`${outcome.id} → ${target} (se aplicaría)`);
    return;
  }
  if (outcome.status === "skipped") {
    log.step(`${outcome.id} → ${target}: ${outcome.message ?? "sin cambios"}`);
    return;
  }
  log.error(`${outcome.id} → ${target}: ${outcome.message ?? "fallo"}`);
  for (const line of outcome.manual ?? []) {
    log.message(`    ${line}`);
  }
}

/**
 * Applies the template migrations an existing project is missing. It never
 * prompts and never commits: it only reports and writes the minimum.
 */
export async function migrate(options: MigrateOptions): Promise<number> {
  const root = resolvePath(options.cwd);
  let packageJson: PackageJson;
  try {
    packageJson = await readJsonFile<PackageJson>(
      joinPath(root, "package.json"),
    );
  } catch {
    throw new MigrationError(
      `No se encontró package.json en ${root}: ejecuta migrate dentro de un proyecto.`,
    );
  }
  const marker = await readMarker(root);
  const project: ProjectFacts = {
    root,
    framework: await detectFramework(root),
    projectName:
      typeof packageJson.name === "string" ? packageJson.name : "el proyecto",
    packageJson,
    marker,
    hasBiome: await pathExists(joinPath(root, "node_modules", ".bin", "biome")),
  };

  const frameworkLabel =
    project.framework === "next"
      ? "Next.js"
      : project.framework === "vite"
        ? "React + Vite"
        : "framework no reconocido";
  intro(`Migrate ${project.projectName} (${frameworkLabel})`);
  if (marker === null) {
    log.warn(
      `No se encontró ${PROJECT_MARKER_FILE}: se asume un proyecto anterior al marcador y se aplican todas las migraciones.`,
    );
  } else if (marker.createdBy === "unknown") {
    log.step(
      `Proyecto creado por una versión desconocida (${marker.migratedBy ?? "sin registrar"}).`,
    );
  }

  const outcomes: MigrationOutcome[] = [];
  const applied = new Set(marker?.migrations ?? []);
  const touched: string[] = [];
  for (const migration of MIGRATIONS) {
    if (project.framework === null) {
      outcomes.push({
        id: migration.id,
        status: "skipped",
        target: null,
        message: "No se reconoció el framework del proyecto.",
      });
      continue;
    }
    let alreadyApplied = false;
    try {
      alreadyApplied = await migration.isApplied(project);
    } catch {
      outcomes.push({
        id: migration.id,
        status: "skipped",
        target: migration.target(project),
        message: "No se pudo leer el archivo que esta migración necesita.",
      });
      continue;
    }
    if (alreadyApplied) {
      applied.add(migration.id);
      outcomes.push({
        id: migration.id,
        status: "skipped",
        target: migration.target(project),
        message: "ya estaba aplicado.",
      });
      continue;
    }
    if (options.dryRun) {
      outcomes.push({
        id: migration.id,
        status: "pending",
        target: migration.target(project),
      });
      continue;
    }
    let outcome: MigrationOutcome;
    try {
      outcome = await migration.apply(project);
    } catch (error) {
      outcome = {
        id: migration.id,
        status: "failed",
        target: migration.target(project),
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (outcome.status === "applied") {
      applied.add(migration.id);
      if (outcome.target) {
        touched.push(outcome.target);
      }
    }
    outcomes.push(outcome);
  }

  for (const outcome of outcomes) {
    report(outcome);
  }

  const hasProblems = outcomes.some(
    (outcome) => outcome.status === "conflict" || outcome.status === "failed",
  );

  if (!options.dryRun) {
    await writeTextFile(
      joinPath(root, PROJECT_MARKER_FILE),
      projectMarker({
        createdBy: marker?.createdBy ?? "unknown",
        migratedBy: VERSION,
        migrations: [...applied],
      }),
    );
    if (touched.length > 0 && project.hasBiome) {
      log.step("Formateando con Biome");
      await formatTouchedFiles(root, touched, options.verbose);
    }
    if (touched.length > 0) {
      log.warn(
        "Revisa los cambios con `git diff` y commitea tú: migrate nunca hace commit.",
      );
    }
  }

  const appliedCount = outcomes.filter((o) => o.status === "applied").length;
  const pendingCount = outcomes.filter((o) => o.status === "pending").length;
  outro(
    options.dryRun
      ? `${appliedCount} aplicadas · ${pendingCount} pendientes · ${hasProblems ? "con conflictos" : "sin conflictos"} (dry-run: no se escribió nada)`
      : `${appliedCount} aplicadas · ${hasProblems ? "revisa los conflictos" : "todo en orden"} · ${PROJECT_MARKER_FILE} actualizado`,
  );
  return hasProblems ? 1 : 0;
}
