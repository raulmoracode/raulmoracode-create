import { intro, log, outro } from "@clack/prompts";
import { RAULMORACODE_REGISTRY_ADD_EXAMPLE } from "../config/components.js";

export function showIntro(): void {
  intro("Raulmoracode Create");
}

export function showError(message: string): void {
  log.error(message);
}

export function showWarning(message: string): void {
  log.warn(message);
}

export function showSummary(params: {
  projectName: string;
  githubUrl: string;
  frameworkLabel: string;
  shadcn?: boolean;
}): void {
  const { projectName, githubUrl, frameworkLabel, shadcn } = params;
  log.success("Project created successfully!");
  log.message(`Framework: ${frameworkLabel}`);
  log.message(`Local:     ./${projectName}`);
  log.message(`GitHub:    ${githubUrl}`);
  if (shadcn) {
    log.message(`shadcn registry ready: ${RAULMORACODE_REGISTRY_ADD_EXAMPLE}`);
  }
}

export function showFarewell(): void {
  outro("Proyecto creado correctamente.\n¡Hasta pronto!");
}
