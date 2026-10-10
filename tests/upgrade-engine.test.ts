import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TechSelection } from "../src/config/tech.js";
import type { PackageJson } from "../src/frameworks/types.js";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    success: vi.fn(),
    message: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    info: vi.fn(),
  },
  tasks: vi.fn(
    async (
      list: Array<{
        task: (message: (text: string) => void) => Promise<string>;
      }>,
    ) => {
      const results: string[] = [];
      for (const entry of list) {
        results.push(await entry.task(() => {}));
      }
      return results;
    },
  ),
  select: vi.fn(async () => "vite"),
  multiselect: vi.fn(async () => []),
  text: vi.fn(async () => ""),
  confirm: vi.fn(async () => true),
  cancel: vi.fn(),
  isCancel: () => false,
}));

vi.mock("../src/upgrade/pr-body.js", () => ({
  upgradePrTitle: (report: { toVersion: string }) =>
    `chore: upgrade raulmoracode-create to ${report.toVersion}`,
  upgradePrBody: (report: unknown) => `PR BODY\n${JSON.stringify(report)}`,
}));

import { confirm, log } from "@clack/prompts";
import { VERSION } from "../src/cli/args.js";
import { runUpgrade } from "../src/cli/upgrade.js";
import { viteFramework } from "../src/frameworks/vite.js";
import { collectManagedFileHashes } from "../src/generators/configure-manifest.js";
import { writeProjectManifest } from "../src/upgrade/apply.js";
import {
  managedDependencyPins,
  managedFiles,
} from "../src/upgrade/managed-files.js";
import {
  hashContent,
  parseManifest,
  serializeManifest,
} from "../src/upgrade/manifest.js";
import { buildUpgradePlan } from "../src/upgrade/plan.js";
import { readProjectState } from "../src/upgrade/state.js";
import {
  MANIFEST_FILE,
  MANIFEST_VERSION,
  type ProjectManifest,
} from "../src/upgrade/types.js";
import { ExecError } from "../src/utils/exec.js";

const SELECTION: TechSelection = {
  tailwind: false,
  shadcn: false,
  theme: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: true,
  testing: false,
  husky: true,
  vscode: false,
};

const PREVIOUS_CLI_VERSION = "1.0.6";
const _PREVIOUS_PNPM_VERSION = "12.5.0";
const PREVIOUS_BIOME_VERSION = "2.5.0";
const PR_URL = "https://github.com/raulmoracode/my-app/pull/7";

const errorMock = log.error as unknown as ReturnType<typeof vi.fn>;
const warnMock = log.warn as unknown as ReturnType<typeof vi.fn>;
const infoMock = log.info as unknown as ReturnType<typeof vi.fn>;
const successMock = log.success as unknown as ReturnType<typeof vi.fn>;
const confirmMock = confirm as unknown as ReturnType<typeof vi.fn>;

const originalCwd = process.cwd();
let workDir = "";
let projectDir = "";
let exitSpy: ReturnType<typeof vi.spyOn>;

const requireAuth = vi.fn(async () => {});
const findOpenPullRequest = vi.fn(async () => null as string | null);
const createPullRequest = vi.fn(async () => PR_URL);
const detectDefaultBranch = vi.fn(async () => "main");

const deps = {
  gh: { requireAuth, findOpenPullRequest, createPullRequest },
  detectDefaultBranch,
};

interface ExecStub {
  status?: string;
  origin?: string;
  branch?: string;
  failOn?: (command: string, args: string[]) => boolean;
}

function mockExec(stub: ExecStub = {}): void {
  execMock.mockImplementation(async (command: string, args: string[]) => {
    const line = `${command} ${args.join(" ")}`.trim();
    if (stub.failOn?.(command, args)) {
      throw new ExecError({
        command,
        args,
        code: 1,
        signal: null,
        stdout: "",
        stderr: "boom",
      });
    }
    if (line === "pnpm --version") {
      return { code: 0, stdout: "12.6.0\n", stderr: "" };
    }
    if (line === "git --version") {
      return { code: 0, stdout: "git version 2.50.0\n", stderr: "" };
    }
    if (line === "git rev-parse --show-toplevel") {
      return { code: 0, stdout: `${projectDir}\n`, stderr: "" };
    }
    if (line === "git status --porcelain") {
      return { code: 0, stdout: stub.status ?? "", stderr: "" };
    }
    if (line === "git remote get-url origin") {
      return {
        code: 0,
        stdout: `${stub.origin ?? "https://github.com/raulmoracode/my-app.git"}\n`,
        stderr: "",
      };
    }
    if (line === "git rev-parse --abbrev-ref HEAD") {
      return { code: 0, stdout: `${stub.branch ?? "main"}\n`, stderr: "" };
    }
    return { code: 0, stdout: "", stderr: "" };
  });
}

