import type { ProjectMarker } from "../config/project-marker.js";

export type ProjectFrameworkId = "vite" | "next";

export interface ProjectFacts {
  root: string;
  framework: ProjectFrameworkId | null;
  projectName: string;
  packageJson: unknown;
  marker: ProjectMarker | null;
  hasBiome: boolean;
}

export type MigrationStatus =
  | "applied"
  | "pending"
  | "skipped"
  | "conflict"
  | "failed";

export interface MigrationOutcome {
  id: string;
  status: MigrationStatus;
  target: string | null;
  message?: string;
  manual?: string[];
}

/**
 * A migration is an "ensure this is in place" operation, never a diff between
 * two template versions: it inspects the project and only writes what is
 * missing. That keeps it idempotent and independent of the CLI version that
 * originally created the project.
 */
export interface Migration {
  id: string;
  target(project: ProjectFacts): string | null;
  isApplied(project: ProjectFacts): Promise<boolean>;
  apply(project: ProjectFacts): Promise<MigrationOutcome>;
}
