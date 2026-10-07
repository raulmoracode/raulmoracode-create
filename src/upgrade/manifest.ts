import { createHash } from "node:crypto";
import { TECH_IDS, type TechSelection } from "../config/tech.js";
import { isFramework } from "../utils/validation.js";
import {
  MANIFEST_FILE,
  MANIFEST_VERSION,
  type ProjectManifest,
} from "./types.js";
import { parseVersion } from "./version.js";

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function serializeManifest(manifest: ProjectManifest): string {
  const ordered: ProjectManifest = {
    manifestVersion: manifest.manifestVersion,
    cliVersion: manifest.cliVersion,
    framework: manifest.framework,
    selection: manifest.selection,
    projectName: manifest.projectName,
    githubUrl: manifest.githubUrl,
    files: sortRecord(manifest.files),
    dependencies: sortRecord(manifest.dependencies),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function invalid(detail: string): Error {
  return new Error(`${MANIFEST_FILE} no es válido: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown, field: string): Record<string, string> {
  if (!isRecord(value)) {
    throw invalid(`"${field}" debe ser un objeto.`);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw invalid(`"${field}.${key}" debe ser un texto.`);
    }
  }
  return value as Record<string, string>;
}

export function parseManifest(raw: string): ProjectManifest {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw invalid("no es JSON válido.");
  }
  if (!isRecord(data)) {
    throw invalid("debe ser un objeto JSON.");
  }
  if (data.manifestVersion !== MANIFEST_VERSION) {
    throw invalid(
      `"manifestVersion" ${String(data.manifestVersion)} no soportado (se esperaba ${MANIFEST_VERSION}). Actualiza raulmoracode-create.`,
    );
  }
  if (typeof data.cliVersion !== "string") {
    throw invalid('falta "cliVersion".');
  }
  try {
    parseVersion(data.cliVersion);
  } catch {
    throw invalid(`"cliVersion" "${data.cliVersion}" no es X.Y.Z.`);
  }
  if (!isFramework(data.framework)) {
    throw invalid(`"framework" debe ser "vite" o "next".`);
  }
  if (!isRecord(data.selection)) {
    throw invalid('"selection" debe ser un objeto.');
  }
  const selection = {} as TechSelection;
  for (const id of TECH_IDS) {
    const value = data.selection[id];
    if (typeof value !== "boolean") {
      throw invalid(`"selection.${id}" debe ser true o false.`);
    }
    selection[id] = value;
  }
  if (typeof data.projectName !== "string" || data.projectName === "") {
    throw invalid('falta "projectName".');
  }
  if (typeof data.githubUrl !== "string" || data.githubUrl === "") {
    throw invalid('falta "githubUrl".');
  }
  return {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: data.cliVersion,
    framework: data.framework,
    selection,
    projectName: data.projectName,
    githubUrl: data.githubUrl,
    files: stringRecord(data.files, "files"),
    dependencies: stringRecord(data.dependencies, "dependencies"),
  };
}
