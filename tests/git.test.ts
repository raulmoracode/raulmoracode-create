import { exec } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  addArgs,
  commitArgs,
  createCommit,
  INITIAL_COMMIT_MESSAGE,
} from "../src/git/commit.js";
import { branchArgs, initArgs, initRepository } from "../src/git/init.js";
import { push, pushArgs } from "../src/git/push.js";
import { addRemote, remoteAddArgs, remoteExists } from "../src/git/remote.js";

const execAsync = promisify(exec);

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "raulmoracode-git-"));
  tempDirs.push(dir);
  return dir;
}

async function withIdentity(dir: string): Promise<void> {
  await execAsync('git config user.name "Raulmoracode Test"', { cwd: dir });
  await execAsync('git config user.email "test@raulmoracode.com"', {
    cwd: dir,
  });
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("git command builders", () => {
  it("builds git init and branch commands", () => {
    expect(initArgs()).toEqual(["init"]);
    expect(branchArgs()).toEqual(["branch", "-M", "main"]);
  });

  it("builds remote add command with the repository URL", () => {
    expect(remoteAddArgs("https://github.com/raulmoracode/my-project")).toEqual(
      ["remote", "add", "origin", "https://github.com/raulmoracode/my-project"],
    );
  });

  it("builds add and commit commands", () => {
    expect(addArgs()).toEqual(["add", "."]);
    expect(commitArgs()).toEqual([
      "commit",
      "-m",
      "chore: initial project setup",
    ]);
    expect(commitArgs("custom message")).toEqual([
      "commit",
      "-m",
      "custom message",
    ]);
    expect(INITIAL_COMMIT_MESSAGE).toBe("chore: initial project setup");
  });

  it("builds push command without force", () => {
    expect(pushArgs()).toEqual(["push", "-u", "origin", "main"]);
    expect(JSON.stringify(pushArgs())).not.toContain("--force");
    expect(JSON.stringify(pushArgs())).not.toContain("-f");
  });
});

describe("git integration", () => {
  it("initRepository initializes the repository on the main branch", async () => {
    const dir = await makeTempDir();
    await initRepository(dir, false);
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: dir,
    });
    expect(stdout.trim()).toBe("main");
  });

  it("addRemote configures origin", async () => {
    const dir = await makeTempDir();
    await initRepository(dir, false);
    const url = "https://github.com/raulmoracode/my-project";
    await addRemote(dir, url, false);
    expect(await remoteExists(dir, false)).toBe(true);
  });

  it("createCommit stages everything and creates the initial commit", async () => {
    const dir = await makeTempDir();
    await initRepository(dir, false);
    await withIdentity(dir);
    await writeFile(join(dir, "README.md"), "# test\n");
    await createCommit(dir, false);
    const { stdout } = await execAsync("git log -1 --pretty=%s", { cwd: dir });
    expect(stdout.trim()).toBe("chore: initial project setup");
    const status = await execAsync("git status --porcelain", { cwd: dir });
    expect(status.stdout.trim()).toBe("");
  });

  it("push uploads the main branch to the remote", async () => {
    const local = await makeTempDir();
    const remote = await makeTempDir();
    await execAsync("git init --bare", { cwd: remote });

    await initRepository(local, false);
    await withIdentity(local);
    await writeFile(join(local, "README.md"), "# test\n");
    await createCommit(local, false);
    await addRemote(local, remote, false);
    await push(local, false);

    const { stdout } = await execAsync("git rev-parse refs/heads/main", {
      cwd: remote,
    });
    expect(stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
  });
});
