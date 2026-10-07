import type { TechSelection } from "../config/tech.js";
import type { Framework } from "../utils/validation.js";

export const MANIFEST_FILE = "raulmoracode.json";
export const MANIFEST_VERSION = 1;

export interface ProjectManifest {
  manifestVersion: typeof MANIFEST_VERSION;
  cliVersion: string;
  framework: Framework;
  selection: TechSelection;
  projectName: string;
  githubUrl: string;
  /** Managed file path (POSIX, relative to the project root) → sha256 of the content the CLI left on disk. */
  files: Record<string, string>;
  /** Package name → exact version the CLI pinned (dependencies and devDependencies). */
  dependencies: Record<string, string>;
}

export interface UpgradeChangeNote {
  files: string[];
  what: string;
  why: string;
  action?: string;
}

export interface UpgradeNotes {
  version: string;
  summary: string;
  changes: UpgradeChangeNote[];
}

export interface MigrationContext {
  projectDir: string;
  manifest: ProjectManifest;
  verbose: boolean;
}

export interface MigrationResult {
  touched: string[];
  removed: string[];
}

export interface Migration {
  id: string;
  version: string;
  description: string;
  why: string;
  run(context: MigrationContext): Promise<MigrationResult>;
}

export type FileChangeStatus = "updated" | "new" | "overwritten" | "removed";

export interface FileChange {
  path: string;
  status: FileChangeStatus;
  previousContent: string | null;
  nextContent: string | null;
}

export type DependencyType = "dependencies" | "devDependencies";

export interface DependencyChange {
  name: string;
  type: DependencyType;
  from: string | null;
  to: string;
  hadLocalVersion: boolean;
}

export interface KeptDependency {
  name: string;
  pinned: string;
  reason: "removed-locally";
}

export interface SkippedFile {
  path: string;
  reason: "deleted-locally";
}

export interface AppliedMigration {
  id: string;
  version: string;
  description: string;
  why: string;
}

export interface UpgradeReport {
  fromVersion: string;
  toVersion: string;
  framework: Framework;
  notes: UpgradeNotes[];
  files: FileChange[];
  skippedFiles: SkippedFile[];
  dependencies: DependencyChange[];
  keptDependencies: KeptDependency[];
  migrations: AppliedMigration[];
  commits: string[];
  changelogUrl: string;
}
