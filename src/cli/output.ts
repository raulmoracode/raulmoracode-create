import { intro, log, outro } from "@clack/prompts";

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
    log.message(
      "shadcn registry ready: pnpm dlx shadcn@latest add @raulmoracode/<component>",
    );
  }
}

export function showFarewell(): void {
  outro("Proyecto creado correctamente.\n¡Hasta pronto!");
}
