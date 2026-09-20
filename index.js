import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import * as clack from "@clack/prompts";
import {
  FRAMEWORKS,
  TEMPLATES,
  baseBiomeJsonText,
  baseBiomeJsonTextV2,
  baseComponentsJson,
  baseNpmrc,
  basePnpmWorkspaceYaml,
  mergeGitignore,
  normalizePackageJson,
  patchViteConfig,
  scaffoldBiomeMajor,
  templateDeps,
  templatePage,
  themeCss,
  utilsTs,
  viteMainTsx,
} from "./lib/base.js";
import {
  PNPM_VERSION,
  isPnpmAvailable,
  pnpmInstallInstructions,
  removeForeignLockfiles,
  runPnpm,
} from "./lib/pnpm.js";
import { runScaffold, scaffoldCommands } from "./lib/scaffold.js";

const VERSION = "0.1.0";

export function parseArgs(argv) {
  const options = { framework: null, template: null, install: true };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--framework" || arg === "--template") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${arg} expects a value.`);
      if (arg === "--framework") options.framework = value;
      else options.template = value;
      i += 1;
    } else if (arg.startsWith("--framework=")) {
      options.framework = arg.slice("--framework=".length);
    } else if (arg.startsWith("--template=")) {
      options.template = arg.slice("--template=".length);
    } else if (arg === "--no-install") {
      options.install = false;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length > 1)
    throw new Error("Expected at most one project name.");
  options.projectName = positionals[0] ?? null;
  return options;
}

export function helpText() {
  return [
    "create-raulmoracode — scaffold a RaulMoraCode project (pnpm only)",
    "",
    "Usage:",
    "  pnpm create @raulmoracode my-app [--framework vite|next] [--template marketing|saas|portfolio] [--no-install]",
    "",
    "Options:",
    "  --framework <vite|next>      Project framework (default: prompt)",
    "  --template <name>            marketing | saas | portfolio (default: prompt)",
    "  --no-install                 Skip `pnpm install`",
    "  -h, --help                   Show this help",
    "  -v, --version                Show version",
    "",
    `All generated projects use pnpm ${PNPM_VERSION}, declare it via "packageManager",`,
    "ship pnpm-lock.yaml, and expose pnpm-only scripts: pnpm dev / build / check / format.",
  ].join("\n");
}

/** Pure validation: framework and template must be supported values. */
export function validateOptions(options) {
  if (!FRAMEWORKS.includes(options.framework)) {
    throw new Error(`--framework must be one of: ${FRAMEWORKS.join(", ")}.`);
  }
  if (!TEMPLATES.includes(options.template)) {
    throw new Error(`--template must be one of: ${TEMPLATES.join(", ")}.`);
  }
}

function cancelled(exit) {
  clack.cancel("Operation cancelled.");
  exit(1);
}

async function promptMissing(options, exit) {
  if (
    (!options.projectName || !options.framework || !options.template) &&
    !process.stdin.isTTY
  ) {
    clack.cancel(
      "Non-interactive terminal: pass the project name and --framework/--template flags.",
    );
    exit(1);
    return false;
  }
  if (!options.projectName) {
    const name = await clack.text({
      message: "Project name",
      placeholder: "my-app",
      defaultValue: "my-app",
      validate: (value) =>
        value.trim().length === 0 ? "Project name cannot be empty" : undefined,
    });
    if (clack.isCancel(name)) {
      cancelled(exit);
      return false;
    }
    options.projectName = name.trim();
  }
  if (!options.framework) {
    const framework = await clack.select({
      message: "Choose your framework",
      options: [
        { value: "vite", label: "Vite + React", hint: "SPA" },
        { value: "next", label: "Next.js", hint: "App Router" },
      ],
    });
    if (clack.isCancel(framework)) {
      cancelled(exit);
      return false;
    }
    options.framework = framework;
  }
  if (!options.template) {
    const template = await clack.select({
      message: "Choose a template",
      options: [
        { value: "marketing", label: "Marketing", hint: "Landing site" },
        { value: "saas", label: "SaaS", hint: "Dashboard starter" },
        { value: "portfolio", label: "Portfolio", hint: "Personal site" },
      ],
    });
    if (clack.isCancel(template)) {
      cancelled(exit);
      return false;
    }
    options.template = template;
  }
  return true;
}

