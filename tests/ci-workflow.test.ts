import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("ci workflow", () => {
  let yaml: string;
  let stepNames: string[];

  beforeAll(async () => {
    yaml = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
    stepNames = [...yaml.matchAll(/^ {6}- name: (.+)$/gm)].map(
      (match) => match[1] ?? "",
    );
  });

  it("runs every validation step in order across both jobs", () => {
    expect(stepNames).toEqual([
      "Checkout",
      "Setup pnpm",
      "Setup Node.js",
      "Install dependencies",
      "Check",
      "Lint",
      "Test",
      "Build",
      "Checkout",
      "Setup pnpm",
      "Setup Node.js",
      "Install dependencies",
      "E2E (Next.js)",
    ]);
  });

  it("triggers on main pushes and pull requests, with read-only permissions", () => {
    expect(yaml).toContain("pull_request:");
    expect(yaml).toContain("- main");
    expect(yaml).toContain("permissions:\n  contents: read");
  });

  it("pins Node 24 with the pnpm store cache", () => {
    expect(yaml).toContain("node-version: 24");
    expect(yaml).toContain("cache: pnpm");
  });

  it("installs with a frozen lockfile", () => {
    expect(yaml).toContain("run: pnpm install --frozen-lockfile");
  });

  it("covers the Vite E2E through the full suite and Next.js separately", () => {
    expect(yaml).toContain("run: pnpm test");
    expect(yaml).toContain("run: pnpm test --run tests/e2e.test.ts");
    expect(yaml).toContain("E2E_FRAMEWORK: next");
  });

  it("never force-pushes or rewrites history", () => {
    expect(yaml).not.toContain("--force");
    expect(yaml).not.toContain("git push");
  });
});
