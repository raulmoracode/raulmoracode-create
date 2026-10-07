import { intro, log, outro, tasks } from "@clack/prompts";
import {
  deleteLocalBranch,
  pushBranch,
  switchToBranch,
} from "../git/upgrade.js";
import { detectDefaultBranch as detectDefaultBranchWithGh } from "../github/default-branch.js";
import type { CreatePullRequestOptions } from "../github/gh.js";
import {
  createPullRequest,
  findOpenPullRequest,
  requireGhAuth,
} from "../github/gh.js";
import { confirmUpgrade } from "../prompts/upgrade.js";
import {
  applyUpgradeFiles,
  commitUpgrade,
  prepareUpgradeBranch,
  revertAppliedFiles,
} from "../upgrade/apply.js";
import {
  buildUpgradePlan,
  planHasWork,
  type UpgradePlan,
  upgradeOutcome,
} from "../upgrade/plan.js";
import { upgradePrBody, upgradePrTitle } from "../upgrade/pr-body.js";
import { upgradePreflightChecks } from "../upgrade/preflight.js";
import { buildUpgradeReport } from "../upgrade/report.js";
import { readProjectState } from "../upgrade/state.js";
import type { AppliedMigration } from "../upgrade/types.js";
import { ExecError } from "../utils/exec.js";
import { VERSION } from "./args.js";
import {
  showNothingToDo,
  showPushFailureHint,
  showUpgradeSummary,
} from "./upgrade-output.js";

export interface GhClient {
  requireAuth(verbose: boolean): Promise<void>;
  findOpenPullRequest(
    cwd: string,
    head: string,
    verbose: boolean,
  ): Promise<string | null>;
  createPullRequest(options: CreatePullRequestOptions): Promise<string>;
}

export type DefaultBranchDetector = (
  projectDir: string,
  verbose: boolean,
) => Promise<string>;

export interface UpgradeDeps {
  gh: GhClient;
  detectDefaultBranch: DefaultBranchDetector;
}

export interface UpgradeOptions {
  verbose?: boolean;
  deps?: Partial<UpgradeDeps>;
}

const DEFAULT_DEPS: UpgradeDeps = {
  gh: {
    requireAuth: (verbose: boolean) => requireGhAuth(verbose),
    findOpenPullRequest: (cwd: string, head: string, verbose: boolean) =>
      findOpenPullRequest(cwd, head, verbose),
    createPullRequest: (options: CreatePullRequestOptions) =>
      createPullRequest(options),
  },
  detectDefaultBranch: detectDefaultBranchWithGh,
};

