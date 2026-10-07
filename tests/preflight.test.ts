import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  tasks: vi.fn(),
  select: vi.fn(async () => "vite"),
  multiselect: vi.fn(async () => ["tailwind"]),
  text: vi.fn(),
  confirm: vi.fn(async () => false),
  cancel: vi.fn(),
  isCancel: () => false,
}));

import { log, text as promptText, select } from "@clack/prompts";
import { run } from "../src/cli/run.js";
import {
  PNPM_VERSION,
  REQUIRED_PNPM_MAJOR,
} from "../src/generators/configure-project.js";
import { ExecError } from "../src/utils/exec.js";

const nodeMajor = Number(/^v?(\d+)/.exec(process.version)?.[1] ?? 0);
const itNode24 = nodeMajor >= 24 ? it : it.skip;

const originalCwd = process.cwd();
let workDir = "";
let exitSpy: ReturnType<typeof vi.spyOn>;

const errorMock = log.error as unknown as ReturnType<typeof vi.fn>;
const selectMock = select as unknown as ReturnType<typeof vi.fn>;

function mockAnswers(...answers: string[]): void {
  const textMock = promptText as unknown as ReturnType<typeof vi.fn>;
  textMock.mockReset();
  for (const answer of answers) {
    textMock.mockImplementationOnce(async () => answer);
  }
}

function mockPnpmVersion(pnpmStdout: string): void {
  execMock.mockImplementation(async (command: string, args: string[]) => {
    if (command === "pnpm" && args[0] === "--version") {
      return { code: 0, stdout: pnpmStdout, stderr: "" };
    }
    if (command === "git" && args[0] === "--version") {
      return { code: 0, stdout: "git version 2.50.0\n", stderr: "" };
    }
    if (command === "git" && args[0] === "config") {
      return { code: 0, stdout: "Test User\n", stderr: "" };
    }
    throw new ExecError({
      command,
      args,
      code: 1,
      signal: null,
      stdout: "",
      stderr: "boom",
    });
  });
}

function calledCommands(): string[] {
  return execMock.mock.calls.map(
    ([command, args]: [string, string[]]) => `${command} ${args.join(" ")}`,
  );
}

beforeEach(async () => {
  execMock.mockReset();
  errorMock.mockClear();
  selectMock.mockClear();
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  workDir = await mkdtemp(join(tmpdir(), "raulmoracode-preflight-"));
  process.chdir(workDir);
});

afterEach(async () => {
  exitSpy.mockRestore();
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

describe("pnpm version preflight", () => {
  it("derives the required major from PNPM_VERSION", () => {
    expect(REQUIRED_PNPM_MAJOR).toBe(12);
    expect(PNPM_VERSION.startsWith(`${REQUIRED_PNPM_MAJOR}.`)).toBe(true);
  });

  itNode24(
    "aborts with an actionable error when pnpm is another major",
    async () => {
      mockPnpmVersion("13.0.0\n");

      await run({ verbose: false });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorMock).toHaveBeenCalledWith(
        "Se requiere pnpm 12. Versión actual: 13.0.0.\n" +
          `Instala pnpm ${PNPM_VERSION}: corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate  (o: npm install -g pnpm@${PNPM_VERSION})`,
      );
      expect(calledCommands()).toEqual(["pnpm --version"]);
      expect(selectMock).not.toHaveBeenCalled();
    },
  );

  itNode24("aborts when pnpm prints an unparsable version", async () => {
    mockPnpmVersion("not-a-version\n");

    await run({ verbose: false });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = String(errorMock.mock.calls[0]?.[0]);
    expect(message).toContain(
      'No se pudo interpretar la versión de pnpm: "not-a-version".',
    );
    expect(message).toContain(`corepack prepare pnpm@${PNPM_VERSION}`);
    expect(selectMock).not.toHaveBeenCalled();
  });

  itNode24(
    "proceeds past the preflight with pnpm 12.x without spawning it twice",
    async () => {
      mockPnpmVersion("12.6.0\n");
      mockAnswers("pnpm-ok", "https://github.com/raulmoracode/pnpm-ok");

      await run({ verbose: false });

      expect(selectMock).toHaveBeenCalledTimes(1);
      const commands = calledCommands();
      expect(commands.slice(0, 4)).toEqual([
        "pnpm --version",
        "git --version",
        "git config --get user.name",
        "git config --get user.email",
      ]);
      expect(commands.filter((c) => c === "pnpm --version")).toHaveLength(1);
      expect(String(errorMock.mock.calls[0]?.[0])).toContain(
        "No se pudo acceder al repositorio",
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    },
  );
});
