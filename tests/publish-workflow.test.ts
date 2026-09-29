import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("publish workflow", () => {
  let yaml: string;
  let stepNames: string[];

  beforeAll(async () => {
    yaml = await readFile(join(root, ".github/workflows/publish.yml"), "utf8");
    stepNames = [...yaml.matchAll(/^ {6}- name: (.+)$/gm)].map(
      (match) => match[1] ?? "",
    );
  });

  function indexOf(name: string): number {
    const index = stepNames.indexOf(name);
    expect(index, `missing step: ${name}`).toBeGreaterThanOrEqual(0);
    return index;
  }

  it("parses and exposes the expected steps in order", () => {
    expect(stepNames).toEqual([
      "Checkout",
      "Validate tag is semver",
      "Resolve package name",
      "Verify tag matches package.json",
      "Verify version is not already published",
      "Setup pnpm",
      "Setup Node.js",
      "Install dependencies",
      "Build",
      "Test",
      "Verify the build output",
      "Verify the tarball contents",
      "Publish to npm",
      "Verify the published version was built from this commit",
    ]);
  });

  it("publishes only from pushed tags, with read-only permissions", () => {
    expect(yaml).toContain('- "v*"');
    expect(yaml).toContain("permissions:\n  contents: read");
  });

  it("builds and tests before publishing", () => {
    expect(indexOf("Build")).toBeLessThan(indexOf("Test"));
    expect(indexOf("Test")).toBeLessThan(indexOf("Publish to npm"));
  });

  it("rejects tags that are not strict semver", () => {
    expect(yaml).toContain("^v[0-9]+\\.[0-9]+\\.[0-9]+$");
    expect(yaml).toContain("no es una versión semver válida");
  });

  it("rejects a tag that does not match the package.json version", () => {
    expect(yaml).toContain(`"${"$"}{GITHUB_REF_NAME#v}" != "$version"`);
  });

  it("rejects a version that already exists on npm", () => {
    expect(yaml).toContain("npm view");
    expect(yaml).toContain("ya está publicada en npm");
  });

  it("verifies the build output before publishing", () => {
    expect(indexOf("Verify the build output")).toBeLessThan(
      indexOf("Publish to npm"),
    );
    expect(yaml).toContain("#!/usr/bin/env node");
    expect(yaml).toContain('VERSION = \\"$version\\"');
  });

  it("verifies the tarball contents before publishing", () => {
    expect(indexOf("Verify the tarball contents")).toBeLessThan(
      indexOf("Publish to npm"),
    );
    expect(yaml).toContain("npm publish --dry-run --json");
    for (const required of ["README.md", "LICENSE"]) {
      expect(yaml).toContain(`"${required}"`);
    }
  });

  it("verifies after publishing that npm recorded this exact commit", () => {
    expect(
      indexOf("Verify the published version was built from this commit"),
    ).toBeGreaterThan(indexOf("Publish to npm"));
    expect(yaml).toContain("gitHead");
    expect(yaml).toContain('"$published" != "$GITHUB_SHA"');
  });

  it("publishes with an explicit access level and the NPM_TOKEN secret", () => {
    expect(yaml).toContain("run: npm publish --access public");
    expect(yaml).toContain(`NODE_AUTH_TOKEN: ${"$"}{{ secrets.NPM_TOKEN }}`);
  });

  it("never force-publishes or rewrites history", () => {
    expect(yaml).not.toContain("--force");
    expect(yaml).not.toContain("git push");
  });
});
