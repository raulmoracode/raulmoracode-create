import { intro, log, tasks } from "@clack/prompts";
import { getFramework } from "../frameworks/index.js";
import {
  configureBiome,
  formatProject,
} from "../generators/configure-biome.js";
import { configureChangelog } from "../generators/configure-changelog.js";
import { configureCi } from "../generators/configure-ci.js";
import { configureGitHooks } from "../generators/configure-git-hooks.js";
import { configureManifest } from "../generators/configure-manifest.js";
import {
  augmentGitignore,
  configureEditorconfig,
  configureNode,
} from "../generators/configure-node.js";
import { configurePrTemplate } from "../generators/configure-pr-template.js";
import {
  installDependencies,
  normalizePackageJson,
  PNPM_VERSION,
  patchPackageJson,
  REQUIRED_PNPM_MAJOR,
  refreshPnpmWorkspaceExcludes,
  writeProjectLicense,
} from "../generators/configure-project.js";
import { configureReadme } from "../generators/configure-readme.js";
import { configureShadcn } from "../generators/configure-shadcn.js";
import { configureSite } from "../generators/configure-site.js";
import { configureTesting } from "../generators/configure-testing.js";
import { applyRegistryTheme } from "../generators/configure-theme.js";
import { configureVscode } from "../generators/configure-vscode.js";
import { createProject } from "../generators/create-project.js";
import { createCommit } from "../git/commit.js";
import { initRepository } from "../git/init.js";
import { push, remoteHasDivergentCommits } from "../git/push.js";
import { addRemote, lsRemote } from "../git/remote.js";
import { promptOpenInVscode } from "../prompts/confirm.js";
import { promptFramework } from "../prompts/framework.js";
import { promptGitHubUrl } from "../prompts/github.js";
import { promptProjectName } from "../prompts/project.js";
import { promptTechPreset } from "../prompts/tech.js";
import { ExecError, exec } from "../utils/exec.js";
import {
  ensureDir,
  isDirectoryEmpty,
  pathExists,
  removeEmptyDir,
  removeIfExists,
  resolvePath,
} from "../utils/filesystem.js";
import {
  satisfiesNodeVersion,
  satisfiesPnpmVersion,
} from "../utils/validation.js";
import { VERSION } from "./args.js";
import { showFarewell, showSummary, showWarning } from "./output.js";

const MINIMUM_NODE_MAJOR = 24;

export const REMOTE_CONFLICT_MESSAGE = [
  "El repositorio remoto ya contiene cambios que no existen localmente.",
  "",
  "No se realizará ningún push destructivo.",
  "Por favor, revisa el repositorio y vuelve a ejecutar el proceso.",
].join("\n");

export class PreflightError extends Error {}

/**
 * Decides whether the generated directory must be removed after a failure.
 *
 * Past `checkDestination`, everything under `./<name>` was created by this run
 * (the destination either did not exist or was an empty dir we removed), so it
 * is safe to delete. Two exceptions:
 * - `null` (failure before any task ran): nothing was created, nothing to clean.
 * - `"Pushing to GitHub"`: the project is complete locally, only the push
 *   failed — deleting it would destroy a perfectly good project.
 */
export function shouldRemoveProjectDir(failedStep: string | null): boolean {
  if (failedStep === null) {
    return false;
  }
  if (failedStep === "Pushing to GitHub") {
    return false;
  }
  return true;
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
      throw new PreflightError(
        `${command} no está instalado o no disponible en el PATH.\n${instructions}`,
      );
    }
    throw new PreflightError(`No se pudo ejecutar "${command} --version".`);
  }
}

async function requireGitIdentity(verbose: boolean): Promise<void> {
  const name = await exec("git", ["config", "--get", "user.name"], { verbose });
  const email = await exec("git", ["config", "--get", "user.email"], {
    verbose,
  });
  if (!name.stdout.trim() || !email.stdout.trim()) {
    throw new PreflightError(
      "Git no tiene configurada la identidad (user.name y user.email), necesaria para crear el commit inicial.\n" +
        'Ejecuta: git config --global user.name "Tu Nombre" && git config --global user.email "tu@email.com"',
    );
  }
}

