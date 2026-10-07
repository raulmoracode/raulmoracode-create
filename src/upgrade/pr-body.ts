import type { UpgradeReport } from "./types.js";

export function upgradePrTitle(report: UpgradeReport): string {
  return `chore: upgrade raulmoracode-create to ${report.toVersion}`;
}

export function upgradePrBody(_report: UpgradeReport): string {
  throw new Error("upgradePrBody: not implemented yet");
}