export async function runUpgrade(options: UpgradeOptions = {}): Promise<void> {
  const verbose = options.verbose ?? false;
  const gh: GhClient = { ...DEFAULT_DEPS.gh, ...options.deps?.gh };
  const detectDefaultBranch =
    options.deps?.detectDefaultBranch ?? DEFAULT_DEPS.detectDefaultBranch;
  const toVersion = VERSION;

  intro("Raulmoracode Upgrade");

  let projectDir = "";
  let originalBranch = "";
  let base = "";
  let createdBranch: string | null = null;
  let commitsCreated = false;
  let filesWritten = false;
  let prTitle: string | null = null;
  let pullRequestUrl: string | null = null;
  let appliedMigrations: AppliedMigration[] = [];
  let commits: string[] = [];
  let appliedPlan: UpgradePlan | null = null;

  try {
    const preflight = await upgradePreflightChecks({
      cwd: process.cwd(),
      verbose,
      requireGhAuth: () => gh.requireAuth(verbose),
    });
    projectDir = preflight.projectDir;
    originalBranch = preflight.currentBranch;

    const outcome = upgradeOutcome(preflight.manifest.cliVersion, toVersion);
    if (outcome === "up-to-date") {
      log.success(
        `El proyecto ya está actualizado (raulmoracode-create ${toVersion}).`,
      );
      outro("No hay nada que actualizar.");
      return;
    }
    if (outcome === "cli-outdated") {
      log.warn(
        `El proyecto fue generado con raulmoracode-create ${preflight.manifest.cliVersion}, más reciente que este CLI (${toVersion}).`,
      );
      log.info(
        "Actualiza el CLI y vuelve a ejecutar el comando: npm install -g @raulmoracode/create@latest",
      );
      outro("No se ha modificado el proyecto.");
      return;
    }

    const state = await readProjectState(projectDir, preflight.manifest);
    const plan = buildUpgradePlan({
      manifest: preflight.manifest,
      toVersion,
      state,
    });
    appliedPlan = plan;

    const openPullRequest = await gh.findOpenPullRequest(
      projectDir,
      plan.branch,
      verbose,
    );
    if (openPullRequest) {
      log.warn(
        `Ya hay un pull request abierto para esta actualización: ${openPullRequest}`,
      );
      outro("No se ha modificado el proyecto.");
      return;
    }

    showUpgradeSummary(plan);
    if (!planHasWork(plan)) {
      showNothingToDo(plan);
    }

    base = await detectDefaultBranch(projectDir, verbose);

    const confirmed = await confirmUpgrade({
      fromVersion: plan.fromVersion,
      toVersion: plan.toVersion,
      branch: plan.branch,
      base,
      updatedFiles: plan.files.filter((file) => file.status === "updated")
        .length,
      newFiles: plan.files.filter((file) => file.status === "new").length,
      removedFiles: plan.files.filter((file) => file.status === "removed")
        .length,
    });
    if (!confirmed) {
      log.info("Actualización cancelada: no se ha modificado nada.");
      outro("Cancelado.");
      return;
    }

    await tasks([
      {
        title: "Preparando la rama de actualización",
        task: async (message) => {
          message(`Rama ${plan.branch} desde origin/${base}`);
          await prepareUpgradeBranch({
            projectDir,
            plan,
            verbose,
            detectBase: async () => base,
          });
          createdBranch = plan.branch;
          return plan.branch;
        },
      },
      {
        title: "Actualizando el proyecto",
        task: async (message) => {
          message("Escribiendo los archivos gestionados");
          filesWritten = true;
          appliedMigrations = await applyUpgradeFiles({
            projectDir,
            plan,
            verbose,
          });
          message("Instalando dependencias");
          return "Proyecto actualizado";
        },
      },
      {
        title: "Creando los commits",
        task: async () => {
          commits = await commitUpgrade({
            projectDir,
            plan,
            verbose,
            onCommit: () => {
              commitsCreated = true;
            },
          });
          return commits.length > 1 ? "Commits creados" : "Commit creado";
        },
      },
      {
        title: "Publicando el pull request",
        task: async (message) => {
          await pushBranch(projectDir, plan.branch, verbose);
          const report = buildUpgradeReport({
            plan,
            appliedMigrations,
            commits,
          });
          prTitle = upgradePrTitle(report);
          message("Abriendo el pull request");
          pullRequestUrl = await gh.createPullRequest({
            cwd: projectDir,
            base,
            head: plan.branch,
            title: prTitle,
            body: upgradePrBody(report),
            verbose,
          });
          return "Pull request creado";
        },
      },
    ]);

    await switchToBranch(projectDir, originalBranch, verbose);
    log.success(`Pull request listo para revisión: ${String(pullRequestUrl)}`);
    log.message(`Rama de actualización: ${plan.branch}`);
    log.message(`Has vuelto a tu rama: ${originalBranch}`);
    outro("Revisa y fusiona el pull request cuando estés conforme.");
  } catch (error) {
    const cancelled =
      error instanceof ExecError &&
      (error.signal === "SIGINT" || error.signal === "SIGTERM");

    if (error instanceof Error) {
      log.error(error.message);
    } else {
      log.error(String(error));
    }

    if (createdBranch !== null && appliedPlan !== null) {
      try {
        await switchToBranch(projectDir, originalBranch, verbose);
      } catch {
        // Best effort: the branch and its commits survive either way.
      }
      if (commitsCreated) {
        showPushFailureHint(
          createdBranch,
          base,
          prTitle ?? `chore: upgrade raulmoracode-create to ${toVersion}`,
        );
      } else {
        if (filesWritten) {
          await revertAppliedFiles(projectDir, appliedPlan, verbose);
        }
        try {
          await deleteLocalBranch(projectDir, createdBranch, verbose);
          log.warn(
            `Se ha vuelto a ${originalBranch} y se ha eliminado la rama incompleta ${createdBranch}.`,
          );
        } catch {
          log.warn(
            `Se ha vuelto a ${originalBranch}. La rama ${createdBranch} ha quedado a medias: bórrala con: git branch -D ${createdBranch}`,
          );
        }
      }
    }

    if (cancelled) {
      log.error("Operación cancelada por el usuario.");
      process.exit(130);
    }
    process.exit(1);
  }
}
