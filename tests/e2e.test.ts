import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...(cwd ? { cwd } : {}),
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.error?.on("data", () => {});
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

const answers = vi.hoisted(() => [
  "my-project",
  "https://github.com/raulmoracode/my-project",
]);
let bareRemote: string;
let gitConfigDir: string;
let workDir: string;

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
    "tanstack-query",
    "zustand",
    "forms",
    "registry",
    "biome",
    "testing",
    "husky",
    "vscode",
  ]),
  text: vi.fn(async () => answers.shift() ?? "my-project"),
  confirm: vi.fn(async () => false),
  cancel: vi.fn(),
  isCancel: () => false,
}));

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

import { run } from "../src/cli/run.js";

function makeExecImplementation() {
  return async (command: string, args: string[], options: { cwd?: string }) => {
    if (command === "git") {
      if (args[0] === "ls-remote") {
        return { code: 0, stdout: "", stderr: "" };
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
    if (command === "pnpm" && args[0] === "add") {
      const filtered = args.filter(
        (arg) => arg !== "@raulmoracode/icons@1.1.0",
      );
      return runCommand(command, filtered, options.cwd);
    }
    return runCommand(command, args, options.cwd);
  };
}

describe("end-to-end project creation", () => {
  beforeAll(async () => {
    gitConfigDir = await mkdtemp(join(tmpdir(), "raulmoracode-gitconfig-"));
    await writeFile(
      join(gitConfigDir, "gitconfig"),
      "[user]\n\tname = Raulmoracode Test\n\temail = test@raulmoracode.com\n",
    );
    process.env.GIT_CONFIG_GLOBAL = join(gitConfigDir, "gitconfig");
    bareRemote = await mkdtemp(join(tmpdir(), "raulmoracode-remote-"));
    await runCommand("git", ["init", "--bare"], bareRemote);
    workDir = await mkdtemp(join(tmpdir(), "raulmoracode-work-"));
    process.env.GH_TOKEN = "test-token";
    // Simulate the owner path: the token has private registry access.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true })),
    );
    process.chdir(workDir);
    execMock.mockImplementation(makeExecImplementation());
  }, 30_000);

  afterAll(async () => {
    delete process.env.GH_TOKEN;
    delete process.env.GIT_CONFIG_GLOBAL;
    vi.unstubAllGlobals();
    await rm(gitConfigDir, { recursive: true, force: true });
    if (process.env.KEEP === "1") {
      console.log(`Keeping generated project at: ${workDir}/my-project`);
      return;
    }
    await rm(bareRemote, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  });

  it("creates, configures, commits and pushes the project", async () => {
    const { log } = await import("@clack/prompts");
    try {
      await run({ verbose: false });
    } catch (error) {
      console.log("RUN THREW:", error);
    }
    console.log(
      "LOG.ERROR CALLS:",
      JSON.stringify((log.error as ReturnType<typeof vi.fn>).mock.calls),
    );

    const projectDir = join(workDir, "my-project");
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".git"))).toBe(true);

    const pkg = JSON.parse(
      await readFile(join(projectDir, "package.json"), "utf8"),
    ) as {
      name: string;
      author: { name: string; url: string };
      homepage: string;
      repository: { type: string; url: string };
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      packageManager: string;
      engines: Record<string, string>;
    };
    expect(pkg.name).toBe("my-project");
    expect(pkg.author).toEqual({
      name: "Raul Mora",
      url: "https://raulmoracode.com",
    });
    expect(pkg.homepage).toBe("https://github.com/raulmoracode/my-project");
    expect(pkg.repository).toEqual({
      type: "git",
      url: "https://github.com/raulmoracode/my-project",
    });
    expect(pkg.scripts.test).toBe("vitest");
    expect(pkg.scripts.check).toBe("biome check .");
    expect(pkg.scripts.prepare).toBe("husky");
    expect(pkg.dependencies.react).toBe("19.3.0");
    expect(pkg.dependencies.zustand).toBe("5.0.15");
    expect(pkg.devDependencies.husky).toBe("9.1.7");
    expect(pkg.devDependencies["@commitlint/cli"]).toBe("21.2.3");
    expect(pkg.devDependencies["@commitlint/config-conventional"]).toBe(
      "21.2.3",
    );
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      if (
        name === "husky" ||
        name === "@commitlint/cli" ||
        name === "@commitlint/config-conventional"
      ) {
        expect(version, name).not.toMatch(/^[\^~]/);
      }
    }
    expect(pkg.packageManager).toBe("pnpm@12.6.0");
    expect(pkg.engines.node).toBe(">=24");

    if (process.env.E2E_FRAMEWORK === "next") {
      expect(pkg.scripts.dev).toBe("next dev");
      expect(pkg.dependencies.next).toBe("16.3.6");
      expect(pkg.devDependencies["@tailwindcss/postcss"]).toBe("4.3.3");
    } else {
      expect(pkg.scripts.dev).toBe("vite");
      expect(pkg.devDependencies.vite).toBe("8.3.1");
      expect(pkg.devDependencies["@tailwindcss/vite"]).toBe("4.3.3");
    }

    for (const file of [
      ".nvmrc",
      ".npmrc",
      ".editorconfig",
      "biome.json",
      "components.json",
      "vitest.config.ts",
      ".vscode/settings.json",
      ".vscode/extensions.json",
      "src/lib/query-client.ts",
      "src/test/smoke.test.tsx",
      ".husky/pre-commit",
      ".husky/commit-msg",
      "commitlint.config.ts",
    ]) {
      expect(existsSync(join(projectDir, file)), file).toBe(true);
    }

    const preCommit = await readFile(
      join(projectDir, ".husky", "pre-commit"),
      "utf8",
    );
    expect(preCommit).toBe("pnpm check\npnpm test\n");
    const commitMsg = await readFile(
      join(projectDir, ".husky", "commit-msg"),
      "utf8",
    );
    expect(commitMsg).toBe('pnpm exec commitlint --edit "$1"\n');
    const commitlintConfig = await readFile(
      join(projectDir, "commitlint.config.ts"),
      "utf8",
    );
    expect(commitlintConfig).toContain("@commitlint/config-conventional");
    expect(commitlintConfig).toContain("extends");
    if (process.platform !== "win32") {
      const { stat } = await import("node:fs/promises");
      for (const hook of ["pre-commit", "commit-msg"]) {
        const mode = (await stat(join(projectDir, ".husky", hook))).mode;
        expect(mode & 0o111).toBeGreaterThan(0);
      }
    }
    const agentsGuide = await readFile(join(projectDir, "AGENTS.md"), "utf8");
    expect(agentsGuide).toContain("## Git hooks and commits");
    expect(
      existsSync(join(projectDir, ".oxlintrc.json")),
      ".oxlintrc.json",
    ).toBe(false);
    expect(existsSync(join(projectDir, "node_modules")), "node_modules").toBe(
      true,
    );
    expect(existsSync(join(projectDir, "yarn.lock")), "yarn.lock").toBe(false);

    const npmrc = await readFile(join(projectDir, ".npmrc"), "utf8");
    expect(npmrc).toContain(`//npm.pkg.github.com/:_authToken=\${GH_TOKEN}`);

    const workspace = await readFile(
      join(projectDir, "pnpm-workspace.yaml"),
      "utf8",
    );
    expect(workspace).toContain("minimumReleaseAge: 10080");
    expect(workspace).toContain("minimumReleaseAgeExclude:");
    expect(workspace).toContain("@tanstack/query-core@5.104.0");

    if (process.env.E2E_FRAMEWORK === "next") {
      const { readdir } = await import("node:fs/promises");
      expect(await readdir(join(projectDir, "public"))).toEqual([]);
      const pageTsx = await readFile(
        join(projectDir, "src", "app", "page.tsx"),
        "utf8",
      );
      expect(pageTsx).toContain("return <div>hello</div>;");
      expect(
        existsSync(join(projectDir, "src", "app", "page.module.css")),
        "page.module.css",
      ).toBe(false);
      expect(existsSync(join(projectDir, "AGENTS.md")), "AGENTS.md").toBe(true);
      expect(await readFile(join(projectDir, "AGENTS.md"), "utf8")).toContain(
        "`@raulmoracode/create`",
      );
      expect(existsSync(join(projectDir, "CLAUDE.md")), "CLAUDE.md").toBe(
        false,
      );
      const layout = await readFile(
        join(projectDir, "src", "app", "layout.tsx"),
        "utf8",
      );
      expect(layout).toContain('title: "raulmoracode"');
      expect(layout).toContain(
        "https://cdn.raulmoracode.com/icons/favicon.ico",
      );
      expect(
        existsSync(join(projectDir, "src", "app", "favicon.ico")),
        "default favicon.ico",
      ).toBe(false);
    } else {
      const indexHtml = await readFile(join(projectDir, "index.html"), "utf8");
      expect(indexHtml).toContain("<title>raulmoracode</title>");
      expect(indexHtml).toContain(
        "https://cdn.raulmoracode.com/icons/favicon.ico",
      );
      const { readdir } = await import("node:fs/promises");
      expect(await readdir(join(projectDir, "public"))).toEqual([]);
      expect(await readdir(join(projectDir, "src", "assets"))).toEqual([]);
      const appTsx = await readFile(join(projectDir, "src", "App.tsx"), "utf8");
      expect(appTsx).toContain("return <div>hello</div>;");
      expect(appTsx).toContain('import "./App.css";');
      expect(await readFile(join(projectDir, "src", "App.css"), "utf8")).toBe(
        "",
      );
      expect(existsSync(join(projectDir, "AGENTS.md")), "AGENTS.md").toBe(true);
      expect(await readFile(join(projectDir, "AGENTS.md"), "utf8")).toContain(
        "`@raulmoracode/create`",
      );
      const tsconfigApp = JSON.parse(
        await readFile(join(projectDir, "tsconfig.app.json"), "utf8"),
      ) as {
        compilerOptions: { paths: Record<string, string[]> };
      };
      expect(tsconfigApp.compilerOptions.paths).toEqual({
        "@/*": ["./src/*"],
      });
      const viteConfig = await readFile(
        join(projectDir, "vite.config.ts"),
        "utf8",
      );
      expect(viteConfig).toContain('"@": fileURLToPath(new URL("./src"');
    }

    const gitLog = await runCommand(
      "git",
      ["log", "-1", "--pretty=%s"],
      projectDir,
    );
    expect(gitLog.stdout.trim()).toBe("chore: initial project setup");

    const hooksPath = await runCommand(
      "git",
      ["config", "--get", "core.hooksPath"],
      projectDir,
    ).catch(() => ({ stdout: "", stderr: "" }));
    if (hooksPath.stdout.trim() !== "") {
      expect(hooksPath.stdout.trim()).toContain(".husky");
    }

    await runCommand("pnpm", ["check"], projectDir);
    await runCommand("pnpm", ["exec", "vitest", "run"], projectDir, {
      CI: "true",
    });
    await runCommand("pnpm", ["build"], projectDir);

    const remoteRefs = await runCommand(
      "git",
      ["rev-parse", "refs/heads/main"],
      bareRemote,
    );
    expect(remoteRefs.stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
  }, 600_000);
});
