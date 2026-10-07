import { log } from "@clack/prompts";
import type { UpgradePlan } from "../upgrade/plan.js";
import { type FileChangeStatus, MANIFEST_FILE } from "../upgrade/types.js";

const STATUS_LABELS: Record<FileChangeStatus, string> = {
  updated: "se actualiza",
  new: "se crea",
  overwritten: "se sobrescribe",
  removed: "se elimina",
};

export function overwriteWarning(overwrittenFiles: string[]): string {
  return [
    `Se sobrescribirá el contenido de ${overwrittenFiles.length} archivo(s) que modificaste:`,
    ...overwrittenFiles.map((path) => `  - ${path}`),
    'Esos archivos viajan en un segundo commit ("chore: overwrite locally modified files") para que puedas revisarlos por separado.',
  ].join("\n");
}

export function showUpgradeSummary(plan: UpgradePlan): void {
  log.info(`Proyecto: ${plan.manifest.projectName}`);
  log.info(`Framework: ${plan.framework}`);
  log.info(
    `Versión del proyecto: ${plan.fromVersion} → versión instalada: ${plan.toVersion}`,
  );

  for (const note of plan.notes) {
    log.step(`${note.version}: ${note.summary}`);
    for (const change of note.changes) {
      log.message(`  ${change.what}: ${change.why}`, {
        secondarySymbol: "-",
      });
    }
  }

  if (plan.files.length > 0) {
    log.step("Archivos gestionados:");
    for (const file of plan.files) {
      log.message(`  ${STATUS_LABELS[file.status]} ${file.path}`, {
        secondarySymbol: "-",
      });
    }
  }

  if (plan.dependencies.length > 0) {
    log.step("Dependencias:");
    for (const dependency of plan.dependencies) {
      const local = dependency.hadLocalVersion
        ? " (versión local, se sobrescribe)"
        : "";
      log.message(
        `  ${dependency.name}: ${dependency.from ?? "no instalada"} → ${dependency.to}${local}`,
        { secondarySymbol: "-" },
      );
    }
  }

  if (plan.migrations.length > 0) {
    log.step("Migraciones:");
    for (const migration of plan.migrations) {
      log.message(
        `  ${migration.version} · ${migration.id}: ${migration.description}`,
        { secondarySymbol: "-" },
      );
    }
  }

  if (plan.skippedFiles.length > 0) {
    log.step("No se tocan (los borraste en el proyecto):");
    for (const skipped of plan.skippedFiles) {
      log.message(`  ${skipped.path}`, { secondarySymbol: "-" });
    }
  }

  if (plan.keptDependencies.length > 0) {
    log.step("Dependencias que se conservan (ya no las gestiona el CLI):");
    for (const kept of plan.keptDependencies) {
      log.message(`  ${kept.name}@${kept.pinned}`, { secondarySymbol: "-" });
    }
  }

  if (plan.needsAttention.length > 0) {
    log.warn(
      "Estos archivos los generaba el CLI y ya no los genera, pero no hay migración que los elimine. Revísalos y bórralos a mano si siguen sin uso:\n" +
        plan.needsAttention.map((path) => `  - ${path}`).join("\n"),
    );
  }

  const overwritten = plan.files
    .filter((file) => file.status === "overwritten")
    .map((file) => file.path);
  if (overwritten.length > 0) {
    log.warn(overwriteWarning(overwritten));
  }
}

export function showPushFailureHint(
  branch: string,
  base: string,
  title: string,
): void {
  log.warn(
    "La rama y los commits se han conservado: solo falló la publicación del pull request.\n" +
      `  git switch ${branch}\n` +
      `  git push -u origin ${branch}\n` +
      `  gh pr create --base ${base} --head ${branch} --title "${title}"`,
  );
}

export function showNothingToDo(plan: UpgradePlan): void {
  log.info(
    `No hay cambios de plantilla entre ${plan.fromVersion} y ${plan.toVersion}: solo se actualizará ${MANIFEST_FILE}.`,
  );
}
