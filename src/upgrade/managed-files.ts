import { agentsMd } from "../config/agents.js";
import { biomeConfig } from "../config/biome.js";
import { ciWorkflowYaml } from "../config/ci.js";
import { commitlintConfig } from "../config/commitlint.js";
import { componentsJson } from "../config/components.js";
import { editorconfigContent } from "../config/editorconfig.js";
import { huskyCommitMsg, huskyPreCommit } from "../config/husky.js";
import { nvmrcContent } from "../config/nvmrc.js";
import { pullRequestTemplate } from "../config/pull-request.js";
import { nextPostcssConfig, viteTailwindConfig } from "../config/tailwind.js";
import type { TechSelection } from "../config/tech.js";
import { vitestConfig } from "../config/testing.js";
import { vscodeExtensions, vscodeSettings } from "../config/vscode.js";
import { getFramework } from "../frameworks/index.js";
import {
  devDependencies,
  PNPM_VERSION,
  projectScripts,
  runtimeDependencies,
} from "../generators/configure-project.js";
import type { Framework } from "../utils/validation.js";
import type { DependencyType } from "./types.js";

/** Managed files that must keep the executable bit after being written. */
export const EXECUTABLE_MANAGED_FILES = [
  ".husky/pre-commit",
  ".husky/commit-msg",
];

/**
 * Exact content of every file the CLI owns in a generated project, keyed by
 * POSIX path relative to the project root. Pure: it is the single source of
 * truth shared by project creation (manifest hashes), `upgrade` (re-render)
 * and the template snapshot test. Application code (`src/**`), `README.md`,
 * `CHANGELOG.md`, `LICENSE`, `package.json` and `pnpm-workspace.yaml` are
 * intentionally not listed (the last two are merged, not rendered).
 */
export function managedFiles(
  frameworkId: Framework,
  selection: TechSelection,
): Record<string, string> {
  const framework = getFramework(frameworkId);
  const files: Record<string, string> = {
    ".editorconfig": editorconfigContent(),
    ".nvmrc": nvmrcContent(),
    ".github/workflows/ci.yml": ciWorkflowYaml(),
    ".github/pull_request_template.md": pullRequestTemplate(),
    "AGENTS.md": agentsMd(),
  };
  if (selection.biome) {
    files["biome.json"] = biomeConfig();
  }
  if (selection.husky) {
    files[".husky/pre-commit"] = huskyPreCommit(selection);
    files[".husky/commit-msg"] = huskyCommitMsg();
    files["commitlint.config.ts"] = commitlintConfig();
  }
  if (selection.testing) {
    files["vitest.config.ts"] = vitestConfig();
  }
  if (selection.vscode) {
    files[".vscode/settings.json"] = vscodeSettings();
    files[".vscode/extensions.json"] = vscodeExtensions();
  }
  if (selection.shadcn) {
    files["components.json"] = componentsJson(
      framework.componentsJsonOptions(),
    );
  }
  if (selection.tailwind && frameworkId === "vite") {
    files["vite.config.ts"] = viteTailwindConfig();
  }
  if (selection.tailwind && frameworkId === "next") {
    files["postcss.config.mjs"] = nextPostcssConfig();
  }
  return files;
}

export interface ManagedPackageJson {
  scripts: Record<string, string>;
  packageManager: string;
  engines: Record<string, string>;
  dependencies: Record<DependencyType, Record<string, string>>;
}

/** The `package.json` fields the CLI owns (and `upgrade` keeps in sync). */
export function managedPackageJson(
  frameworkId: Framework,
  selection: TechSelection,
): ManagedPackageJson {
  const framework = getFramework(frameworkId);
  return {
    scripts: projectScripts(framework, selection),
    packageManager: `pnpm@${PNPM_VERSION}`,
    engines: { node: ">=24" },
    dependencies: {
      dependencies: {
        ...framework.pinnedDependencies(),
        ...runtimeDependencies(selection),
      },
      devDependencies: {
        ...framework.pinnedDevDependencies(),
        ...devDependencies(framework, selection),
      },
    },
  };
}

/** Flat `name → version` map of every pin, as stored in the manifest. */
export function managedDependencyPins(
  frameworkId: Framework,
  selection: TechSelection,
): Record<string, string> {
  const { dependencies } = managedPackageJson(frameworkId, selection);
  return { ...dependencies.dependencies, ...dependencies.devDependencies };
}
