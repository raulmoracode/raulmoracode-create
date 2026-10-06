import { registryScopeExcludes } from "../config/components.js";
import {
  collectLockedPackages,
  mergePnpmWorkspaceYaml,
} from "../config/pnpm-workspace.js";
import {
  PROJECT_MARKER_FILE,
  projectMarker,
} from "../config/project-marker.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../config/tech.js";
import type { PackageJson, ProjectFramework } from "../frameworks/types.js";
import { MIGRATION_IDS } from "../migrations/index.js";
import { exec } from "../utils/exec.js";
import {
  joinPath,
  readJsonFile,
  readTextFile,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";

export const PNPM_VERSION = "12.6.0";

export const CLASS_VARIANCE_AUTHORITY_VERSION = "0.7.1";

/** Required by the `@raulmoracode` theme globals (only with the theme). */
export const TW_ANIMATE_CSS_VERSION = "1.4.0";

export const HUSKY_VERSION = "9.1.7";
export const COMMITLINT_CLI_VERSION = "21.2.3";
export const COMMITLINT_CONFIG_CONVENTIONAL_VERSION = "21.2.3";

export function runtimeDependencies(
  selection: TechSelection = FULL_TECH_SELECTION,
): Record<string, string> {
  const dependencies: Record<string, string> = {};
  if (selection.zustand) {
    dependencies.zustand = "5.0.15";
  }
  if (selection.forms) {
    dependencies["react-hook-form"] = "7.89.0";
    dependencies.zod = "4.6.5";
  }
  if (selection["tanstack-query"]) {
    dependencies["@tanstack/react-query"] = "5.104.0";
  }
  return dependencies;
}

export function devDependencies(
  framework: ProjectFramework,
  selection: TechSelection = FULL_TECH_SELECTION,
): Record<string, string> {
  const common: Record<string, string> = {};
  if (selection.biome) {
    common["@biomejs/biome"] = "2.5.14";
  }
  if (selection.testing) {
    common.vitest = "5.0.2";
    common["@testing-library/react"] = "16.3.3";
    common["@testing-library/dom"] = "10.4.2";
    common.jsdom = "30.1.1";
  }
  if (selection.shadcn) {
    common.clsx = "2.1.1";
    common["tailwind-merge"] = "3.7.0";
    common["class-variance-authority"] = CLASS_VARIANCE_AUTHORITY_VERSION;
  }
  if (selection.husky) {
    common.husky = HUSKY_VERSION;
    common["@commitlint/cli"] = COMMITLINT_CLI_VERSION;
    common["@commitlint/config-conventional"] =
      COMMITLINT_CONFIG_CONVENTIONAL_VERSION;
  }
  if (selection.tailwind) {
    common.tailwindcss = "4.3.3";
  }
  if (selection.theme) {
    common["tw-animate-css"] = TW_ANIMATE_CSS_VERSION;
  }
  if (framework.id === "vite") {
    return selection.tailwind
      ? { ...common, "@tailwindcss/vite": "4.3.3" }
      : { ...common };
  }
  return selection.tailwind
    ? { ...common, "@tailwindcss/postcss": "4.3.3", postcss: "8.5.6" }
    : { ...common };
}

export function pnpmInstallArgs(): string[] {
  // Never frozen: patchPackageJson rewrites package.json after the official
  // scaffold (Next.js ships its own lockfile), so the lockfile is stale by
  // design here — and pnpm 12 defaults to frozen installs when CI=true.
  return ["install", "--no-frozen-lockfile"];
}

export function pnpmAddArgs(dependencies: Record<string, string>): string[] {
  return [
    "add",
    ...Object.entries(dependencies).map(
      ([name, version]) => `${name}@${version}`,
    ),
  ];
}

export function pnpmAddDevArgs(dependencies: Record<string, string>): string[] {
  return [
    "add",
    "-D",
    ...Object.entries(dependencies).map(
      ([name, version]) => `${name}@${version}`,
    ),
  ];
}

function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~]/, "");
}

export const PROJECT_AUTHOR = {
  name: "Raul Mora",
  url: "https://raulmoracode.com",
};

function projectScripts(
  framework: ProjectFramework,
  selection: TechSelection,
): Record<string, string> {
  const scripts: Record<string, string> = { ...framework.scripts() };
  if (!selection.biome) {
    delete scripts.check;
    delete scripts.format;
    delete scripts.lint;
  }
  if (!selection.testing) {
    delete scripts.test;
  }
  if (selection.husky) {
    scripts.prepare = "husky";
  }
  return scripts;
}

