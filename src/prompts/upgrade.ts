import { confirm } from "@clack/prompts";
import { ensureNotCancelled } from "./cancel.js";

export interface ConfirmUpgradeParams {
  fromVersion: string;
  toVersion: string;
  branch: string;
  base: string;
  updatedFiles: number;
  newFiles: number;
  removedFiles: number;
}

export async function confirmUpgrade(
  params: ConfirmUpgradeParams,
): Promise<boolean> {
  const {
    fromVersion,
    toVersion,
    branch,
    base,
    updatedFiles,
    newFiles,
    removedFiles,
  } = params;

  const summary = [
    `de ${fromVersion} a ${toVersion}`,
    `${updatedFiles} actualizados, ${newFiles} nuevos, ${removedFiles} eliminados`,
    `${branch} → ${base}`,
  ].join(" · ");

  const answer = ensureNotCancelled(
    await confirm({
      message: `¿Abrir el pull request de actualización? (${summary})`,
      active: "Sí",
      inactive: "No",
      initialValue: true,
    }),
  );
  return Boolean(answer);
}
