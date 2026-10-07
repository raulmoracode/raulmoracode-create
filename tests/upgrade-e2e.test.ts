import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...(cwd ? { cwd } : {}) });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `exit ${code}`));
      }
    });
  });
}

const answers = vi.hoisted(() => [
  "upgrade-project",
  "https://github.com/raulmoracode/upgrade-project",
]);

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
      for (const item of list) {
        await item.task(vi.fn());
      }
    },
  ),
  select: vi.fn(async () => process.env.E2E_FRAMEWORK ?? "vite"),
  multiselect: vi.fn(async () => [
    "tailwind",
    "shadcn",
    "theme",
    "tanstack-query",
    "zustand",
    "forms",
    "biome",
    "testing",
    "husky",
    "vscode",
  ]),
  text: vi.fn(async () => answers.shift() ?? "upgrade-project"),
  confirm: vi.fn(async () => true),
  cancel: vi.fn(),
  isCancel: () => false,
}));

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

import { VERSION } from "../src/cli/args.js";
import { run } from "../src/cli/run.js";
import type { UpgradeDeps } from "../src/cli/upgrade.js";
import { runUpgrade } from "../src/cli/upgrade.js";
import type { ProjectManifest } from "../src/upgrade/types.js";

const OLD_CLI_VERSION = "1.0.0";
const GITHUB_REMOTE_URL = "https://github.com/raulmoracode/upgrade-project";

let bareRemote: string;
let gitConfigDir: string;
let workDir: string;
let projectDir = "";
let prBody = "";
let prTitleSeen = "";
let prBaseSeen = "";
let prHeadSeen = "";

function makeExecImplementation() {
  return async (command: string, args: string[], options: { cwd?: string }) => {
    if (command === "git") {
      if (args[0] === "ls-remote") {
        return { code: 0, stdout: "", stderr: "" };
      }
      // The preflight only accepts GitHub remotes; git itself uses the bare repo.
      if (args[0] === "remote" && args[1] === "get-url") {
        return { code: 0, stdout: `${GITHUB_REMOTE_URL}\n`, stderr: "" };
      }
      if (args[0] === "remote" && args[1] === "add") {
        return runCommand(
          "git",
          ["remote", "add", args[2] as string, bareRemote],
          options.cwd,
        );
      }
      return runCommand(command, args, options.cwd);
    }
    return runCommand(command, args, options.cwd);
  };
}

function hash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function failingExitSpy(): Promise<ReturnType<typeof vi.spyOn>> {
  const { log } = await import("@clack/prompts");
  return vi
    .spyOn(process, "exit")
    .mockImplementation((code?: string | number | null) => {
      const errors = (log.error as ReturnType<typeof vi.fn>).mock.calls
        .map(([message]) => String(message))
        .join("\n");
      throw new Error(
        `process.exit(${String(code)}): ${errors || "no log.error calls"}`,
      );
    });
}

