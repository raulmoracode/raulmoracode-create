export interface ProjectMarker {
  createdBy: string;
  migratedBy?: string;
  migrations: string[];
}

export const PROJECT_MARKER_FILE = "raulmoracode.json";

export function projectMarker(options: {
  createdBy: string;
  migratedBy?: string;
  migrations: string[];
}): string {
  const marker: ProjectMarker = {
    createdBy: options.createdBy,
    ...(options.migratedBy === undefined
      ? {}
      : { migratedBy: options.migratedBy }),
    migrations: [...new Set(options.migrations)].sort(),
  };
  return `${JSON.stringify(marker, null, 2)}\n`;
}

export function parseProjectMarker(raw: unknown): ProjectMarker | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const migrations = Array.isArray(record.migrations)
    ? record.migrations.filter((id): id is string => typeof id === "string")
    : [];
  const createdBy =
    typeof record.createdBy === "string" ? record.createdBy : "unknown";
  const migratedBy =
    typeof record.migratedBy === "string" ? record.migratedBy : undefined;
  return {
    createdBy,
    ...(migratedBy === undefined ? {} : { migratedBy }),
    migrations,
  };
}
