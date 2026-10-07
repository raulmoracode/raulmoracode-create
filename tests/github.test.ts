import { describe, expect, it, vi } from "vitest";
import {
  createPullRequest,
  findOpenPullRequest,
  GhAuthError,
  ghAuthStatusArgs,
  ghPrCreateArgs,
  ghPrListArgs,
  ghRepoViewArgs,
  repoDefaultBranch,
  requireGhAuth,
} from "../src/github/gh.js";
import { ExecError } from "../src/utils/exec.js";
import { pathExists, readTextFile } from "../src/utils/filesystem.js";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

function execResult(
  stdout: string,
  stderr = "",
): {
  code: number;
  stdout: string;
  stderr: string;
} {
  return { code: 0, stdout, stderr };
}

describe("gh argument builders", () => {
  it("builds gh auth status", () => {
    expect(ghAuthStatusArgs()).toEqual(["auth", "status"]);
  });

  it("builds gh pr list for an open pull request of a head branch", () => {
    expect(ghPrListArgs("upgrade/my-app")).toEqual([
      "pr",
      "list",
      "--head",
      "upgrade/my-app",
      "--state",
      "open",
      "--json",
      "url",
      "--limit",
      "1",
    ]);
  });

  it("builds gh pr create with a body file and never a draft", () => {
    const args = ghPrCreateArgs({
      base: "main",
      head: "upgrade/my-app",
      title: "chore: upgrade raulmoracode-create to 1.0.8",
      bodyFile: "/tmp/body.md",
    });
    expect(args).toEqual([
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "upgrade/my-app",
      "--title",
      "chore: upgrade raulmoracode-create to 1.0.8",
      "--body-file",
      "/tmp/body.md",
    ]);
    expect(args).not.toContain("--draft");
  });

  it("builds gh repo view for the default branch", () => {
    expect(ghRepoViewArgs()).toEqual([
      "repo",
      "view",
      "--json",
      "defaultBranchRef",
      "-q",
      ".defaultBranchRef.name",
    ]);
  });
});

describe("requireGhAuth", () => {
  it("resolves when gh is authenticated", async () => {
    execMock.mockResolvedValueOnce(execResult("Logged in to github.com"));
    await expect(requireGhAuth(false)).resolves.toBeUndefined();
    expect(execMock).toHaveBeenCalledWith("gh", ["auth", "status"], {
      verbose: false,
    });
  });

  it("throws a Spanish error when gh is not authenticated", async () => {
    execMock.mockRejectedValue(new Error("exit 1"));
    await expect(requireGhAuth(false)).rejects.toBeInstanceOf(GhAuthError);
    await expect(requireGhAuth(false)).rejects.toThrow(/gh auth login/);
  });

  it("explains how to install gh when it is missing", async () => {
    execMock.mockRejectedValueOnce(
      new ExecError({
        command: "gh",
        args: ["auth", "status"],
        code: null,
        signal: null,
        stdout: "",
        stderr: "",
        spawnError: "spawn gh ENOENT",
      }),
    );
    await expect(requireGhAuth(false)).rejects.toThrow(/no está instalada/);
  });
});

describe("findOpenPullRequest", () => {
  it("returns the first url", async () => {
    execMock.mockResolvedValueOnce(
      execResult('[{"url":"https://github.com/o/r/pull/7"}]\n'),
    );
    await expect(findOpenPullRequest("/tmp", "head", true)).resolves.toBe(
      "https://github.com/o/r/pull/7",
    );
    expect(execMock).toHaveBeenCalledWith("gh", ghPrListArgs("head"), {
      cwd: "/tmp",
      verbose: true,
    });
  });

  it("returns null for an empty list", async () => {
    execMock.mockResolvedValueOnce(execResult("[]\n"));
    await expect(
      findOpenPullRequest("/tmp", "head", false),
    ).resolves.toBeNull();
  });

  it("returns null for empty output", async () => {
    execMock.mockResolvedValueOnce(execResult("   \n"));
    await expect(
      findOpenPullRequest("/tmp", "head", false),
    ).resolves.toBeNull();
  });

  it("returns null for garbage output", async () => {
    execMock.mockResolvedValueOnce(execResult("no pull requests found"));
    await expect(
      findOpenPullRequest("/tmp", "head", false),
    ).resolves.toBeNull();
  });

  it("returns null when the list has no url", async () => {
    execMock.mockResolvedValueOnce(execResult('[{"number":1}]'));
    await expect(
      findOpenPullRequest("/tmp", "head", false),
    ).resolves.toBeNull();
  });

  it("returns null when gh exits with an error", async () => {
    execMock.mockRejectedValueOnce(new Error("exit 1"));
    await expect(
      findOpenPullRequest("/tmp", "head", false),
    ).resolves.toBeNull();
  });
});

