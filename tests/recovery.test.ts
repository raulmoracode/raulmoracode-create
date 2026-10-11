import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
  "theme",
  "tanstack-query",
  "zustand",
  "forms",
  "biome",
  "testing",
  "husky",
  "vscode",
];

const selectState = vi.hoisted(() => ({ calls: 0 }));

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
  select: vi.fn(async () => {
    selectState.calls += 1;
    return selectState.calls === 1 ? "vite" : "MIT";
  }),
  multiselect: vi.fn(async () => [...FULL_TECH]),
  text: vi.fn(),
  confirm: vi.fn(async () => false),
  cancel: vi.fn(),
  isCancel: () => false,
}));

import { log, text as promptText } from "@clack/prompts";
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

function versionOutput(command: string): string {
  return command === "pnpm" ? "12.6.0\n" : "git version 2.50.0\n";
}

beforeEach(async () => {
  execMock.mockReset();
  selectState.calls = 0;
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
    mockAnswers(
      "half-baked",
      "https://github.com/raulmoracode/half-baked",
      "Raul Mora",
    );
    execMock.mockImplementation(async (command: string, args: string[]) => {
      if (args[0] === "--version") {
        return { code: 0, stdout: versionOutput(command), stderr: "" };
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
      mockAnswers(
        "empty-again",
        "https://github.com/raulmoracode/empty-again",
        "Raul Mora",
      );
      execMock.mockImplementation(async (command: string, args: string[]) => {
        if (args[0] === "--version") {
          return { code: 0, stdout: versionOutput(command), stderr: "" };
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

describe("run() completes when main protection fails", () => {
  itNode24(
    "best-effort: protection failure warns and the scaffold finishes with exit 0",
    async () => {
      const warnMock = log.warn as unknown as ReturnType<typeof vi.fn>;
      warnMock.mockClear();

      let ghApiCalled = false;
      let rulesetBodyFile = "";

      mockAnswers("protected", "https://github.com/raulmoracode/protected");

      execMock.mockImplementation(async (command: string, args: string[]) => {
        if (args[0] === "--version") {
          return { code: 0, stdout: versionOutput(command), stderr: "" };
        }
        if (command === "git" && args[0] === "config") {
          return { code: 0, stdout: "Test User\n", stderr: "" };
        }
        if (command === "git" && args[0] === "ls-remote") {
          return { code: 0, stdout: "", stderr: "" };
        }
        // The mocked `pnpm create` scaffolds what the real one leaves on disk:
        // a package.json for configureSite/patchPackageJson/configureReadme and
        // an index.html for configureBranding. Everything else the generators
        // write, so the full run() can reach the push + protection steps.
        if (command === "pnpm" && args[0] === "create") {
          const name = args[2] as string;
          const projectDir = join(workDir, name);
          await mkdir(projectDir, { recursive: true });
          await writeFile(join(projectDir, "package.json"), "{}\n");
          await writeFile(
            join(projectDir, "index.html"),
            [
              "<!doctype html>",
              '<html lang="en">',
              "  <head>",
              '    <meta charset="UTF-8" />',
              "    <title>Vite + React + TS</title>",
              '    <link rel="icon" type="image/svg+xml" href="/vite.svg" />',
              "  </head>",
              "  <body>",
              '    <div id="root"></div>',
              "  </body>",
              "</html>",
              "",
            ].join("\n"),
          );
          return { code: 0, stdout: "", stderr: "" };
        }
        if (command === "gh" && args[0] === "auth") {
          return { code: 0, stdout: "Logged in to github.com\n", stderr: "" };
        }
        if (command === "gh" && args[0] === "api") {
          ghApiCalled = true;
          rulesetBodyFile = args[args.indexOf("--input") + 1] as string;
          // The API rejects (e.g. HTTP 422) — run() must warn and continue.
          throw new ExecError({
            command,
            args,
            code: 1,
            signal: null,
            stdout: "",
            stderr: "HTTP 422: Validation failed",
          });
        }
        return { code: 0, stdout: "", stderr: "" };
      });

      await run({ verbose: false });

      expect(ghApiCalled).toBe(true);
      expect(exitSpy).not.toHaveBeenCalled();
      // The project is complete: the generated dir survives and the push ran.
      expect(existsSync(join(workDir, "protected"))).toBe(true);
      // The exact manual command reached the user as a warning, not an error.
      const warned = String(warnMock.mock.calls[0]?.[0]);
      expect(warned).toContain("no se pudo proteger la rama main");
      expect(warned).toContain("repos/raulmoracode/protected/rulesets");
      expect(warned).toContain('"validate"');
      // The ruleset temp body was cleaned up despite the failure.
      expect(existsSync(rulesetBodyFile)).toBe(false);
    },
  );
});