function isEmptyDir(dir) {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).length === 0;
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Apply the RaulMoraCode Project Base overlay on top of the framework scaffold. */
export function applyBaseOverlay({
  projectDir,
  projectName,
  framework,
  template,
}) {
  const pkgPath = join(projectDir, "package.json");
  const pkg = existsSync(pkgPath)
    ? JSON.parse(readFileSync(pkgPath, "utf8"))
    : {};
  writeJson(pkgPath, normalizePackageJson(pkg, { projectName, framework }));
  removeForeignLockfiles(projectDir);

  // Biome major follows the framework scaffold: Next.js installs Biome 2
  // (whose config schema is incompatible with v1), Vite gets our 1.9.4 pin.
  const biomeMajor = scaffoldBiomeMajor(pkg);
  if (biomeMajor >= 2) {
    const installed =
      pkg.devDependencies?.["@biomejs/biome"] ??
      pkg.dependencies?.["@biomejs/biome"];
    writeFileSync(
      join(projectDir, "biome.json"),
      baseBiomeJsonTextV2(installed),
    );
  } else {
    writeFileSync(join(projectDir, "biome.json"), baseBiomeJsonText());
  }

  if (!existsSync(join(projectDir, "components.json"))) {
    const components = baseComponentsJson();
    if (framework === "vite") {
      components.rsc = false;
      components.tailwind.css = "src/index.css";
    }
    writeJson(join(projectDir, "components.json"), components);
  }

  const npmrcPath = join(projectDir, ".npmrc");
  if (!existsSync(npmrcPath)) writeFileSync(npmrcPath, baseNpmrc());

  const workspacePath = join(projectDir, "pnpm-workspace.yaml");
  if (!existsSync(workspacePath))
    writeFileSync(workspacePath, basePnpmWorkspaceYaml());

  const gitignorePath = join(projectDir, ".gitignore");
  const existingGitignore = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";
  writeFileSync(gitignorePath, mergeGitignore(existingGitignore));

  const pageContent = templatePage({ template, framework });
  if (framework === "next") {
    const pagePath = join(projectDir, "src", "app", "page.tsx");
    mkdirSync(join(projectDir, "src", "app"), { recursive: true });
    writeFileSync(pagePath, pageContent);
    writeFileSync(join(projectDir, "src", "app", "globals.css"), themeCss());
  } else {
    const appPath = join(projectDir, "src", "App.tsx");
    mkdirSync(join(projectDir, "src"), { recursive: true });
    writeFileSync(appPath, pageContent);
    writeFileSync(join(projectDir, "src", "main.tsx"), viteMainTsx());
    writeFileSync(join(projectDir, "src", "index.css"), themeCss());
    const staleCss = join(projectDir, "src", "App.css");
    if (existsSync(staleCss)) rmSync(staleCss, { force: true });
    const viteConfig = join(projectDir, "vite.config.ts");
    if (existsSync(viteConfig)) {
      const { patched, changed } = patchViteConfig(
        readFileSync(viteConfig, "utf8"),
      );
      if (changed) writeFileSync(viteConfig, patched);
    }
  }

  mkdirSync(join(projectDir, "src", "lib"), { recursive: true });
  writeFileSync(join(projectDir, "src", "lib", "utils.ts"), utilsTs());
}