describe("createPullRequest", () => {
  it("writes the body to a temp file, calls gh and removes the file", async () => {
    const body = "## Summary\n\nbody with | pipe and unicode ⚠️\n";
    execMock.mockImplementationOnce(
      async (_command: string, args: string[]) => {
        const bodyFile = args[args.indexOf("--body-file") + 1] as string;
        expect(await pathExists(bodyFile)).toBe(true);
        expect(await readTextFile(bodyFile)).toBe(body);
        expect(await pathExists(bodyFile)).toBe(true);
        return execResult(
          "Creating pull request\nhttps://github.com/o/r/pull/9\n",
        );
      },
    );
    const url = await createPullRequest({
      cwd: "/tmp",
      base: "main",
      head: "upgrade/my-app",
      title: "chore: upgrade raulmoracode-create to 1.0.8",
      body,
      verbose: false,
    });
    expect(url).toBe("https://github.com/o/r/pull/9");
    const [command, args, options] = execMock.mock.calls[0] as [
      string,
      string[],
      { cwd: string; verbose: boolean },
    ];
    expect(command).toBe("gh");
    expect(args.slice(0, 2)).toEqual(["pr", "create"]);
    expect(args).toContain("--body-file");
    expect(args).not.toContain("--draft");
    expect(options).toEqual({ cwd: "/tmp", verbose: false });
    const bodyFile = args[args.indexOf("--body-file") + 1] as string;
    expect(await pathExists(bodyFile)).toBe(false);
  });

  it("throws when gh does not print a url, still removing the temp file", async () => {
    let bodyFile = "";
    execMock.mockImplementationOnce(
      async (_command: string, args: string[]) => {
        bodyFile = args[args.indexOf("--body-file") + 1] as string;
        return execResult("something went wrong\n");
      },
    );
    await expect(
      createPullRequest({
        cwd: "/tmp",
        base: "main",
        head: "upgrade/my-app",
        title: "t",
        body: "b",
        verbose: false,
      }),
    ).rejects.toThrow(/no devolvió la URL/);
    expect(await pathExists(bodyFile)).toBe(false);
  });

  it("removes the temp file when gh fails", async () => {
    let bodyFile = "";
    execMock.mockImplementationOnce(
      async (_command: string, args: string[]) => {
        bodyFile = args[args.indexOf("--body-file") + 1] as string;
        throw new Error("exit 1");
      },
    );
    await expect(
      createPullRequest({
        cwd: "/tmp",
        base: "main",
        head: "upgrade/my-app",
        title: "t",
        body: "b",
        verbose: false,
      }),
    ).rejects.toThrow("exit 1");
    expect(await pathExists(bodyFile)).toBe(false);
  });
});

describe("repoDefaultBranch", () => {
  it("returns the branch name", async () => {
    execMock.mockResolvedValueOnce(execResult("main\n"));
    await expect(repoDefaultBranch("/tmp", false)).resolves.toBe("main");
    expect(execMock).toHaveBeenCalledWith("gh", ghRepoViewArgs(), {
      cwd: "/tmp",
      verbose: false,
    });
  });

  it("returns null on empty output or failure", async () => {
    execMock.mockResolvedValueOnce(execResult("\n"));
    await expect(repoDefaultBranch("/tmp", false)).resolves.toBeNull();
    execMock.mockRejectedValueOnce(new Error("exit 1"));
    await expect(repoDefaultBranch("/tmp", false)).resolves.toBeNull();
  });
});
