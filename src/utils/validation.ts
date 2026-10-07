export type Framework = "vite" | "next";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_PROJECT_NAME_LENGTH = 214;

const RESERVED_PROJECT_NAMES = new Set([
  "node_modules",
  "favicon.ico",
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

const PROJECT_NAME_REGEX = /^[a-z0-9][a-z0-9._~-]*$/;

const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9._-]+$/;

export function validateProjectName(name: string): ValidationResult {
  if (name.length === 0) {
    return {
      valid: false,
      error: "El nombre del proyecto no puede estar vacío.",
    };
  }
  if (name !== name.trim()) {
    return {
      valid: false,
      error:
        "El nombre del proyecto no puede contener espacios al inicio o al final.",
    };
  }
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    return {
      valid: false,
      error: `El nombre del proyecto no puede superar ${MAX_PROJECT_NAME_LENGTH} caracteres.`,
    };
  }
  if (name.startsWith(".") || name.startsWith("_")) {
    return {
      valid: false,
      error: "El nombre del proyecto no puede empezar por '.' o '_'.",
    };
  }
  if (!PROJECT_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error:
        "El nombre del proyecto solo puede contener minúsculas, números y los caracteres '-', '_', '.', '~'.",
    };
  }
  if (RESERVED_PROJECT_NAMES.has(name.toLowerCase())) {
    return {
      valid: false,
      error: `"${name}" es un nombre reservado y no puede utilizarse.`,
    };
  }
  return { valid: true };
}

export interface GitHubUrlResult extends ValidationResult {
  owner?: string;
  repo?: string;
}

export function validateGitHubUrl(url: string): GitHubUrlResult {
  if (url.length === 0) {
    return {
      valid: false,
      error: "La URL del repositorio no puede estar vacía.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "La URL proporcionada no es válida." };
  }
  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "La URL del repositorio debe utilizar https://.",
    };
  }
  if (parsed.hostname !== "github.com") {
    return { valid: false, error: "La URL debe apuntar a github.com." };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, error: "La URL no debe incluir credenciales." };
  }
  const parts = parsed.pathname
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);
  if (parts.length !== 2) {
    return {
      valid: false,
      error: "Formato esperado: https://github.com/<usuario>/<repositorio>",
    };
  }
  const [owner, repo] = parts as [string, string];
  if (!GITHUB_OWNER_REGEX.test(owner)) {
    return {
      valid: false,
      error: "El nombre de usuario de GitHub no es válido.",
    };
  }
  if (!GITHUB_REPO_REGEX.test(repo) || repo === "." || repo === "..") {
    return { valid: false, error: "El nombre del repositorio no es válido." };
  }
  return { valid: true, owner, repo };
}

export function isFramework(value: unknown): value is Framework {
  return value === "vite" || value === "next";
}

export function validateFramework(value: unknown): ValidationResult {
  if (isFramework(value)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: `Framework desconocido: ${String(value)}. Valores válidos: "vite", "next".`,
  };
}

export function satisfiesNodeVersion(
  version: string,
  minimumMajor: number,
): ValidationResult {
  const match = /^v?(\d+)/.exec(version);
  if (!match) {
    return {
      valid: false,
      error: `No se pudo interpretar la versión de Node.js: ${version}`,
    };
  }
  const major = Number(match[1]);
  if (!Number.isFinite(major)) {
    return {
      valid: false,
      error: `No se pudo interpretar la versión de Node.js: ${version}`,
    };
  }
  if (major < minimumMajor) {
    return {
      valid: false,
      error: `Se requiere Node.js ${minimumMajor} o superior. Versión actual: ${version}.`,
    };
  }
  return { valid: true };
}

const PNPM_VERSION_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.+-]*)?$/;

export function satisfiesPnpmVersion(
  version: string,
  requiredMajor: number,
): ValidationResult {
  const trimmed = version.trim();
  const match = PNPM_VERSION_REGEX.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      error: `No se pudo interpretar la versión de pnpm: "${trimmed}".`,
    };
  }
  const major = Number(match[1]);
  if (major !== requiredMajor) {
    return {
      valid: false,
      error: `Se requiere pnpm ${requiredMajor}. Versión actual: ${trimmed.replace(/^v/, "")}.`,
    };
  }
  return { valid: true };
}
