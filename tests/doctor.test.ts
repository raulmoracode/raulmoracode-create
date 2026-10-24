import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());

vi.mock("../src/utils/exec.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/exec.js")>();
  return { ...actual, exec: execMock };
});

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
}));

import { intro, log, outro } from "@clack/prompts";
import { VERSION } from "../src/cli/args.js";
import { runDoctor } from "../src/cli/doctor.js";
import type { TechSelection } from "../src/config/tech.js";
import {
  type Diagnostic,
  type DoctorFacts,
  diagnoseProject,
} from "../src/doctor/checks.js";
import type { PackageJson } from "../src/frameworks/types.js";
import {
  managedDependencyPins,
  managedPackageJson,
} from "../src/upgrade/managed-files.js";
import { hashContent, serializeManifest } from "../src/upgrade/manifest.js";
import type { ProjectManifest } from "../src/upgrade/types.js";
import { MANIFEST_VERSION } from "../src/upgrade/types.js";

const SELECTION: TechSelection = {
  tailwind: false,
  shadcn: false,
  theme: false,
  "tanstack-query": false,
  zustand: false,
  forms: false,
  biome: true,
  testing: false,
  playwright: false,
  husky: false,
  vscode: false,
};

const CONTENT = '{ "formatter": { "enabled": true } }\n';
const PACKAGE: PackageJson = {
  name: "my-app",
  scripts: managedPackageJson("vite", SELECTION).scripts,
  dependencies: managedPackageJson("vite", SELECTION).dependencies.dependencies,
  devDependencies: managedPackageJson("vite", SELECTION).dependencies
    .devDependencies,
};
const MANIFEST: ProjectManifest = {
  manifestVersion: MANIFEST_VERSION,
  cliVersion: VERSION,
  framework: "vite",
  selection: SELECTION,
  projectName: "my-app",
  githubUrl: "https://github.com/o/my-app",
  files: { "biome.json": hashContent(CONTENT) },
  dependencies: managedDependencyPins("vite", SELECTION),
};

function facts(overrides: Partial<DoctorFacts> = {}): DoctorFacts {
  return {
    nodeVersion: "v24.0.0",
    pnpmVersion: "12.6.0",
    gitVersion: "git version 2.50.0",
    insideRepository: true,
    packageJson: PACKAGE,
    manifest: MANIFEST,
    manifestError: null,
    files: { "biome.json": CONTENT },
    currentCliVersion: VERSION,
    ...overrides,
  };
}

function find(diagnostics: Diagnostic[], id: string): Diagnostic {
  const found = diagnostics.find((diagnostic) => diagnostic.id === id);
  if (!found) {
    throw new Error(`No diagnostic "${id}" in ${diagnostics.map((d) => d.id)}`);
  }
  return found;
}

