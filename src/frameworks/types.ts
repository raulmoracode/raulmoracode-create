import type { TechSelection } from "../config/tech.js";
import type { Framework } from "../utils/validation.js";

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  author?: { name?: string; url?: string } | string;
  homepage?: string;
  repository?: { type?: string; url?: string } | string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  packageManager?: string;
  [key: string]: unknown;
}

export interface ProjectFramework {
  readonly id: Framework;
  readonly label: string;
  createProject(name: string, cwd: string, verbose: boolean): Promise<string>;
  scripts(): Record<string, string>;
  pinnedDependencies(): Record<string, string>;
  pinnedDevDependencies(): Record<string, string>;
  removedDependencyPatterns(): RegExp[];
  componentsJsonOptions(): { rsc: boolean; tailwindCssPath: string };
  configureTailwind(projectDir: string): Promise<void>;
  configureTanStackQuery(projectDir: string): Promise<void>;
  configureBranding(projectDir: string): Promise<void>;
  configureStarter?(
    projectDir: string,
    selection?: TechSelection,
  ): Promise<void>;
}
