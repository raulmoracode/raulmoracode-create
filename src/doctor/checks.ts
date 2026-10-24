import type { PackageJson } from "../frameworks/types.js";
import { REQUIRED_PNPM_MAJOR } from "../generators/configure-project.js";
import {
  managedDependencyPins,
  managedPackageJson,
} from "../upgrade/managed-files.js";
import { hashContent } from "../upgrade/manifest.js";
import type { ProjectManifest } from "../upgrade/types.js";
import { compareVersions } from "../upgrade/version.js";
import {
  satisfiesNodeVersion,
  satisfiesPnpmVersion,
} from "../utils/validation.js";

export const MINIMUM_NODE_MAJOR = 24;

export type DiagnosticLevel = "ok" | "warning" | "error";

export interface Diagnostic {
  /** Stable identifier, e.g. `manifest` or `managed-files`. */
  id: string;
  level: DiagnosticLevel;
  message: string;
  hint?: string;
}

export interface DoctorFacts {
  /** `process.version` of the running CLI. */
  nodeVersion: string;
  /** `pnpm --version` stdout, or `null` when the binary is unavailable. */
  pnpmVersion: string | null;
  /** `git --version` stdout, or `null` when the binary is unavailable. */
  gitVersion: string | null;
  insideRepository: boolean;
  packageJson: PackageJson | null;
  /** Parsed manifest, or `null` when it is absent or invalid. */
  manifest: ProjectManifest | null;
  /** Why the manifest could not be parsed, when that is the case. */
  manifestError: string | null;
  /** Managed path → current content on disk, or `null` when the file is missing. */
  files: Record<string, string | null>;
  /** Version of the CLI that is running `doctor`. */
  currentCliVersion: string;
}

const MAX_LISTED = 5;

function listed(items: string[]): string {
  const shown = items.slice(0, MAX_LISTED).join(", ");
  const rest = items.length - MAX_LISTED;
  return rest > 0 ? `${shown} y ${rest} más` : shown;
}

function diagnoseManifestVersion(
  facts: DoctorFacts,
  manifest: ProjectManifest,
): Diagnostic {
  const comparison = compareVersions(
    manifest.cliVersion,
    facts.currentCliVersion,
  );
  if (comparison === 0) {
    return {
      id: "version",
      level: "ok",
      message: `El proyecto está al día con raulmoracode-create ${facts.currentCliVersion}.`,
    };
  }
  if (comparison < 0) {
    return {
      id: "version",
      level: "warning",
      message: `Hay una actualización disponible: ${manifest.cliVersion} → ${facts.currentCliVersion}.`,
      hint: "Ejecuta 'raulmoracode-create upgrade' para abrir el pull request de actualización.",
    };
  }
  return {
    id: "version",
    level: "warning",
    message: `El proyecto se creó con raulmoracode-create ${manifest.cliVersion}, más reciente que este CLI (${facts.currentCliVersion}).`,
    hint: "Actualiza el CLI: npm install -g @raulmoracode/create@latest",
  };
}

function diagnoseFiles(
  facts: DoctorFacts,
  manifest: ProjectManifest,
): Diagnostic {
  const missing: string[] = [];
  const modified: string[] = [];
  for (const [path, recorded] of Object.entries(manifest.files)) {
    const content = facts.files[path] ?? null;
    if (content === null) {
      missing.push(path);
      continue;
    }
    if (hashContent(content) !== recorded) {
      modified.push(path);
    }
  }
  if (missing.length === 0 && modified.length === 0) {
    return {
      id: "managed-files",
      level: "ok",
      message: `Los ${Object.keys(manifest.files).length} archivos gestionados coinciden con el manifest.`,
    };
  }
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`${missing.length} ausente(s): ${listed(missing)}`);
  }
  if (modified.length > 0) {
    parts.push(
      `${modified.length} modificado(s) desde el CLI: ${listed(modified)}`,
    );
  }
  return {
    id: "managed-files",
    level: "warning",
    message: `Archivos gestionados: ${parts.join("; ")}.`,
    hint: "El upgrade recrea los ausentes y trata los modificados como archivos sobrescritos.",
  };
}

function diagnoseDependencies(
  facts: DoctorFacts,
  manifest: ProjectManifest,
): Diagnostic {
  const pins = managedDependencyPins(manifest.framework, manifest.selection);
  const installed = {
    ...(facts.packageJson?.dependencies ?? {}),
    ...(facts.packageJson?.devDependencies ?? {}),
  };
  const missing: string[] = [];
  const drifted: string[] = [];
  for (const [name, pin] of Object.entries(pins)) {
    const version = installed[name];
    if (typeof version !== "string") {
      missing.push(name);
      continue;
    }
    if (version !== pin) {
      drifted.push(`${name} (${version} → ${pin})`);
    }
  }
  if (missing.length === 0 && drifted.length === 0) {
    return {
      id: "dependencies",
      level: "ok",
      message:
        "Las dependencias gestionadas están en la versión exacta del CLI.",
    };
  }
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`${missing.length} sin instalar: ${listed(missing)}`);
  }
  if (drifted.length > 0) {
    parts.push(`${drifted.length} con otra versión: ${listed(drifted)}`);
  }
  return {
    id: "dependencies",
    level: "warning",
    message: `Dependencias gestionadas: ${parts.join("; ")}.`,
    hint: "El upgrade alinea los pins a la versión exacta del CLI.",
  };
}

