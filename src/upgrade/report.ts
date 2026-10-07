import type { UpgradePlan } from "./plan.js";
import type { AppliedMigration, UpgradeReport } from "./types.js";

export const CLI_REPOSITORY_URL =
  "https://github.com/raulmoracode/raulmoracode-create";

export function changelogUrl(from: string, to: string): string {
  return `${CLI_REPOSITORY_URL}/compare/v${from}...v${to}`;
}

export function buildUpgradeReport(params: {
  plan: UpgradePlan;
  appliedMigrations: AppliedMigration[];
  commits: string[];
  changelog?: string;
}): UpgradeReport {
  const { plan, appliedMigrations, commits } = params;
  return {
    fromVersion: plan.fromVersion,
    toVersion: plan.toVersion,
    framework: plan.framework,
    notes: plan.notes,
    files: plan.files,
    skippedFiles: plan.skippedFiles,
    dependencies: plan.dependencies,
    keptDependencies: plan.keptDependencies,
    migrations: appliedMigrations,
    commits,
    changelogUrl:
      params.changelog ?? changelogUrl(plan.fromVersion, plan.toVersion),
  };
}
