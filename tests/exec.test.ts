import { describe, expect, it } from "vitest";
import {
  ExecError,
  exec,
  formatCommand,
  resolveCommand,
} from "../src/utils/exec.js";

describe("exec", () => {
  it("runs a command and captures stdout", async () => {
    const result = await exec("node", ["-e", "console.log('hello')"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  it("rejects with ExecError when the exit code is non-zero", async () => {
    try {
      await exec("node", ["-e", "process.exit(3)"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ExecError);
      const execError = error as ExecError;
      expect(execError.code).toBe(3);
      expect(execError.command).toBe("node");
      expect(execError.args).toEqual(["-e", "process.exit(3)"]);
    }
  });

  it("captures stderr from failed commands", async () => {
    try {
      await exec("node", ["-e", "console.error('boom'); process.exit(1)"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ExecError);
      expect((error as ExecError).stderr.trim()).toBe("boom");
    }
  });

  it("rejects with spawnError when the executable does not exist", async () => {
    try {
      await exec("raulmoracode-nonexistent-binary", ["--version"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ExecError);
      const execError = error as ExecError;
      expect(execError.spawnError).toBeTruthy();
      expect(execError.message).toContain("raulmoracode-nonexistent-binary");
    }
  });

  it("supports working directories", async () => {
    const { realpath } = await import("node:fs/promises");
    const result = await exec("node", ["-e", "console.log(process.cwd())"], {
      cwd: "/tmp",
    });
    expect(result.stdout.trim()).toBe(await realpath("/tmp"));
  });

  it("passes arguments as an array without string interpolation", async () => {
    const result = await exec("node", [
      "-e",
      "console.log(process.argv[1])",
      "hello world; rm -rf /",
    ]);
    expect(result.stdout.trim()).toBe("hello world; rm -rf /");
  });
});

describe("command helpers", () => {
  it("resolves commands per platform", () => {
    const resolved = resolveCommand("pnpm");
    if (process.platform === "win32") {
      expect(resolved).toBe("pnpm.cmd");
    } else {
      expect(resolved).toBe("pnpm");
    }
  });

  it("formats commands for display", () => {
    expect(formatCommand("git", ["remote", "add", "origin", "url"])).toBe(
      "git remote add origin url",
    );
  });
});