export async function patchPackageJson(
  projectDir: string,
  framework: ProjectFramework,
  projectName: string,
  githubUrl: string,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  const packageJsonPath = joinPath(projectDir, "package.json");
  const pkg = await readJsonFile<PackageJson>(packageJsonPath);

  pkg.name = projectName;
  pkg.version = "0.1.0";
  pkg.private = true;
  pkg.type = "module";
  pkg.author = { ...PROJECT_AUTHOR };
  pkg.homepage = githubUrl;
  pkg.repository = { type: "git", url: githubUrl };
  pkg.scripts = projectScripts(framework, selection);
  pkg.engines = { node: ">=24" };
  pkg.packageManager = `pnpm@${PNPM_VERSION}`;

  const dependencies = pkg.dependencies ?? {};
  for (const [name, version] of Object.entries(
    framework.pinnedDependencies(),
  )) {
    dependencies[name] = version;
  }
  const devDependenciesMap = pkg.devDependencies ?? {};
  for (const [name, version] of Object.entries(
    framework.pinnedDevDependencies(),
  )) {
    devDependenciesMap[name] = version;
  }
  if (selection.husky) {
    // Ensure `prepare: husky` can run on the first `pnpm install`.
    // Husky must already be listed, otherwise prepare fails with exit 127.
    devDependenciesMap.husky = HUSKY_VERSION;
    devDependenciesMap["@commitlint/cli"] = COMMITLINT_CLI_VERSION;
    devDependenciesMap["@commitlint/config-conventional"] =
      COMMITLINT_CONFIG_CONVENTIONAL_VERSION;
  }

  const removalPatterns = framework.removedDependencyPatterns();
  for (const key of Object.keys(dependencies)) {
    if (removalPatterns.some((pattern) => pattern.test(key))) {
      delete dependencies[key];
    }
  }
  for (const key of Object.keys(devDependenciesMap)) {
    if (removalPatterns.some((pattern) => pattern.test(key))) {
      delete devDependenciesMap[key];
    }
  }

  for (const map of [dependencies, devDependenciesMap]) {
    for (const [key, version] of Object.entries(map)) {
      map[key] = stripRangePrefix(version);
    }
  }

  const finalPkg: PackageJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    author: { ...PROJECT_AUTHOR },
    homepage: githubUrl,
    repository: { type: "git", url: githubUrl },
    scripts: projectScripts(framework, selection),
    engines: { node: ">=24" },
    packageManager: `pnpm@${PNPM_VERSION}`,
  };
  for (const [key, value] of Object.entries(pkg)) {
    if (!(key in finalPkg)) {
      finalPkg[key] = value;
    }
  }
  if (Object.keys(dependencies).length > 0) {
    finalPkg.dependencies = dependencies;
  }
  if (Object.keys(devDependenciesMap).length > 0) {
    finalPkg.devDependencies = devDependenciesMap;
  }

  await writeTextFile(
    packageJsonPath,
    `${JSON.stringify(finalPkg, null, 2)}\n`,
  );
}

export async function removeToolingConfig(
  projectDir: string,
  relativePaths: string[],
): Promise<void> {
  for (const relativePath of relativePaths) {
    await removeIfExists(joinPath(projectDir, relativePath));
  }
}

export async function installDependencies(
  projectDir: string,
  framework: ProjectFramework,
  verbose: boolean,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  await exec("pnpm", pnpmInstallArgs(), { cwd: projectDir, verbose });
  const runtime = runtimeDependencies(selection);
  if (Object.keys(runtime).length > 0) {
    await exec("pnpm", pnpmAddArgs(runtime), { cwd: projectDir, verbose });
  }
  const dev = devDependencies(framework, selection);
  if (Object.keys(dev).length > 0) {
    await exec("pnpm", pnpmAddDevArgs(dev), { cwd: projectDir, verbose });
  }
}

export function pinnedPackages(
  framework: ProjectFramework,
  selection: TechSelection = FULL_TECH_SELECTION,
): string[] {
  const entries: Array<[string, string]> = [
    ...Object.entries(framework.pinnedDependencies()),
    ...Object.entries(framework.pinnedDevDependencies()),
    ...Object.entries(runtimeDependencies(selection)),
    ...Object.entries(devDependencies(framework, selection)),
  ];
  return [...new Set(entries.map(([name, version]) => `${name}@${version}`))];
}

export function pnpmListJsonArgs(): string[] {
  return ["list", "--depth", "Infinity", "--json"];
}

export async function refreshPnpmWorkspaceExcludes(
  projectDir: string,
  framework: ProjectFramework,
  verbose: boolean,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  let locked: string[] = [];
  try {
    const result = await exec("pnpm", pnpmListJsonArgs(), {
      cwd: projectDir,
      verbose,
    });
    locked = collectLockedPackages(JSON.parse(result.stdout));
  } catch {
    locked = [];
  }
  const workspacePath = joinPath(projectDir, "pnpm-workspace.yaml");
  let existing: string | null = null;
  try {
    existing = await readTextFile(workspacePath);
  } catch {
    existing = null;
  }
  const excludes = [
    ...pinnedPackages(framework, selection),
    ...registryScopeExcludes(selection),
    ...locked,
  ];
  await writeTextFile(
    workspacePath,
    mergePnpmWorkspaceYaml(existing, excludes),
  );
}

export async function writeProjectMarker(
  projectDir: string,
  cliVersion: string,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, PROJECT_MARKER_FILE),
    projectMarker({ createdBy: cliVersion, migrations: MIGRATION_IDS }),
  );
}

export async function normalizePackageJson(projectDir: string): Promise<void> {
  const packageJsonPath = joinPath(projectDir, "package.json");
  const pkg = await readJsonFile<PackageJson>(packageJsonPath);
  const dependencies = pkg.dependencies ?? {};
  const devDependenciesMap = pkg.devDependencies ?? {};
  for (const map of [dependencies, devDependenciesMap]) {
    for (const [key, version] of Object.entries(map)) {
      map[key] = stripRangePrefix(version);
    }
  }
  pkg.dependencies = dependencies;
  pkg.devDependencies = devDependenciesMap;
  await writeTextFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