function diagnoseScripts(
  facts: DoctorFacts,
  manifest: ProjectManifest,
): Diagnostic {
  const expected = managedPackageJson(
    manifest.framework,
    manifest.selection,
  ).scripts;
  const current = facts.packageJson?.scripts ?? {};
  const missing: string[] = [];
  const changed: string[] = [];
  for (const [name, command] of Object.entries(expected)) {
    if (typeof current[name] !== "string") {
      missing.push(name);
      continue;
    }
    if (current[name] !== command) {
      changed.push(name);
    }
  }
  if (missing.length === 0 && changed.length === 0) {
    return {
      id: "scripts",
      level: "ok",
      message: "Los scripts del CLI están presentes en package.json.",
    };
  }
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`faltan ${listed(missing)}`);
  }
  if (changed.length > 0) {
    parts.push(`distintos ${listed(changed)}`);
  }
  return {
    id: "scripts",
    level: "warning",
    message: `Scripts: ${parts.join("; ")}.`,
    hint: "El upgrade restaura los scripts gestionados en package.json.",
  };
}

export function diagnoseProject(facts: DoctorFacts): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const node = satisfiesNodeVersion(facts.nodeVersion, MINIMUM_NODE_MAJOR);
  diagnostics.push(
    node.valid
      ? {
          id: "node",
          level: "ok",
          message: `Node ${facts.nodeVersion.replace(/^v/, "")} (se requiere >= ${MINIMUM_NODE_MAJOR}).`,
        }
      : {
          id: "node",
          level: "error",
          message: node.error ?? "Versión de Node no soportada.",
          hint: `Instala Node.js ${MINIMUM_NODE_MAJOR} LTS: https://nodejs.org`,
        },
  );

  if (facts.pnpmVersion === null) {
    diagnostics.push({
      id: "pnpm",
      level: "error",
      message: "pnpm no está instalado o no está disponible en el PATH.",
      hint: "Instala pnpm: https://pnpm.io/installation",
    });
  } else {
    const pnpm = satisfiesPnpmVersion(facts.pnpmVersion, REQUIRED_PNPM_MAJOR);
    diagnostics.push(
      pnpm.valid
        ? {
            id: "pnpm",
            level: "ok",
            message: `pnpm ${facts.pnpmVersion.trim()} (se requiere la major ${REQUIRED_PNPM_MAJOR}).`,
          }
        : {
            id: "pnpm",
            level: "error",
            message: pnpm.error ?? "Versión de pnpm no soportada.",
            hint: "Instala pnpm 12: corepack enable && corepack prepare pnpm@12.6.0 --activate",
          },
    );
  }

  if (facts.gitVersion === null) {
    diagnostics.push({
      id: "git",
      level: "error",
      message: "git no está instalado o no está disponible en el PATH.",
      hint: "Instala Git: https://git-scm.com/downloads",
    });
  } else if (!facts.insideRepository) {
    diagnostics.push({
      id: "git",
      level: "warning",
      message: "El directorio actual no está dentro de un repositorio Git.",
      hint: "Ejecuta doctor desde la raíz de un proyecto generado.",
    });
  } else {
    diagnostics.push({
      id: "git",
      level: "ok",
      message: "git disponible y el directorio está dentro de un repositorio.",
    });
  }

  if (facts.packageJson === null) {
    diagnostics.push({
      id: "package-json",
      level: "error",
      message:
        "No se encontró un package.json legible en el directorio actual.",
      hint: "Ejecuta doctor desde la raíz de un proyecto generado.",
    });
  } else {
    diagnostics.push({
      id: "package-json",
      level: "ok",
      message: `package.json de "${facts.packageJson.name ?? "sin nombre"}" leído.`,
    });
  }

  if (facts.manifestError !== null) {
    diagnostics.push({
      id: "manifest",
      level: "error",
      message: `raulmoracode.json no se pudo leer: ${facts.manifestError}`,
    });
  } else if (facts.manifest === null) {
    diagnostics.push({
      id: "manifest",
      level: "error",
      message: "No se encontró raulmoracode.json en el proyecto.",
      hint: "Si el proyecto se creó antes de 1.0.8, ejecuta 'raulmoracode-create upgrade --adopt'.",
    });
  } else {
    diagnostics.push({
      id: "manifest",
      level: "ok",
      message: `raulmoracode.json válido (${facts.manifest.framework}).`,
    });
    diagnostics.push(diagnoseManifestVersion(facts, facts.manifest));
    diagnostics.push(diagnoseFiles(facts, facts.manifest));
    diagnostics.push(diagnoseDependencies(facts, facts.manifest));
    diagnostics.push(diagnoseScripts(facts, facts.manifest));
  }

  return diagnostics;
}
