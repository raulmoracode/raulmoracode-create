import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("scheduled e2e workflow", () => {
  let yaml: string;
  let stepNames: string[];

  beforeAll(async () => {
    yaml = await readFile(
      join(root, ".github/workflows/e2e-scheduled.yml"),
      "utf8",
    );
    stepNames = [...yaml.matchAll(/^ {6}- name: (.+)$/gm)].map(
      (match) => match[1] ?? "",
    );
  });

  it("runs the setup and E2E steps in order", () => {
    expect(stepNames).toEqual([
      "Checkout",
      "Setup pnpm",
      "Setup Node.js",
      "Install dependencies",
      "E2E",
    ]);
  });

  it("triggers weekly and on demand, never on pushes or pull requests", () => {
    expect(yaml).toMatch(/^ {2}schedule:\n {4}- cron: "[^"]+"$/m);
    expect(yaml).toContain("  workflow_dispatch:");
    expect(yaml).not.toContain("push:");
    expect(yaml).not.toContain("pull_request:");
  });

  it("runs with read-only permissions", () => {
    expect(yaml).toContain("permissions:\n  contents: read");
    expect(yaml).not.toContain("contents: write");
  });

  it("fans out over both frameworks without failing fast", () => {
    expect(yaml).toContain("fail-fast: false");
    expect(yaml).toContain("framework: [vite, next]");
    expect(yaml).toContain("runs-on: ubuntu-latest");
    expect(yaml).toMatch(/timeout-minutes: \d+/);
  });

  it("pins Node 24 with the pnpm store cache", () => {
    expect(yaml).toContain("node-version: 24");
    expect(yaml).toContain("cache: pnpm");
  });

  it("installs with a frozen lockfile", () => {
    expect(yaml).toContain("run: pnpm install --frozen-lockfile");
  });

  it("runs the E2E suite with the framework from the matrix", () => {
    expect(yaml).toContain("run: pnpm test --run tests/e2e.test.ts");
    expect(yaml).toMatch(/E2E_FRAMEWORK: \$\{\{ matrix\.framework \}\}/);
  });

  it("only observes: no updates, pushes or secrets", () => {
    expect(yaml).not.toContain("--force");
    expect(yaml).not.toContain("git push");
    expect(yaml).not.toContain("secrets.");
    expect(yaml).not.toMatch(/pnpm (update|up|upgrade)\b/);
    expect(yaml).not.toContain("--no-frozen-lockfile");
  });
});