describe("end-to-end upgrade of a generated project", () => {
  beforeAll(async () => {
    gitConfigDir = await mkdtemp(join(tmpdir(), "raulmoracode-upgrade-git-"));
    await writeFile(
      join(gitConfigDir, "gitconfig"),
      "[user]\n\tname = Raulmoracode Test\n\temail = test@raulmoracode.com\n",
    );
    process.env.GIT_CONFIG_GLOBAL = join(gitConfigDir, "gitconfig");
    bareRemote = await mkdtemp(join(tmpdir(), "raulmoracode-upgrade-remote-"));
    await runCommand("git", ["init", "--bare", "-b", "main"], bareRemote);
    workDir = await mkdtemp(join(tmpdir(), "raulmoracode-upgrade-work-"));
    process.chdir(workDir);
    execMock.mockImplementation(makeExecImplementation());

    const exitSpy = await failingExitSpy();
    try {
      await run({ verbose: false });
    } finally {
      exitSpy.mockRestore();
    }
    projectDir = join(workDir, "upgrade-project");
  }, 900_000);

  afterAll(async () => {
    delete process.env.GIT_CONFIG_GLOBAL;
    process.chdir("/");
    if (process.env.KEEP === "1") {
      console.log(`Keeping generated project at: ${projectDir}`);
      return;
    }
    await rm(gitConfigDir, { recursive: true, force: true });
    await rm(bareRemote, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  });

  it("generated the project with a manifest matching the files on disk", async () => {
    const raw = await readFile(join(projectDir, "raulmoracode.json"), "utf8");
    const manifest = JSON.parse(raw) as ProjectManifest;
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.cliVersion).toBe(VERSION);
    expect(manifest.projectName).toBe("upgrade-project");
    expect(manifest.files["biome.json"]).toBe(
      hash(await readFile(join(projectDir, "biome.json"), "utf8")),
    );
    expect(manifest.dependencies.husky).toBe("9.1.7");

    const tracked = await runCommand(
      "git",
      ["ls-files", "raulmoracode.json"],
      projectDir,
    );
    expect(tracked.stdout.trim()).toBe("raulmoracode.json");
  }, 60_000);

  it("rewinds the manifest, edits a managed file and runs the upgrade", async () => {
    process.chdir(projectDir);

    const manifestPath = join(projectDir, "raulmoracode.json");
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as ProjectManifest;
    manifest.cliVersion = OLD_CLI_VERSION;
    manifest.files = { ...manifest.files, "AGENTS.md": hash("stale\n") };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    // A local edit to a managed file: upgrade must overwrite it in place, never
    // leaving a `.new` sibling behind.
    const agentsPath = join(projectDir, "AGENTS.md");
    await writeFile(
      agentsPath,
      `${await readFile(agentsPath, "utf8")}\n## Local customization\n`,
    );
    await runCommand(
      "git",
      ["commit", "-am", "chore: local tweak"],
      projectDir,
    );
    // The upgrade branch starts from origin/main, so the rewind and the local
    // edit must be on the remote for the plan to see them.
    await runCommand("git", ["push", "origin", "main"], projectDir);

    const deps: Partial<UpgradeDeps> = {
      gh: {
        requireAuth: async () => {},
        findOpenPullRequest: async () => null,
        createPullRequest: async (options) => {
          prTitleSeen = options.title;
          prBody = options.body;
          prBaseSeen = options.base;
          prHeadSeen = options.head;
          return `${GITHUB_REMOTE_URL}/pull/7`;
        },
      },
      detectDefaultBranch: async () => "main",
    };

    const exitSpy = await failingExitSpy();
    try {
      await runUpgrade({ verbose: false, deps });
    } finally {
      exitSpy.mockRestore();
    }

    const branch = await runCommand(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      projectDir,
    );
    expect(branch.stdout.trim()).toBe("main");

    const upgradeBranch = `chore/raulmoracode-update-${VERSION}`;
    expect(prHeadSeen).toBe(upgradeBranch);
    expect(prBaseSeen).toBe("main");
    expect(prTitleSeen).toBe(
      `chore: upgrade raulmoracode-create to ${VERSION}`,
    );
    expect(prBody).toContain(`Upgrade raulmoracode-create ${OLD_CLI_VERSION}`);
    expect(prBody).toContain("## ⚠️ Overwritten files with local changes");
    expect(prBody).toContain("AGENTS.md");
    expect(prBody).not.toContain("--draft");
  }, 900_000);

  it("pushed the upgrade branch with two isolated commits", async () => {
    const upgradeBranch = `chore/raulmoracode-update-${VERSION}`;
    const log = await runCommand(
      "git",
      ["log", "--pretty=%s", `main..${upgradeBranch}`],
      projectDir,
    );
    expect(log.stdout.trim().split("\n")).toEqual([
      "chore: overwrite locally modified files",
      `chore: upgrade raulmoracode-create to ${VERSION}`,
    ]);

    const remoteBranches = await runCommand(
      "git",
      ["branch", "--list", upgradeBranch],
      bareRemote,
    );
    expect(remoteBranches.stdout).toContain(upgradeBranch);

    const branchManifest = await runCommand(
      "git",
      ["show", `${upgradeBranch}:raulmoracode.json`],
      projectDir,
    );
    expect(
      (JSON.parse(branchManifest.stdout) as ProjectManifest).cliVersion,
    ).toBe(VERSION);

    const onBranch = await runCommand(
      "git",
      ["show", `${upgradeBranch}:AGENTS.md`],
      projectDir,
    );
    expect(onBranch.stdout).not.toContain("Local customization");
    expect(onBranch.stdout).toContain("## Project guidelines");

    // The overwrite commit carries only the locally modified file.
    const files = (
      await runCommand(
        "git",
        ["show", "--name-only", "--pretty=", upgradeBranch],
        projectDir,
      )
    ).stdout.trim();
    expect(files).toBe("AGENTS.md");
    expect(existsSync(join(projectDir, "AGENTS.md.new"))).toBe(false);
  }, 120_000);

  it("is a no-op when the project is already up to date", async () => {
    const { log } = await import("@clack/prompts");
    (log.success as ReturnType<typeof vi.fn>).mockClear();

    // main still carries the rewound manifest, so the up-to-date check runs on
    // the upgrade branch, whose manifest already records the current version.
    const upgradeBranch = `chore/raulmoracode-update-${VERSION}`;
    await runCommand("git", ["switch", upgradeBranch], projectDir);

    const exitSpy = await failingExitSpy();
    try {
      await runUpgrade({
        verbose: false,
        deps: {
          gh: {
            requireAuth: async () => {},
            findOpenPullRequest: async () => {
              throw new Error("the plan must not be computed when up to date");
            },
            createPullRequest: async () => {
              throw new Error("no pull request must be created");
            },
          },
          detectDefaultBranch: async () => "main",
        },
      });
    } finally {
      exitSpy.mockRestore();
    }

    expect(
      (log.success as ReturnType<typeof vi.fn>).mock.calls.map(([message]) =>
        String(message),
      ),
    ).toContainEqual(expect.stringContaining("ya está actualizado"));

    const branch = await runCommand(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      projectDir,
    );
    expect(branch.stdout.trim()).toBe(upgradeBranch);
  }, 60_000);
});
