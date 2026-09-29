import { beforeEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

import { PreflightError, REMOTE_CONFLICT_MESSAGE } from "../src/cli/run.js";
import { remoteHasDivergentCommits } from "../src/git/push.js";
import { addRemote } from "../src/git/remote.js";
import { ExecError, exec } from "../src/utils/exec.js";
import { validateGitHubUrl } from "../src/utils/validation.js";

function execError(spawnError: string): ExecError {
  return new ExecError({
    command: "pnpm",
    args: ["install"],
    code: null,
    signal: null,
    stdout: "",
    stderr: "",
    spawnError,
  });
}

beforeEach(() => {
  execMock.mockReset();
});

describe("external command failures", () => {
  it("pnpm not available produces a spawn error", async () => {
    execMock.mockRejectedValue(execError("spawn pnpm ENOENT"));
    await expect(exec("pnpm", ["install"])).rejects.toThrow(ExecError);
  });

  it("git not available produces a spawn error", async () => {
    execMock.mockRejectedValue(execError("spawn git ENOENT"));
    await expect(
      addRemote("/tmp/x", "https://github.com/owner/repo", false),
    ).rejects.toThrow(ExecError);
  });

  it("failed non-zero exit is reported as ExecError", async () => {
    execMock.mockRejectedValue(
      new ExecError({
        command: "pnpm",
        args: ["install"],
        code: 1,
        signal: null,
        stdout: "",
        stderr: "ERR_PNPM_IGNORED_BUILDS",
      }),
    );
    await expect(exec("pnpm", ["install"])).rejects.toMatchObject({
      code: 1,
      stderr: "ERR_PNPM_IGNORED_BUILDS",
    });
  });
});

describe("remote conflict detection", () => {
  it("detects divergent commits on the remote", async () => {
    execMock.mockImplementation(async (_command: string, args: string[]) => {
      if (args[0] === "fetch") return { code: 0, stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "origin/main")
        return { code: 0, stdout: "remote-sha\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "HEAD")
        return { code: 0, stdout: "local-sha\n", stderr: "" };
      if (args[0] === "merge-base")
        throw new ExecError({
          command: "git",
          args,
          code: 1,
          signal: null,
          stdout: "",
          stderr: "",
        });
      return { code: 0, stdout: "", stderr: "" };
    });
    await expect(remoteHasDivergentCommits("/tmp/x", false)).resolves.toBe(
      true,
    );
  });

  it("allows push when remote commits are ancestors of HEAD", async () => {
    execMock.mockImplementation(async (_command: string, args: string[]) => {
      if (args[0] === "fetch") return { code: 0, stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "origin/main")
        return { code: 0, stdout: "shared-sha\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "HEAD")
        return { code: 0, stdout: "local-sha\n", stderr: "" };
      if (args[0] === "merge-base") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    });
    await expect(remoteHasDivergentCommits("/tmp/x", false)).resolves.toBe(
      false,
    );
  });

  it("allows push when the remote branch does not exist yet", async () => {
    execMock.mockImplementation(async (_command: string, args: string[]) => {
      if (args[0] === "fetch") return { code: 0, stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "origin/main") {
        throw new ExecError({
          command: "git",
          args,
          code: 128,
          signal: null,
          stdout: "",
          stderr: "unknown revision",
        });
      }
      return { code: 0, stdout: "", stderr: "" };
    });
    await expect(remoteHasDivergentCommits("/tmp/x", false)).resolves.toBe(
      false,
    );
  });

  it("allows push when local and remote point to the same commit", async () => {
    execMock.mockImplementation(async (_command: string, args: string[]) => {
      if (args[0] === "fetch") return { code: 0, stdout: "", stderr: "" };
      if (args[0] === "rev-parse")
        return { code: 0, stdout: "same-sha\n", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    });
    await expect(remoteHasDivergentCommits("/tmp/x", false)).resolves.toBe(
      false,
    );
  });
});

describe("preflight errors", () => {
  it("exposes preflight failures as user-facing messages", () => {
    const error = new PreflightError("pnpm no está instalado");
    expect(error.message).toBe("pnpm no está instalado");
    expect(error.name).toBe("Error");
  });

  it("invalid GitHub URLs are rejected before any execution", () => {
    expect(validateGitHubUrl("https://example.com/owner/repo").valid).toBe(
      false,
    );
    expect(validateGitHubUrl("https://github.com/owner").valid).toBe(false);
  });

  it("remote conflict message asks the user to review without destructive actions", () => {
    expect(REMOTE_CONFLICT_MESSAGE).toContain(
      "No se realizará ningún push destructivo",
    );
    expect(REMOTE_CONFLICT_MESSAGE).toContain("revisa el repositorio");
  });
});
