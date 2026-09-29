import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

const FULL_TECH = [
  "tailwind",
  "shadcn",
  "tanstack-query",
  "zustand",
  "forms",
  "registry",
  "biome",
  "testing",
  "husky",
  "vscode",
];

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
  select: vi.fn(async () => "vite"),
  multiselect: vi.fn(async () => [...FULL_TECH]),
  text: vi.fn(),
  confirm: vi.fn(async () => false),
  cancel: vi.fn(),
  isCancel: () => false,
}));

import { text as promptText } from "@clack/prompts";
import { run, shouldRemoveProjectDir } from "../src/cli/run.js";
import { ExecError } from "../src/utils/exec.js";

function mockAnswers(...answers: string[]): void {
  const textMock = promptText as unknown as ReturnType<typeof vi.fn>;
  textMock.mockReset();
  for (const answer of answers) {
    textMock.mockImplementationOnce(async () => answer);
  }
}

const nodeMajor = Number(/^v?(\d+)/.exec(process.version)?.[1] ?? 0);
const itNode24 = nodeMajor >= 24 ? it : it.skip;

const originalCwd = process.cwd();
let workDir = "";
let exitSpy: ReturnType<typeof vi.spyOn>;

function execFailure(command: string, args: string[]): ExecError {
  return new ExecError({
    command,
    args,
    code: 1,
    signal: null,
    stdout: "",
    stderr: "boom",
  });
}

beforeEach(async () => {
  execMock.mockReset();
  delete process.env.GH_TOKEN;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  workDir = await mkdtemp(join(tmpdir(), "raulmoracode-recovery-"));
  process.chdir(workDir);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  exitSpy.mockRestore();
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

describe("shouldRemoveProjectDir", () => {
  it("cleans up on failures while the project is incomplete", () => {
    for (const step of [
      "Creating project",
      "Installing dependencies",
      "Initializing Git",
      "Configuring remote",
      "Creating initial commit",
    ]) {
      expect(shouldRemoveProjectDir(step)).toBe(true);
    }
  });

  it("keeps the directory when only the push failed", () => {
    expect(shouldRemoveProjectDir("Pushing to GitHub")).toBe(false);
  });

  it("has nothing to clean before any task ran", () => {
    expect(shouldRemoveProjectDir(null)).toBe(false);
  });
});

describe("run() failure recovery", () => {
  itNode24("removes the generated dir when a task fails midway", async () => {
    mockAnswers("half-baked", "https://github.com/raulmoracode/half-baked");
    execMock.mockImplementation(async (command: string, args: string[]) => {
      if (args[0] === "--version") {
        return { code: 0, stdout: "9.9.9\n", stderr: "" };
      }
      if (command === "git" && args[0] === "config") {
        return { code: 0, stdout: "Test User\n", stderr: "" };
      }
      if (command === "git" && args[0] === "ls-remote") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (command === "pnpm" && args[0] === "create") {
        return { code: 0, stdout: "", stderr: "" };
      }
      throw execFailure(command, args);
    });

    await run({ verbose: false });

    expect(exitSpy).toHaveBeenCalledWith(1);
    // Tailwind wrote files before branding failed reading index.html…
    // …and the recovery removed every trace of them.
    expect(existsSync(join(workDir, "half-baked"))).toBe(false);
  });

  itNode24(
    "restores a reused empty dir when failing before any task",
    async () => {
      await mkdir(join(workDir, "empty-again"), { recursive: true });
      mockAnswers("empty-again", "https://github.com/raulmoracode/empty-again");
      execMock.mockImplementation(async (command: string, args: string[]) => {
        if (args[0] === "--version") {
          return { code: 0, stdout: "9.9.9\n", stderr: "" };
        }
        if (command === "git" && args[0] === "config") {
          return { code: 0, stdout: "Test User\n", stderr: "" };
        }
        throw execFailure(command, args);
      });

      await run({ verbose: false });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(existsSync(join(workDir, "empty-again"))).toBe(true);
      expect(await readdir(join(workDir, "empty-again"))).toEqual([]);
    },
  );
});