function calledCommands(): string[] {
  return execMock.mock.calls.map(([command, args]: [string, string[]]) =>
    `${command} ${args.join(" ")}`.trim(),
  );
}

function gitCommands(): string[] {
  return calledCommands().filter((line) => line.startsWith("git "));
}

async function writeFileAt(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

interface FixtureOptions {
  cliVersion?: string;
  selection?: TechSelection;
  files?: Record<string, string>;
  staleFiles?: string[];
  /** Managed paths recorded in the manifest but absent from disk. */
  missingFiles?: string[];
  packageJson?: PackageJson;
  skipManifest?: boolean;
  skipFiles?: boolean;
}

async function createProjectFixture(
  options: FixtureOptions = {},
): Promise<ProjectManifest> {
  const selection = options.selection ?? SELECTION;
  const templates = managedFiles("vite", selection);
  const files = options.files ?? templates;
  const missing = new Set(options.missingFiles ?? []);

  if (!options.skipFiles) {
    for (const [path, content] of Object.entries(files)) {
      if (missing.has(path)) {
        continue;
      }
      await writeFileAt(join(projectDir, path), content);
    }
  }

  const manifest: ProjectManifest = {
    manifestVersion: MANIFEST_VERSION,
    cliVersion: options.cliVersion ?? PREVIOUS_CLI_VERSION,
    framework: "vite",
    selection,
    projectName: "my-app",
    githubUrl: "https://github.com/raulmoracode/my-app",
    files: Object.fromEntries(
      Object.entries(templates).map(([path, content]) => [
        path,
        (options.staleFiles ?? []).includes(path)
          ? hashContent(`stale ${path}`)
          : hashContent(content),
      ]),
    ),
    dependencies: {
      "@biomejs/biome": PREVIOUS_BIOME_VERSION,
      "@commitlint/cli": "21.2.3",
      "@commitlint/config-conventional": "21.2.3",
      husky: "9.1.7",
      typescript: "7.0.2",
    },
  };

  await writeFileAt(
    join(projectDir, "package.json"),
    `${JSON.stringify(
      {
        name: "my-app",
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "tsc -b && vite build" },
        dependencies: { react: "19.2.0", "react-dom": "19.2.0" },
        devDependencies: {
          "@biomejs/biome": PREVIOUS_BIOME_VERSION,
          "@types/react": "19.2.0",
          husky: "9.1.7",
          typescript: "7.0.2",
          vite: "8.3.1",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFileAt(
    join(projectDir, "pnpm-workspace.yaml"),
    "minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - 'vite@8.3.1'\n",
  );

  if (!options.skipManifest) {
    await writeFileAt(
      join(projectDir, MANIFEST_FILE),
      serializeManifest(manifest),
    );
  }

  return manifest;
}

async function listProjectFiles(): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        found.push(full.slice(projectDir.length + 1));
      }
    }
  };
  await walk(projectDir);
  return found.sort();
}

beforeEach(async () => {
  execMock.mockReset();
  errorMock.mockClear();
  warnMock.mockClear();
  infoMock.mockClear();
  successMock.mockClear();
  confirmMock.mockClear();
  requireAuth.mockClear();
  findOpenPullRequest.mockReset();
  findOpenPullRequest.mockResolvedValue(null);
  createPullRequest.mockReset();
  createPullRequest.mockResolvedValue(PR_URL);
  detectDefaultBranch.mockReset();
  detectDefaultBranch.mockResolvedValue("main");
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  workDir = await mkdtemp(join(tmpdir(), "raulmoracode-upgrade-"));
  projectDir = join(workDir, "my-app");
  await mkdir(projectDir, { recursive: true });
  process.chdir(projectDir);
  mockExec();
});

afterEach(async () => {
  exitSpy.mockRestore();
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

describe("runUpgrade", () => {
  it("runs the exact ordered git sequence and opens a ready-for-review pull request", async () => {
    await createProjectFixture();

    await runUpgrade({ verbose: false, deps });

    expect(gitCommands()).toEqual([
      "git --version",
      "git rev-parse --show-toplevel",
      "git status --porcelain",
      "git remote get-url origin",
      "git rev-parse --abbrev-ref HEAD",
      "git fetch origin",
      `git switch -c chore/raulmoracode-update-${VERSION} origin/main`,
      "git add .",
      `git commit -m chore: upgrade raulmoracode-create to ${VERSION}`,
      `git push -u origin chore/raulmoracode-update-${VERSION}`,
      "git switch main",
    ]);
    expect(calledCommands().filter((line) => line.startsWith("pnpm "))).toEqual(
      [
        "pnpm --version",
        "pnpm list --depth Infinity --json",
        "pnpm install --no-frozen-lockfile",
        "pnpm exec biome check --write .",
      ],
    );
    expect(createPullRequest).toHaveBeenCalledTimes(1);
    const prOptions = createPullRequest.mock.calls[0]?.[0];
    expect(prOptions).toMatchObject({
      cwd: projectDir,
      base: "main",
      head: `chore/raulmoracode-update-${VERSION}`,
      title: `chore: upgrade raulmoracode-create to ${VERSION}`,
      verbose: false,
    });
    expect(String(prOptions?.body)).toContain("PR BODY");
    expect(exitSpy).not.toHaveBeenCalled();
    expect(String(successMock.mock.calls[0]?.[0])).toContain(PR_URL);
  });

  it("never uses destructive git args and never marks the pull request as draft", async () => {
    await createProjectFixture();

    await runUpgrade({ verbose: false, deps });

    const forbidden = ["--force", "-f", "reset", "clean", "--draft"];
    for (const [_command, args] of execMock.mock.calls as Array<
      [string, string[]]
    >) {
      for (const arg of args) {
        expect(forbidden).not.toContain(arg);
      }
    }
    const deletedBranches = calledCommands().filter((line) =>
      line.startsWith("git branch"),
    );
    expect(deletedBranches).toEqual([]);
    expect(
      String(createPullRequest.mock.calls[0]?.[0]?.body ?? ""),
    ).not.toContain("--draft");
  });

  it("bumps the pins, merges the workspace file and rewrites the manifest", async () => {
    await createProjectFixture();

    await runUpgrade({ verbose: false, deps });

    const pkg = JSON.parse(
      await readFile(join(projectDir, "package.json"), "utf8"),
    ) as PackageJson;
    expect(pkg.devDependencies?.["@biomejs/biome"]).toBe("2.5.14");
    expect(pkg.devDependencies?.typescript).toBe("7.0.2");
    expect(pkg.devDependencies?.vite).toBe("8.3.1");
    expect(pkg.packageManager).toBe("pnpm@12.6.0");
    expect(pkg.engines).toEqual({ node: ">=24" });
    expect(pkg.scripts?.prepare).toBe("husky");
    expect(pkg.scripts?.dev).toBe("vite");
    expect(pkg.private).toBe(true);

    const workspace = await readFile(
      join(projectDir, "pnpm-workspace.yaml"),
      "utf8",
    );
    expect(workspace).toContain("minimumReleaseAge: 10080");
    expect(workspace).toContain("- '@biomejs/biome@2.5.14'");
    expect(workspace).toContain("- 'vite@8.3.1'");

    const rewritten = parseManifest(
      await readFile(join(projectDir, MANIFEST_FILE), "utf8"),
    );
    expect(rewritten.cliVersion).toBe(VERSION);
    expect(rewritten.dependencies).toEqual(
      managedDependencyPins("vite", SELECTION),
    );
    for (const [path, content] of Object.entries(
      managedFiles("vite", SELECTION),
    )) {
      expect(rewritten.files[path]).toBe(hashContent(content));
    }
  });

  it("splits the overwritten files into a second commit and warns about them", async () => {
    const templates = managedFiles("vite", SELECTION);
    await createProjectFixture({
      files: { ...templates, "AGENTS.md": "my own agents file" },
      staleFiles: ["AGENTS.md"],
    });

    await runUpgrade({ verbose: false, deps });

    const commits = calledCommands().filter((line) =>
      line.startsWith("git commit"),
    );
    expect(commits).toEqual([
      `git commit -m chore: upgrade raulmoracode-create to ${VERSION}`,
      "git commit -m chore: overwrite locally modified files",
    ]);
    expect(calledCommands()).toContain("git restore --staged -- AGENTS.md");
    expect(calledCommands()).toContain("git add -- AGENTS.md");
    expect(
      gitCommands().indexOf("git restore --staged -- AGENTS.md"),
    ).toBeLessThan(
      commits.length ? gitCommands().indexOf(commits[0] as string) : -1,
    );
    const warning = warnMock.mock.calls
      .map((call) => String(call[0]))
      .find((message) => message.includes("Se sobrescribirá"));
    expect(warning).toContain("AGENTS.md");
    expect(warning).toContain("chore: overwrite locally modified files");
    expect(await readFile(join(projectDir, "AGENTS.md"), "utf8")).toBe(
      templates["AGENTS.md"],
    );
    const body = String(createPullRequest.mock.calls[0]?.[0]?.body ?? "");
    expect(body).toContain("my own agents file");
    expect(body).toContain("chore: overwrite locally modified files");
  });

  it("stops with exit 1 and writes nothing when the working tree is dirty", async () => {
    await createProjectFixture();
    const before = await listProjectFiles();
    mockExec({ status: " M src/main.tsx" });

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(String(errorMock.mock.calls[0]?.[0])).toContain(
      "El árbol de trabajo tiene cambios sin confirmar",
    );
    expect(String(errorMock.mock.calls[0]?.[0])).toContain("src/main.tsx");
    expect(await listProjectFiles()).toEqual(before);
    expect(gitCommands()).not.toContain(
      `git switch -c chore/raulmoracode-update-${VERSION} origin/main`,
    );
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it("stops with exit 1 when the project has no manifest", async () => {
    await createProjectFixture({ skipManifest: true });
    const before = await listProjectFiles();

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(String(errorMock.mock.calls[0]?.[0])).toContain(
      `No se encontró ${MANIFEST_FILE}`,
    );
    expect(String(errorMock.mock.calls[0]?.[0])).toContain("1.0.8");
    expect(await listProjectFiles()).toEqual(before);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("stops with exit 1 when origin is not a GitHub remote", async () => {
    await createProjectFixture();
    mockExec({ origin: "https://gitlab.com/raulmoracode/my-app.git" });

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(String(errorMock.mock.calls[0]?.[0])).toContain(
      "El remoto 'origin' no apunta a GitHub",
    );
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("stops with exit 1 when gh is not authenticated", async () => {
    await createProjectFixture();
    requireAuth.mockRejectedValueOnce(new Error("gh auth status: 1"));

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(String(errorMock.mock.calls[0]?.[0])).toContain("gh auth login");
    expect(gitCommands()).not.toContain("git fetch origin");
  });

  it("reports an up-to-date project without writing or prompting", async () => {
    await createProjectFixture({ cliVersion: VERSION });
    const before = await listProjectFiles();

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(String(successMock.mock.calls[0]?.[0])).toContain(
      "ya está actualizado",
    );
    expect(await listProjectFiles()).toEqual(before);
    expect(gitCommands()).not.toContain("git fetch origin");
  });

  it("asks the user to update the CLI when the manifest is newer", async () => {
    await createProjectFixture({ cliVersion: "99.0.0" });
    const before = await listProjectFiles();

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(String(warnMock.mock.calls[0]?.[0])).toContain("99.0.0");
    expect(String(infoMock.mock.calls[0]?.[0])).toContain(
      "npm install -g @raulmoracode/create@latest",
    );
    expect(await listProjectFiles()).toEqual(before);
  });

  it("stops when an open pull request already exists for the branch", async () => {
    await createProjectFixture();
    findOpenPullRequest.mockResolvedValueOnce(PR_URL);
    const before = await listProjectFiles();

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(String(warnMock.mock.calls[0]?.[0])).toContain(PR_URL);
    expect(await listProjectFiles()).toEqual(before);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it("writes nothing when the confirmation is declined", async () => {
    await createProjectFixture();
    confirmMock.mockResolvedValueOnce(false);
    const before = await listProjectFiles();

    await runUpgrade({ verbose: false, deps });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(String(infoMock.mock.calls.at(-1)?.[0])).toContain("cancelada");
    expect(await listProjectFiles()).toEqual(before);
    expect(
      calledCommands().filter((line) => line.startsWith("git ")),
    ).not.toContain("git add .");
  });

  it("rolls back to the original branch and drops it when the install fails", async () => {
    await createProjectFixture();
    mockExec({
      failOn: (command, args) => command === "pnpm" && args[0] === "install",
    });

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(gitCommands()).toEqual([
      "git --version",
      "git rev-parse --show-toplevel",
      "git status --porcelain",
      "git remote get-url origin",
      "git rev-parse --abbrev-ref HEAD",
      "git fetch origin",
      `git switch -c chore/raulmoracode-update-${VERSION} origin/main`,
      "git switch main",
      "git restore -- package.json pnpm-lock.yaml pnpm-workspace.yaml raulmoracode.json",
      `git branch -D chore/raulmoracode-update-${VERSION}`,
    ]);
    expect(calledCommands().some((line) => line.includes("git push"))).toBe(
      false,
    );
    expect(String(warnMock.mock.calls.at(-1)?.[0])).toContain(
      "rama incompleta",
    );
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it("reverts the files it wrote and drops the branch when a step fails", async () => {
    const templates = managedFiles("vite", SELECTION);
    await createProjectFixture({
      files: { ...templates, "AGENTS.md": "my own agents file" },
      staleFiles: ["AGENTS.md"],
    });
    mockExec({
      failOn: (command, args) => command === "pnpm" && args[0] === "install",
    });

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(calledCommands()).toContain(
      "git restore -- AGENTS.md package.json pnpm-lock.yaml pnpm-workspace.yaml raulmoracode.json",
    );
    expect(calledCommands().some((line) => line.startsWith("git add"))).toBe(
      false,
    );
    expect(calledCommands().some((line) => line.startsWith("git commit"))).toBe(
      false,
    );
    expect(calledCommands()).toContain(
      `git branch -D chore/raulmoracode-update-${VERSION}`,
    );
    expect(gitCommands().indexOf("git switch main")).toBeLessThan(
      gitCommands().indexOf(
        `git branch -D chore/raulmoracode-update-${VERSION}`,
      ),
    );
  });

  it("keeps the branch and prints the retry commands when the push fails", async () => {
    await createProjectFixture();
    mockExec({
      failOn: (command, args) => command === "git" && args[0] === "push",
    });

    await runUpgrade({ verbose: false, deps });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(gitCommands()).toEqual([
      "git --version",
      "git rev-parse --show-toplevel",
      "git status --porcelain",
      "git remote get-url origin",
      "git rev-parse --abbrev-ref HEAD",
      "git fetch origin",
      `git switch -c chore/raulmoracode-update-${VERSION} origin/main`,
      "git add .",
      `git commit -m chore: upgrade raulmoracode-create to ${VERSION}`,
      `git push -u origin chore/raulmoracode-update-${VERSION}`,
      "git switch main",
    ]);
    expect(gitCommands().some((line) => line.startsWith("git branch"))).toBe(
      false,
    );
    const hint = warnMock.mock.calls
      .map((call) => String(call[0]))
      .find((message) => message.includes("gh pr create"));
    expect(hint).toContain(
      `git push -u origin chore/raulmoracode-update-${VERSION}`,
    );
    expect(hint).toContain("gh pr create --base main --head");
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it("uses the detected default branch as the pull request base", async () => {
    await createProjectFixture();
    detectDefaultBranch.mockResolvedValueOnce("trunk");

    await runUpgrade({ verbose: false, deps });

    expect(detectDefaultBranch).toHaveBeenCalledWith(projectDir, false);
    expect(calledCommands()).toContain(
      `git switch -c chore/raulmoracode-update-${VERSION} origin/trunk`,
    );
    expect(createPullRequest.mock.calls[0]?.[0]).toMatchObject({
      base: "trunk",
    });
  });

  it("keeps only the CLI pins in the manifest dependencies", async () => {
    await createProjectFixture();

    await runUpgrade({ verbose: false, deps });

    const rewritten = parseManifest(
      await readFile(join(projectDir, MANIFEST_FILE), "utf8"),
    );
    expect(Object.keys(rewritten.dependencies).sort()).toEqual(
      Object.keys(managedDependencyPins("vite", SELECTION)).sort(),
    );
    expect(rewritten.dependencies["@biomejs/biome"]).toBe("2.5.14");
  });

  it("keeps locally deleted managed files out of the rewritten manifest", async () => {
    await createProjectFixture({ missingFiles: ["AGENTS.md", ".nvmrc"] });
    const before = await listProjectFiles();

    await runUpgrade({ verbose: false, deps });

    const rewritten = parseManifest(
      await readFile(join(projectDir, MANIFEST_FILE), "utf8"),
    );
    expect(rewritten.files["AGENTS.md"]).toBeUndefined();
    expect(rewritten.files[".nvmrc"]).toBeUndefined();
    expect(rewritten.files).toEqual(
      await collectManagedFileHashes(projectDir, viteFramework, SELECTION),
    );
    expect(await listProjectFiles()).toEqual(before);
    expect(before).not.toContain("AGENTS.md");
    expect(
      calledCommands().filter((line) => line.startsWith("git commit")),
    ).toEqual([
      `git commit -m chore: upgrade raulmoracode-create to ${VERSION}`,
    ]);
  });
});

describe("writeProjectManifest", () => {
  it("mirrors collectManagedFileHashes and skips the files absent from disk", async () => {
    const manifest = await createProjectFixture({
      missingFiles: ["AGENTS.md", ".github/workflows/ci.yml"],
      staleFiles: [".editorconfig"],
    });

    const state = await readProjectState(projectDir, manifest);
    const plan = buildUpgradePlan({
      manifest,
      toVersion: VERSION,
      state,
      templates: managedFiles("vite", SELECTION),
      migrations: [],
      notes: [],
    });
    const next = await writeProjectManifest(projectDir, plan);

    expect(next.files["AGENTS.md"]).toBeUndefined();
    expect(next.files[".github/workflows/ci.yml"]).toBeUndefined();
    expect(Object.keys(next.files).sort()).toEqual(
      Object.keys(
        await collectManagedFileHashes(projectDir, viteFramework, SELECTION),
      ).sort(),
    );
    expect(next.files).toEqual(
      await collectManagedFileHashes(projectDir, viteFramework, SELECTION),
    );
    // A file the user edited keeps the hash of what is on disk, not the template.
    expect(next.files[".editorconfig"]).toBe(
      hashContent(await readFile(join(projectDir, ".editorconfig"), "utf8")),
    );
    expect(next.cliVersion).toBe(VERSION);
    expect(next.framework).toBe("vite");
    expect(next.projectName).toBe(manifest.projectName);
    expect(next.githubUrl).toBe(manifest.githubUrl);

    const written = parseManifest(
      await readFile(join(projectDir, MANIFEST_FILE), "utf8"),
    );
    expect(written).toEqual(next);
  });

  it("does not record a hash for a file a migration removed from the project", async () => {
    const manifest = await createProjectFixture();
    // A migration drops `.nvmrc`: the path leaves the templates the CLI renders
    // and the upgrade deletes the file from disk.
    const templates = Object.fromEntries(
      Object.entries(managedFiles("vite", SELECTION)).filter(
        ([path]) => path !== ".nvmrc",
      ),
    );

    const state = await readProjectState(projectDir, manifest);
    const plan = buildUpgradePlan({
      manifest,
      toVersion: VERSION,
      state,
      templates,
      migrations: [
        {
          id: "drop-nvmrc",
          version: "1.0.9",
          description: "drop .nvmrc",
          why: "no longer needed",
          handles: [".nvmrc"],
          run: async () => ({}),
        },
      ],
      notes: [],
    });
    expect(plan.files).toEqual([
      {
        path: ".nvmrc",
        status: "removed",
        previousContent: "24\n",
        nextContent: null,
      },
    ]);
    await rm(join(projectDir, ".nvmrc"), { force: true });

    const next = await writeProjectManifest(projectDir, plan);

    expect(next.files[".nvmrc"]).toBeUndefined();
    expect(next.files).toEqual(
      await collectManagedFileHashes(projectDir, viteFramework, SELECTION),
    );
    const raw = await readFile(join(projectDir, MANIFEST_FILE), "utf8");
    expect(raw).not.toContain(hashContent(""));
    expect(raw).not.toContain(hashContent("24\n"));
  });
});
