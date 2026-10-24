import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { helpText, parseArgs, printHelp, VERSION } from "../src/cli/args.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseArgs", () => {
  it("defaults to an interactive run without flags", () => {
    expect(parseArgs([])).toEqual({
      command: "create",
      help: false,
      version: false,
      verbose: false,
      check: false,
      adopt: false,
    });
  });

  it("detects --verbose", () => {
    expect(parseArgs(["--verbose"]).verbose).toBe(true);
  });

  it("detects --check and its alias --dry-run", () => {
    expect(parseArgs(["--check"]).check).toBe(true);
    expect(parseArgs(["--dry-run"]).check).toBe(true);
    expect(parseArgs(["--check", "--dry-run"]).check).toBe(true);
    expect(parseArgs([]).check).toBe(false);
  });

  it("detects --help and -h", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("detects --version and -V", () => {
    expect(parseArgs(["--version"]).version).toBe(true);
    expect(parseArgs(["-V"]).version).toBe(true);
    expect(parseArgs(["-v"]).version).toBe(false);
  });

  it("combines flags", () => {
    expect(parseArgs(["--verbose", "--help"])).toEqual({
      command: "create",
      help: true,
      version: false,
      verbose: true,
      check: false,
      adopt: false,
    });
    expect(parseArgs(["upgrade", "--check", "--verbose"])).toEqual({
      command: "upgrade",
      help: false,
      version: false,
      verbose: true,
      check: true,
      adopt: false,
    });
  });

  it("detects the upgrade subcommand", () => {
    expect(parseArgs(["upgrade"]).command).toBe("upgrade");
    expect(parseArgs(["--verbose", "upgrade"])).toEqual({
      command: "upgrade",
      help: false,
      version: false,
      verbose: true,
      check: false,
      adopt: false,
    });
    expect(parseArgs(["something"]).command).toBe("create");
  });

  it("ignores unknown flags", () => {
    expect(parseArgs(["--whatever"])).toEqual({
      command: "create",
      help: false,
      version: false,
      verbose: false,
      check: false,
      adopt: false,
    });
  });

  it("detects --adopt", () => {
    expect(parseArgs(["upgrade", "--adopt"]).adopt).toBe(true);
    expect(parseArgs(["upgrade", "--adopt", "--check"])).toEqual({
      command: "upgrade",
      help: false,
      version: false,
      verbose: false,
      check: true,
      adopt: true,
    });
    expect(parseArgs([]).adopt).toBe(false);
  });
});

describe("help and version output", () => {
  it("VERSION matches package.json", async () => {
    const pkg = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    ) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });

  it("help text documents usage and options", () => {
    const text = helpText();
    expect(text).toContain("Usage:");
    expect(text).toContain("raulmoracode-create [options]");
    expect(text).toContain("--verbose");
    expect(text).toContain("--check");
    expect(text).toContain("--dry-run");
    expect(text).toContain("--adopt");
    expect(text).toContain("--help");
    expect(text).toContain("--version");
    expect(text).toContain("raulmoracode-create upgrade");
    expect(text).toContain(VERSION);
  });

  it("printHelp writes the help text to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printHelp();
    expect(spy).toHaveBeenCalledWith(helpText());
  });
});