export async function run(argv, cwd, exit) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`Error: ${error.message}\n\n${helpText()}`);
    exit(1);
    return;
  }
  if (options.help) {
    console.log(helpText());
    exit(0);
    return;
  }
  if (options.version) {
    console.log(VERSION);
    exit(0);
    return;
  }

  const pnpmVersion = isPnpmAvailable();
  if (!pnpmVersion) {
    console.error(pnpmInstallInstructions());
    exit(1);
    return;
  }

  clack.intro("create-raulmoracode");
  const prompted = await promptMissing(options, exit);
  if (!prompted) return;

  try {
    validateOptions(options);
  } catch (error) {
    clack.cancel(`Error: ${error.message}`);
    exit(1);
    return;
  }

  const projectDir = resolve(cwd, options.projectName);
  if (existsSync(projectDir) && !isEmptyDir(projectDir)) {
    clack.cancel(
      `Error: directory "${options.projectName}" already exists and is not empty.`,
    );
    exit(1);
    return;
  }
  if (existsSync(projectDir) && statSync(projectDir).isFile()) {
    clack.cancel(`Error: "${options.projectName}" exists and is a file.`);
    exit(1);
    return;
  }
  mkdirSync(projectDir, { recursive: true });

  const spin = clack.spinner();
  spin.start(
    `Scaffolding ${options.framework} + ${options.template} with pnpm ${pnpmVersion}...`,
  );
  const scaffold = scaffoldCommands({
    framework: options.framework,
    projectName: options.projectName,
    projectDir,
  });
  // Run from the parent dir: official scaffolds create the target folder themselves.
  // The folder already exists (we created it); most scaffolds tolerate an empty dir.
  const code = runScaffold(scaffold);
  if (code !== 0) {
    spin.stop("Scaffolding failed.", 1);
    clack.cancel("Remove the directory and try again.");
    exit(1);
    return;
  }
  spin.stop("Scaffold ready. Applying RaulMoraCode Project Base...");

  applyBaseOverlay({
    projectDir,
    projectName: options.projectName,
    framework: options.framework,
    template: options.template,
  });

  if (options.install) {
    const deps = templateDeps(options.framework);
    const installSpin = clack.spinner();
    if (deps.prod.length > 0) {
      installSpin.start("Adding project dependencies with pnpm...");
      if (runPnpm(["add", ...deps.prod], projectDir) !== 0) {
        installSpin.stop("`pnpm add` failed.", 1);
        clack.cancel("Run it manually inside the project directory.");
        exit(1);
        return;
      }
      installSpin.stop("Project dependencies added.");
    }
    if (deps.dev.length > 0) {
      installSpin.start("Adding dev dependencies with pnpm...");
      if (runPnpm(["add", "-D", ...deps.dev], projectDir) !== 0) {
        installSpin.stop("`pnpm add -D` failed.", 1);
        clack.cancel("Run it manually inside the project directory.");
        exit(1);
        return;
      }
      installSpin.stop("Dev dependencies added.");
    }
    installSpin.start("Installing dependencies with pnpm...");
    const installCode = runPnpm(["install"], projectDir);
    if (installCode !== 0) {
      installSpin.stop("`pnpm install` failed.", 1);
      clack.cancel("Run it manually inside the project directory.");
      exit(1);
      return;
    }
    installSpin.stop("Dependencies installed.");
    installSpin.start("Normalizing formatting with Biome...");
    runPnpm(["exec", "biome", "check", "--write", "."], projectDir);
    installSpin.stop("Formatting normalized.");
  }

  clack.note(
    [
      `cd ${options.projectName}`,
      ...(options.install ? [] : ["pnpm install"]),
      "pnpm dev",
      "",
      "pnpm dev      Start the dev server",
      "pnpm build    Build for production",
      "pnpm check    Lint with Biome",
      "pnpm format   Format with Biome",
      "",
      "pnpm dlx shadcn@latest add @raulmoracode/navbar",
    ].join("\n"),
    "Next steps (pnpm only)",
  );
  clack.outro("Your RaulMoraCode project is ready (pnpm-only).");
  exit(0);
}