async function preflightChecks(verbose: boolean): Promise<void> {
  const nodeCheck = satisfiesNodeVersion(process.version, MINIMUM_NODE_MAJOR);
  if (!nodeCheck.valid) {
    throw new PreflightError(
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
    throw new PreflightError(
      `${pnpmCheck.error}\nInstala pnpm ${PNPM_VERSION}: corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate  (o: npm install -g pnpm@${PNPM_VERSION})`,
    );
  }
  await requireCommand(
    "git",
    "Instala Git: https://git-scm.com/downloads",
    verbose,
  );
  await requireGitIdentity(verbose);
}

async function checkDestination(projectName: string): Promise<{
  projectDir: string;
  reusedEmptyDir: boolean;
}> {
  const projectDir = resolvePath(process.cwd(), projectName);
  if (await pathExists(projectDir)) {
    if (await isDirectoryEmpty(projectDir)) {
      await removeEmptyDir(projectDir);
      return { projectDir, reusedEmptyDir: true };
    }
    throw new PreflightError(
      `El directorio "./${projectName}" ya existe y no está vacío.\n` +
        "Muévalo, renómbralo o elimínalo antes de continuar. No se borrará ningún contenido existente.",
    );
  }
  return { projectDir, reusedEmptyDir: false };
}

async function checkRemoteAccess(
  githubUrl: string,
  verbose: boolean,
): Promise<void> {
  try {
    await lsRemote(githubUrl, verbose);
  } catch {
    throw new PreflightError(
      `No se pudo acceder al repositorio ${githubUrl}.\n` +
        "Comprueba la URL, tu conexión a internet y tu autenticación de GitHub (https o gh auth).",
    );
  }
}

export interface RunOptions {
  verbose?: boolean;
}

export async function run(options: RunOptions = {}): Promise<void> {
  const verbose = options.verbose ?? false;
  intro("Raulmoracode Create");

  let projectName = "";
  let cleanupDir: string | null = null;
  let restoreEmptyDir = false;
  let failedStep: string | null = null;

  try {
    await preflightChecks(verbose);

    const frameworkId = await promptFramework();
    const { selection, notes } = await promptTechPreset();
    for (const note of notes) {
      showWarning(note);
    }
    projectName = await promptProjectName();
    const githubUrl = await promptGitHubUrl();

    const { projectDir, reusedEmptyDir } = await checkDestination(projectName);
    cleanupDir = projectDir;
    restoreEmptyDir = reusedEmptyDir;
    await checkRemoteAccess(githubUrl, verbose);

    const framework = getFramework(frameworkId);

    await tasks([
      {
        title: "Creating project",
        task: async (message) => {
          failedStep = "Creating project";
          message(`Scaffolding with ${framework.label}`);
          await createProject(framework, projectName, process.cwd(), verbose);
          if (selection.tailwind) {
            message("Configuring Tailwind CSS");
            await framework.configureTailwind(projectDir);
          }
          message("Configuring site config");
          await configureSite(projectDir, projectName);
          message("Configuring branding");
          await framework.configureBranding(projectDir);
          if (selection.shadcn) {
            message("Configuring shadcn");
            await configureShadcn(projectDir, framework);
          }
          if (selection.theme) {
            message("Applying Raulmoracode theme");
            await applyRegistryTheme(projectDir, framework, verbose);
          }
          if (selection["tanstack-query"]) {
            message("Configuring TanStack Query");
            await framework.configureTanStackQuery(projectDir);
          }
          if (framework.configureStarter) {
            message("Configuring starter");
            await framework.configureStarter(projectDir, selection);
          }
          if (selection.biome) {
            message("Configuring Biome");
            await configureBiome(projectDir);
          }
          if (selection.testing) {
            message("Configuring testing");
            await configureTesting(projectDir);
          }
          if (selection.vscode) {
            message("Configuring VS Code");
            await configureVscode(projectDir);
          }
          message("Configuring Node version");
          await configureNode(projectDir);
          await configureEditorconfig(projectDir);
          if (selection.husky) {
            message("Configuring Git hooks");
            await configureGitHooks(projectDir, selection);
          }
          await patchPackageJson(
            projectDir,
            framework,
            projectName,
            githubUrl,
            selection,
          );
          message("Writing README");
          await configureReadme(
            projectDir,
            framework,
            projectName,
            githubUrl,
            selection,
          );
          message("Writing LICENSE");
          await writeProjectLicense(projectDir, new Date().getFullYear());
          message("Writing CHANGELOG");
          await configureChangelog(projectDir);
          await augmentGitignore(projectDir);
          message("Configuring CI");
          await configureCi(projectDir, selection);
          message("Configuring pull request template");
          await configurePrTemplate(projectDir);
          return "Project created";
        },
      },
      {
        title: "Installing dependencies",
        task: async (message) => {
          failedStep = "Installing dependencies";
          message("Installing base and additional dependencies");
          await installDependencies(projectDir, framework, verbose, selection);
          await normalizePackageJson(projectDir);
          if (selection.biome) {
            message("Formatting project with Biome");
            await formatProject(projectDir, verbose);
          }
          message("Configuring pnpm workspace");
          await refreshPnpmWorkspaceExcludes(
            projectDir,
            framework,
            verbose,
            selection,
          );
          if (selection.zustand) {
            message("Zustand configured");
          }
          if (selection.forms) {
            message("React Hook Form + Zod configured");
          }
          if (selection["tanstack-query"]) {
            message("TanStack Query configured");
          }
          if (selection.tailwind) {
            message("Tailwind configured");
          }
          if (selection.biome) {
            message("Biome configured");
          }
          if (selection.testing) {
            message("Testing configured");
          }
          message("Writing project manifest");
          await configureManifest(projectDir, {
            framework,
            projectName,
            githubUrl,
            selection,
            cliVersion: VERSION,
          });
          return "Dependencies installed";
        },
      },
      {
        title: "Initializing Git",
        task: async () => {
          failedStep = "Initializing Git";
          await initRepository(projectDir, verbose);
          if (selection.husky) {
            await exec("pnpm", ["exec", "husky"], {
              cwd: projectDir,
              verbose,
            });
          }
          return "Git initialized";
        },
      },
      {
        title: "Configuring remote",
        task: async () => {
          failedStep = "Configuring remote";
          await addRemote(projectDir, githubUrl, verbose);
          return "Remote configured";
        },
      },
      {
        title: "Creating initial commit",
        task: async () => {
          failedStep = "Creating initial commit";
          await createCommit(projectDir, verbose);
          return "Initial commit created";
        },
      },
      {
        title: "Pushing to GitHub",
        task: async () => {
          failedStep = "Pushing to GitHub";
          const hasConflicts = await remoteHasDivergentCommits(
            projectDir,
            verbose,
          );
          if (hasConflicts) {
            throw new Error(REMOTE_CONFLICT_MESSAGE);
          }
          await push(projectDir, verbose);
          return "Pushed to GitHub";
        },
      },
    ]);

    showSummary({
      projectName,
      githubUrl,
      frameworkLabel: framework.label,
      shadcn: selection.shadcn,
    });

    const openInVscode = await promptOpenInVscode();
    if (openInVscode) {
      try {
        await exec("code", ["."], { cwd: projectDir, verbose });
      } catch (error) {
        if (error instanceof ExecError && error.spawnError) {
          showWarning(
            'El comando "code" no está disponible. Abre el proyecto manualmente con VS Code.',
          );
        } else {
          showWarning(
            "No se pudo abrir VS Code automáticamente. Abre el proyecto manualmente.",
          );
        }
      }
    }
    showFarewell();
  } catch (error) {
    const cancelled =
      error instanceof ExecError &&
      (error.signal === "SIGINT" || error.signal === "SIGTERM");
    let cleaned = false;
    if (shouldRemoveProjectDir(failedStep) && cleanupDir !== null) {
      try {
        await removeIfExists(cleanupDir);
        cleaned = true;
      } catch {
        cleaned = false;
      }
    } else if (failedStep === null && restoreEmptyDir && cleanupDir !== null) {
      try {
        await ensureDir(cleanupDir);
      } catch {
        // Best effort: restoring an empty dir must never hide the real error.
      }
    }
    if (cancelled) {
      if (cleaned) {
        log.error(
          `Operación cancelada. Se eliminó "./${projectName}" (todo su contenido lo había creado el CLI).`,
        );
      } else {
        log.error("Operación cancelada por el usuario.");
      }
      process.exit(130);
    }
    if (error instanceof Error) {
      log.error(error.message);
    } else {
      log.error(String(error));
    }
    if (cleaned) {
      showWarning(
        `Se eliminó "./${projectName}" (todo su contenido lo había creado el CLI). ` +
          "Vuelve a ejecutar raulmoracode-create para reintentar.",
      );
    } else if (failedStep === "Pushing to GitHub") {
      showWarning(
        `El proyecto está completo en "./${projectName}": solo falló el push. ` +
          `Reintenta con: git -C "./${projectName}" push -u origin main`,
      );
    }
    process.exit(1);
  }
}
