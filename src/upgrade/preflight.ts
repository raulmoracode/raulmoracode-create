import {
  PNPM_VERSION,
  REQUIRED_PNPM_MAJOR,
} from "../generators/configure-project.js";
import { remoteGetUrlArgs } from "../git/remote.js";
import {
  currentBranch,
  repositoryRoot,
  workingTreeChanges,
} from "../git/upgrade.js";
import { ExecError, exec } from "../utils/exec.js";
import { joinPath, pathExists, readTextFile } from "../utils/filesystem.js";
import {
  satisfiesNodeVersion,
  satisfiesPnpmVersion,
} from "../utils/validation.js";
import { parseManifest } from "./manifest.js";
import { MANIFEST_FILE, type ProjectManifest } from "./types.js";

const MINIMUM_NODE_MAJOR = 24;

export const MINIMUM_MANIFEST_CLI_VERSION = "1.0.8";

export class UpgradePreflightError extends Error {}

/** `origin` must be a GitHub remote: https, http, ssh or scp-like syntax. */
export function isGitHubRemote(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const scpLike = /^(?:[^@\s]+@)?github\.com[:/]/i;
  if (scpLike.test(trimmed)) {
    return true;
  }
  try {
    return new URL(trimmed).hostname.toLowerCase() === "github.com";
  } catch {
    return false;
  }
}

export interface UpgradePreflightParams {
  cwd: string;
  verbose: boolean;
  requireGhAuth: () => Promise<void>;
}

export interface UpgradePreflightResult {
  projectDir: string;
  manifest: ProjectManifest;
  currentBranch: string;
}

async function requireCommand(
  command: string,
  instructions: string,
  verbose: boolean,
): Promise<string> {
  try {
    const result = await exec(command, ["--version"], { verbose });
    return result.stdout;
  } catch (error) {
    if (error instanceof ExecError && error.spawnError) {
      throw new UpgradePreflightError(
        `${command} no está instalado o no disponible en el PATH.\n${instructions}`,
      );
    }
    throw new UpgradePreflightError(
      `No se pudo ejecutar "${command} --version".`,
    );
  }
}

async function readOriginUrl(
  projectDir: string,
  verbose: boolean,
): Promise<string> {
  try {
    const result = await exec("git", remoteGetUrlArgs(), {
      cwd: projectDir,
      verbose,
    });
    return result.stdout.trim();
  } catch {
    throw new UpgradePreflightError(
      "No se encontró el remoto 'origin'.\n" +
        "El comando upgrade necesita un remoto de GitHub para abrir el pull request.",
    );
  }
}

async function requireCleanWorkingTree(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  const changes = await workingTreeChanges(projectDir, verbose);
  if (changes.length > 0) {
    throw new UpgradePreflightError(
      "El árbol de trabajo tiene cambios sin confirmar:\n" +
        `${changes.map((line) => `  ${line}`).join("\n")}\n` +
        "Confírmalos o guárdalos con 'git stash' antes de actualizar el proyecto.",
    );
  }
}

async function readManifest(projectDir: string): Promise<ProjectManifest> {
  const manifestPath = joinPath(projectDir, MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    throw new UpgradePreflightError(
      `No se encontró ${MANIFEST_FILE} en ${projectDir}.\n` +
        `Este proyecto no fue generado con raulmoracode-create ${MINIMUM_MANIFEST_CLI_VERSION} o posterior, ` +
        "así que no hay nada que actualizar de forma automática.",
    );
  }
  try {
    return parseManifest(await readTextFile(manifestPath));
  } catch (error) {
    throw new UpgradePreflightError(
      `${MANIFEST_FILE} no se pudo leer: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function upgradePreflightChecks(
  params: UpgradePreflightParams,
): Promise<UpgradePreflightResult> {
  const { cwd, verbose, requireGhAuth } = params;

  const nodeCheck = satisfiesNodeVersion(process.version, MINIMUM_NODE_MAJOR);
  if (!nodeCheck.valid) {
    throw new UpgradePreflightError(
      `${nodeCheck.error}\nInstala Node.js ${MINIMUM_NODE_MAJOR} LTS: https://nodejs.org`,
    );
  }

  const pnpmVersion = await requireCommand(
    "pnpm",
    "Instala pnpm: https://pnpm.io/installation",
    verbose,
  );
  const pnpmCheck = satisfiesPnpmVersion(pnpmVersion, REQUIRED_PNPM_MAJOR);
  if (!pnpmCheck.valid) {
    throw new UpgradePreflightError(
      `${pnpmCheck.error}\nInstala pnpm ${PNPM_VERSION}: corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate  (o: npm install -g pnpm@${PNPM_VERSION})`,
    );
  }

  await requireCommand(
    "git",
    "Instala Git: https://git-scm.com/downloads",
    verbose,
  );

  let projectDir = cwd;
  try {
    projectDir = await repositoryRoot(cwd, verbose);
  } catch {
    throw new UpgradePreflightError(
      "El directorio actual no está dentro de un repositorio Git.\n" +
        "Ejecuta raulmoracode-create upgrade desde la raíz del proyecto.",
    );
  }

  await requireCleanWorkingTree(projectDir, verbose);

  try {
    await requireGhAuth();
  } catch (error) {
    throw new UpgradePreflightError(
      "gh CLI no está instalado o no has iniciado sesión en GitHub.\n" +
        `Instálalo (https://cli.github.com) y ejecuta: gh auth login\n${
          error instanceof Error ? error.message : String(error)
        }`,
    );
  }

  const originUrl = await readOriginUrl(projectDir, verbose);
  if (!isGitHubRemote(originUrl)) {
    throw new UpgradePreflightError(
      `El remoto 'origin' no apunta a GitHub: ${originUrl}\n` +
        "El comando upgrade solo admite repositorios de GitHub.",
    );
  }

  const manifest = await readManifest(projectDir);

  const branch = await currentBranch(projectDir, verbose);
  if (branch.length === 0 || branch === "HEAD") {
    throw new UpgradePreflightError(
      "El repositorio está en estado 'HEAD' detachado.\n" +
        "Cambia a una rama antes de ejecutar raulmoracode-create upgrade.",
    );
  }

  return { projectDir, manifest, currentBranch: branch };
}
