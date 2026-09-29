import { afterEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

import { nextFramework } from "../src/frameworks/next.js";
import { viteFramework } from "../src/frameworks/vite.js";
import { installDependencies } from "../src/generators/configure-project.js";
import { ExecError } from "../src/utils/exec.js";

function argsOf(call: unknown[]): { command: string; args: string[] } {
  const [command, args] = call as [string, string[]];
  return { command, args };
}

afterEach(() => {
  execMock.mockReset();
});

describe("installDependencies", () => {
  it("runs pnpm install, pnpm add and pnpm add -D against the project directory", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await installDependencies("/tmp/my-project", viteFramework, false);

    expect(execMock).toHaveBeenCalledTimes(3);

    const [first, second, third] = execMock.mock.calls.map(argsOf);
    expect(first.command).toBe("pnpm");
    expect(first.args).toEqual(["install"]);
    expect(second.command).toBe("pnpm");
    expect(second.args[0]).toBe("add");
    expect(second.args).toContain("zustand@5.0.15");
    expect(second.args).toContain("react-hook-form@7.89.0");
    expect(second.args).toContain("zod@4.6.5");
    expect(second.args).toContain("@tanstack/react-query@5.104.0");
    expect(third.command).toBe("pnpm");
    expect(third.args[0]).toBe("add");
    expect(third.args).toContain("-D");
    expect(third.args).toContain("tailwindcss@4.3.3");
    expect(third.args).toContain("@tailwindcss/vite@4.3.3");
    expect(third.args).toContain("@biomejs/biome@2.5.14");
    expect(third.args).toContain("vitest@5.0.2");
    expect(third.args).toContain("@testing-library/react@16.3.3");
    expect(third.args).toContain("@testing-library/dom@10.4.2");
    expect(third.args).toContain("clsx@2.1.1");
    expect(third.args).toContain("tailwind-merge@3.7.0");
    expect(third.args).toContain("class-variance-authority@0.7.1");
    expect(third.args).toContain("husky@9.1.7");
    expect(third.args).toContain("@commitlint/cli@21.2.3");
    expect(third.args).toContain("@commitlint/config-conventional@21.2.3");

    for (const call of execMock.mock.calls) {
      expect(call[2]).toMatchObject({ cwd: "/tmp/my-project" });
    }
  });

  it("includes Git hooks dependencies for next.js without changing install order", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await installDependencies("/tmp/my-app", nextFramework, false);

    expect(execMock).toHaveBeenCalledTimes(3);
    const [first, second, third] = execMock.mock.calls.map(argsOf);
    expect(first.args).toEqual(["install"]);
    expect(second.args[0]).toBe("add");
    expect(third.args[0]).toBe("add");
    expect(third.args).toContain("-D");
    expect(third.args).toContain("husky@9.1.7");
    expect(third.args).toContain("@commitlint/cli@21.2.3");
    expect(third.args).toContain("@commitlint/config-conventional@21.2.3");
  });

  it("skips deselected techs without changing the install order", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await installDependencies("/tmp/my-project", viteFramework, false, {
      tailwind: false,
      shadcn: false,
      "tanstack-query": false,
      zustand: false,
      forms: false,
      biome: false,
      testing: false,
      husky: false,
      vscode: false,
    });

    // Only `pnpm install` runs: template pins come from patchPackageJson,
    // and every additional runtime/dev dep was deselected (bare `pnpm add`
    // with no packages would fail, so empty adds are skipped).
    expect(execMock).toHaveBeenCalledTimes(1);
    const [first] = execMock.mock.calls.map(argsOf);
    expect(first.command).toBe("pnpm");
    expect(first.args).toEqual(["install"]);
  });

  it("installs only the selected techs", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await installDependencies("/tmp/my-project", viteFramework, false, {
      tailwind: false,
      shadcn: true,
      "tanstack-query": false,
      zustand: true,
      forms: false,
      biome: true,
      testing: false,
      husky: false,
      vscode: false,
    });

    expect(execMock).toHaveBeenCalledTimes(3);
    const [, second, third] = execMock.mock.calls.map(argsOf);
    expect(second.args).toContain("zustand@5.0.15");
    expect(second.args).not.toContain("react-hook-form@7.89.0");
    expect(third.args).toContain("@biomejs/biome@2.5.14");
    expect(third.args).toContain("clsx@2.1.1");
    expect(third.args).not.toContain("vitest@5.0.2");
    expect(third.args).not.toContain("husky@9.1.7");
    expect(third.args).not.toContain("tailwindcss@4.3.3");
  });

  it("uses the PostCSS Tailwind plugin for next.js", async () => {
    execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await installDependencies("/tmp/my-app", nextFramework, false);
    const third = argsOf(execMock.mock.calls[2]);
    expect(third.args).toContain("@tailwindcss/postcss@4.3.3");
    expect(third.args).not.toContain("@tailwindcss/vite@4.3.3");
  });

  it("propagates ExecError when pnpm is not available", async () => {
    execMock.mockRejectedValue(
      new ExecError({
        command: "pnpm",
        args: ["install"],
        code: null,
        signal: null,
        stdout: "",
        stderr: "",
        spawnError: "ENOENT",
      }),
    );
    await expect(
      installDependencies("/tmp/my-project", viteFramework, false),
    ).rejects.toThrow(ExecError);
  });
});