describe("diagnoseProject", () => {
  it("reports a healthy project with every check ok", () => {
    const diagnostics = diagnoseProject(facts());
    expect(diagnostics.every((diagnostic) => diagnostic.level === "ok")).toBe(
      true,
    );
    expect(diagnostics.map((diagnostic) => diagnostic.id)).toEqual([
      "node",
      "pnpm",
      "git",
      "package-json",
      "manifest",
      "version",
      "managed-files",
      "dependencies",
      "scripts",
    ]);
  });

  it("fails an unsupported Node version", () => {
    expect(
      find(diagnoseProject(facts({ nodeVersion: "v20.0.0" })), "node"),
    ).toMatchObject({ level: "error" });
  });

  it("fails when pnpm is missing or in another major", () => {
    expect(
      find(diagnoseProject(facts({ pnpmVersion: null })), "pnpm"),
    ).toMatchObject({ level: "error" });
    expect(
      find(diagnoseProject(facts({ pnpmVersion: "13.0.0" })), "pnpm"),
    ).toMatchObject({ level: "error" });
  });

  it("fails without git and warns outside a repository", () => {
    expect(
      find(diagnoseProject(facts({ gitVersion: null })), "git"),
    ).toMatchObject({ level: "error" });
    expect(
      find(diagnoseProject(facts({ insideRepository: false })), "git"),
    ).toMatchObject({ level: "warning" });
  });

  it("fails without a readable package.json", () => {
    expect(
      find(diagnoseProject(facts({ packageJson: null })), "package-json"),
    ).toMatchObject({ level: "error" });
  });

  it("points at --adopt when the manifest is missing", () => {
    const diagnostic = find(
      diagnoseProject(facts({ manifest: null })),
      "manifest",
    );
    expect(diagnostic.level).toBe("error");
    expect(diagnostic.hint).toContain("upgrade --adopt");
  });

  it("fails when the manifest cannot be parsed", () => {
    const diagnostic = find(
      diagnoseProject(facts({ manifest: null, manifestError: "no es JSON" })),
      "manifest",
    );
    expect(diagnostic.level).toBe("error");
    expect(diagnostic.message).toContain("no es JSON");
  });

  it("warns about version drift in both directions", () => {
    const behind = find(
      diagnoseProject(
        facts({ manifest: { ...MANIFEST, cliVersion: "1.0.9" } }),
      ),
      "version",
    );
    expect(behind).toMatchObject({ level: "warning" });
    expect(behind.message).toContain("actualización disponible");

    const ahead = find(
      diagnoseProject(
        facts({ manifest: { ...MANIFEST, cliVersion: "9.9.9" } }),
      ),
      "version",
    );
    expect(ahead).toMatchObject({ level: "warning" });
    expect(ahead.message).toContain("más reciente");
  });

  it("warns about missing and locally modified managed files", () => {
    const missing = find(
      diagnoseProject(facts({ files: {} })),
      "managed-files",
    );
    expect(missing.level).toBe("warning");
    expect(missing.message).toContain("ausente");

    const modified = find(
      diagnoseProject(facts({ files: { "biome.json": "changed\n" } })),
      "managed-files",
    );
    expect(modified.level).toBe("warning");
    expect(modified.message).toContain("modificado");
  });

  it("warns about missing and drifted managed dependencies", () => {
    const removed = find(
      diagnoseProject(
        facts({
          packageJson: {
            ...PACKAGE,
            scripts: PACKAGE.scripts,
            dependencies: {},
            devDependencies: {},
          },
        }),
      ),
      "dependencies",
    );
    expect(removed.level).toBe("warning");
    expect(removed.message).toContain("sin instalar");

    const drifted = find(
      diagnoseProject(
        facts({
          packageJson: {
            ...PACKAGE,
            devDependencies: {
              ...PACKAGE.devDependencies,
              "@biomejs/biome": "0.0.1",
            },
          },
        }),
      ),
      "dependencies",
    );
    expect(drifted.level).toBe("warning");
    expect(drifted.message).toContain("otra versión");
  });

  it("warns about missing managed scripts", () => {
    const diagnostic = find(
      diagnoseProject(
        facts({
          packageJson: {
            ...PACKAGE,
            scripts: { ...PACKAGE.scripts, check: "other" },
          },
        }),
      ),
      "scripts",
    );
    expect(diagnostic.level).toBe("warning");
    expect(diagnostic.message).toContain("check");
  });
});

const errorMock = log.error as unknown as ReturnType<typeof vi.fn>;
const successMock = log.success as unknown as ReturnType<typeof vi.fn>;
const outroMock = outro as unknown as ReturnType<typeof vi.fn>;
const originalCwd = process.cwd();
let workDir = "";
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  execMock.mockReset();
  errorMock.mockClear();
  successMock.mockClear();
  outroMock.mockClear();
  (intro as unknown as ReturnType<typeof vi.fn>).mockClear();
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  workDir = await mkdtemp(join(tmpdir(), "raulmoracode-doctor-"));
  process.chdir(workDir);
  execMock.mockImplementation(async (command: string, args: string[]) => {
    const line = `${command} ${args.join(" ")}`.trim();
    if (line === "pnpm --version") {
      return { code: 0, stdout: "12.6.0\n", stderr: "" };
    }
    if (line === "git --version") {
      return { code: 0, stdout: "git version 2.50.0\n", stderr: "" };
    }
    if (line === "git rev-parse --show-toplevel") {
      return { code: 0, stdout: `${workDir}\n`, stderr: "" };
    }
    return { code: 0, stdout: "", stderr: "" };
  });
});

afterEach(async () => {
  exitSpy.mockRestore();
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

describe("runDoctor", () => {
  it("exits 0 and prints the checks for a readable project", async () => {
    await mkdir(join(workDir, "src"), { recursive: true });
    await writeFile(
      join(workDir, "package.json"),
      `${JSON.stringify(PACKAGE, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(workDir, "raulmoracode.json"),
      serializeManifest(MANIFEST),
      "utf8",
    );
    await writeFile(join(workDir, "biome.json"), CONTENT, "utf8");

    await runDoctor({ verbose: false });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(successMock).toHaveBeenCalled();
    expect(outroMock).toHaveBeenCalledWith("Sin errores y 0 aviso(s).");
  });

  it("exits 1 and points at --adopt when the manifest is missing", async () => {
    await writeFile(
      join(workDir, "package.json"),
      `${JSON.stringify(PACKAGE, null, 2)}\n`,
      "utf8",
    );

    await runDoctor({ verbose: false });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const texts = errorMock.mock.calls.map((call) => String(call[0]));
    expect(texts.some((text) => text.includes("--adopt"))).toBe(true);
    expect(outroMock.mock.calls[0]?.[0]).toContain("error");
  });
});
