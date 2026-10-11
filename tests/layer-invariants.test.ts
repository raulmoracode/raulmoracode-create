import { readdir, readFile } from "node:fs/promises";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

const CLACK = "@clack/prompts";
const FS_SPECIFIERS = new Set([
  "fs",
  "fs/promises",
  "node:fs",
  "node:fs/promises",
]);
const PROCESS_SPECIFIERS = new Set([
  "child_process",
  "child_process/promises",
  "node:child_process",
  "node:child_process/promises",
]);
const FILESYSTEM_MODULE = "utils/filesystem";
const EXEC_MODULE = "utils/exec";

/**
 * `upgrade/` modules that are pure CONTRACT: they only read and write
 * strings/objects, so they are unit-testable without a disk, a process or
 * Clack. A new module lands here by default.
 */
const PURE_UPGRADE_MODULES = [
  "upgrade/managed-files",
  "upgrade/manifest",
  "upgrade/migrations/index",
  "upgrade/notes",
  "upgrade/package-json",
  "upgrade/plan",
  "upgrade/pr-body",
  "upgrade/report",
  "upgrade/template-snapshot",
  "upgrade/types",
  "upgrade/version",
];

/**
 * `upgrade/` modules that are ORCHESTRATION: they legitimately read and write
 * the project and spawn `git`/`pnpm`/`pnpm exec biome`. They may only do it
 * through `utils/filesystem` and `utils/exec`.
 */
const EFFECTFUL_UPGRADE_MODULES = [
  "upgrade/apply",
  "upgrade/migrations/gitignore",
  "upgrade/migrations/readme",
  "upgrade/migrations/site-config",
  "upgrade/migrations/support",
  "upgrade/migrations/vscode-settings",
  "upgrade/preflight",
  "upgrade/state",
];

const UPGRADE_FORBIDDEN_EXTERNAL = [
  CLACK,
  ...FS_SPECIFIERS,
  ...PROCESS_SPECIFIERS,
];

interface ModuleInfo {
  /** POSIX path relative to `src/`, without extension: `utils/exec`. */
  path: string;
  /** First path segment: the layer. `""` for `src/index.ts`. */
  layer: string;
  /** Bare specifiers and Node builtins (`@clack/prompts`, `node:fs/promises`). */
  external: string[];
  /** Resolved internal modules, in the same shape as `path`. */
  internal: string[];
}

interface RawModule {
  path: string;
  layer: string;
  specifiers: string[];
}

/** `import x from "y"`, `export * from "y"`, one line or spread over several. */
const STATIC_IMPORT = /^(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/;
/** `import "y"`: a side-effect import with no `from`. */
const BARE_IMPORT = /^(?:import|export)\s*["']([^"']+)["']/;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE_CALL = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
const STATEMENT_START = /^(?:import|export)\b/;

async function listModuleFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "__snapshots__") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listModuleFiles(full)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Specifiers of one source file, read as text. Only statements that START a
 * line count, so the `import ...` lines embedded in the templates under
 * `src/config/` (generated `vite.config.ts`, `cn()`, …) are never mistaken
 * for real dependencies.
 */
function extractImports(source: string): string[] {
  const specifiers: string[] = [];
  let pending: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (pending === null) {
      if (line === "" || line.startsWith("//") || line.startsWith("/*")) {
        continue;
      }
      if (!STATEMENT_START.test(line)) continue;
      const bare = BARE_IMPORT.exec(line);
      const single = STATIC_IMPORT.exec(line);
      if (bare?.[1]) {
        specifiers.push(bare[1]);
      } else if (single?.[1]) {
        specifiers.push(single[1]);
      } else {
        pending = line;
      }
      continue;
    }
    const multi = STATIC_IMPORT.exec(`${pending} ${line}`);
    if (multi?.[1]) {
      specifiers.push(multi[1]);
      pending = null;
    } else if (line === "" || line.startsWith("//")) {
      // Keep waiting: a named import may wrap over a comment line.
    } else if (line.endsWith(";")) {
      pending = null;
    }
  }

  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    if (match[1]) specifiers.push(match[1]);
  }
  for (const match of source.matchAll(REQUIRE_CALL)) {
    if (match[1]) specifiers.push(match[1]);
  }
  return specifiers;
}

function toModulePath(file: string): string {
  return relative(srcRoot, file).split(sep).join("/").replace(/\.ts$/, "");
}

function layerOf(modulePath: string): string {
  return modulePath.includes("/") ? (modulePath.split("/")[0] ?? "") : "";
}

function resolveInternal(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return posix.join(posix.dirname(from), specifier).replace(/\.js$/, "");
}

async function readModules(): Promise<ModuleInfo[]> {
  const files = await listModuleFiles(srcRoot);
  const raw: RawModule[] = await Promise.all(
    files.map(async (file) => {
      const path = toModulePath(file);
      return {
        path,
        layer: layerOf(path),
        specifiers: extractImports(await readFile(file, "utf8")),
      };
    }),
  );
  const known = new Set(raw.map((module) => module.path));
  return raw.map((module) => {
    const external: string[] = [];
    const internal: string[] = [];
    for (const specifier of module.specifiers) {
      const target = resolveInternal(module.path, specifier);
      if (target !== null && known.has(target)) {
        internal.push(target);
      } else if (!specifier.startsWith(".")) {
        external.push(specifier);
      }
    }
    return { path: module.path, layer: module.layer, external, internal };
  });
}

function matchesAny(module: ModuleInfo, candidates: string[]): string[] {
  return module.external.filter((specifier) =>
    candidates.some(
      (candidate) =>
        specifier === candidate || specifier.startsWith(`${candidate}/`),
    ),
  );
}

function matchesAnySet(module: ModuleInfo, set: Set<string>): string[] {
  return module.external.filter((specifier) => set.has(specifier));
}

function sorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

let modules: ModuleInfo[] = [];

function byPath(path: string): ModuleInfo | undefined {
  return modules.find((module) => module.path === path);
}

function layerFiles(layer: string): ModuleInfo[] {
  return modules.filter((module) => module.layer === layer);
}

function assertNone(violations: string[], rule: string, fix: string): void {
  const detail =
    violations.length === 0
      ? ""
      : `\nViolations:\n${violations.map((one) => `  - ${one}`).join("\n")}`;
  expect(
    violations,
    `AGENTS.md §3 — ${rule}${detail}\nFix: ${fix}`,
  ).toHaveLength(0);
}

beforeAll(async () => {
  modules = await readModules();
});

describe("layer invariants (AGENTS.md §3)", () => {
  describe("the import scanner", () => {
    it("reads every module under src/ and its specifiers", () => {
      expect(modules.length).toBeGreaterThan(50);
      expect(byPath("index")).toBeDefined();
      expect(byPath("utils/filesystem")).toBeDefined();
      expect(byPath("upgrade/apply")).toBeDefined();
      expect(
        matchesAnySet(
          byPath("utils/exec") ?? emptyModule(),
          PROCESS_SPECIFIERS,
        ),
      ).toEqual(["node:child_process"]);
      expect(matchesAny(byPath("cli/run") ?? emptyModule(), [CLACK])).toEqual([
        CLACK,
      ]);
      expect(byPath("cli/run")?.internal).toContain(EXEC_MODULE);
      expect(byPath("generators/configure-site")?.internal).toContain(
        FILESYSTEM_MODULE,
      );
    });
  });

  describe("Clack", () => {
    it("is imported only from src/cli/ and src/prompts/", () => {
      const violations = modules
        .filter((module) => !["cli", "prompts"].includes(module.layer))
        .filter((module) => matchesAny(module, [CLACK]).length > 0)
        .map(
          (module) =>
            `src/${module.path}.ts imports ${quote(matchesAny(module, [CLACK]))}`,
        );
      assertNone(
        violations,
        "Clack only in src/cli/ and src/prompts/.",
        "move the prompt or the log line to src/prompts/ (interaction) or src/cli/ (output).",
      );
    });

    it("really is imported from src/cli/ and src/prompts/", () => {
      const layers = sorted(
        modules
          .filter((module) => matchesAny(module, [CLACK]).length > 0)
          .map((module) => module.layer),
      );
      expect(layers).toEqual(["cli", "prompts"]);
    });
  });

  describe("file I/O", () => {
    it("is owned by src/utils/filesystem.ts, the only module importing node:fs", () => {
      const violations = modules
        .filter((module) => module.path !== FILESYSTEM_MODULE)
        .filter((module) => matchesAnySet(module, FS_SPECIFIERS).length > 0)
        .map(
          (module) =>
            `src/${module.path}.ts imports ${quote(matchesAnySet(module, FS_SPECIFIERS))}`,
        );
      assertNone(
        violations,
        "All file I/O goes through src/utils/filesystem.ts.",
        "import readTextFile/writeTextFile/parseJsonc/… from ../utils/filesystem.js instead.",
      );
    });

    it("is really performed by src/utils/filesystem.ts", () => {
      expect(
        matchesAnySet(
          byPath(FILESYSTEM_MODULE) ?? emptyModule(),
          FS_SPECIFIERS,
        ),
      ).not.toHaveLength(0);
    });
  });

  describe("external processes", () => {
    it("go through src/utils/exec.ts, the only module importing child_process", () => {
      const violations = modules
        .filter((module) => module.path !== EXEC_MODULE)
        .filter(
          (module) => matchesAnySet(module, PROCESS_SPECIFIERS).length > 0,
        )
        .map(
          (module) =>
            `src/${module.path}.ts imports ${quote(matchesAnySet(module, PROCESS_SPECIFIERS))}`,
        );
      assertNone(
        violations,
        "All external processes go through src/utils/exec.ts.",
        "import exec from ../utils/exec.js and pass an args array, never an interpolated command.",
      );
    });

    it("are really spawned by src/utils/exec.ts", () => {
      expect(
        matchesAnySet(byPath(EXEC_MODULE) ?? emptyModule(), PROCESS_SPECIFIERS),
      ).not.toHaveLength(0);
    });
  });

  describe("config/", () => {
    it("performs no I/O and spawns nothing", () => {
      const violations = layerFiles("config")
        .filter(
          (module) =>
            matchesAnySet(module, FS_SPECIFIERS).length > 0 ||
            matchesAnySet(module, PROCESS_SPECIFIERS).length > 0,
        )
        .map((module) => {
          const hits = [
            ...matchesAnySet(module, FS_SPECIFIERS),
            ...matchesAnySet(module, PROCESS_SPECIFIERS),
          ];
          return `src/${module.path}.ts imports ${quote(hits)}`;
        });
      assertNone(
        violations,
        "src/config/ performs no I/O: pure functions returning strings.",
        "return a template from src/config/ and let the caller write it, or pass the data in as a parameter.",
      );
    });

    it("does not reach utils/filesystem.ts or utils/exec.ts", () => {
      const violations = layerFiles("config")
        .filter(
          (module) =>
            module.internal.includes(FILESYSTEM_MODULE) ||
            module.internal.includes(EXEC_MODULE),
        )
        .map((module) => {
          const hits = [FILESYSTEM_MODULE, EXEC_MODULE].filter((name) =>
            module.internal.includes(name),
          );
          return `src/${module.path}.ts imports ${hits.map((hit) => `src/${hit}.ts`).join(", ")}`;
        });
      assertNone(
        violations,
        "src/config/ exports pure templates: it never imports the I/O helpers.",
        "keep the write/exec in the src/generators/ step that calls the template.",
      );
    });
  });

  describe("git/ and github/", () => {
    it("never import each other", () => {
      const violations = [...layerFiles("git"), ...layerFiles("github")]
        .filter((module) => {
          const other = module.layer === "git" ? "github" : "git";
          return module.internal.some((target) => layerOf(target) === other);
        })
        .map(
          (module) =>
            `src/${module.path}.ts imports ${quote(module.internal.filter((target) => layerOf(target) === (module.layer === "git" ? "github" : "git")))}`,
        );
      assertNone(
        violations,
        "`github/` wraps the gh CLI and `git/` wraps git; neither one knows about the other.",
        "compose the two in src/cli/ (the orchestrator) instead of inside the wrapper.",
      );
    });

    it("keeps Husky and Commitlint out of git/", () => {
      const husky = ["config/husky", "config/commitlint"];
      const violations = layerFiles("git")
        .filter((module) =>
          module.internal.some((target) => husky.includes(target)),
        )
        .map(
          (module) =>
            `src/${module.path}.ts imports ${quote(module.internal.filter((target) => husky.includes(target)))}`,
        );
      assertNone(
        violations,
        "`git/` contains no Husky or Commitlint logic.",
        "activate Husky from src/cli/run.ts with exec(); `git/` only knows git.",
      );
    });
  });

  describe("upgrade/", () => {
    it("classifies every module as contract or orchestration", () => {
      const upgradeModules = modules
        .map((module) => module.path)
        .filter((path) => path.startsWith("upgrade/"))
        .sort();
      const classified = [
        ...PURE_UPGRADE_MODULES,
        ...EFFECTFUL_UPGRADE_MODULES,
      ];
      expect(
        sorted(classified.filter((path) => classified.includes(path))),
      ).toEqual(sorted(classified));
      expect(
        PURE_UPGRADE_MODULES.filter((path) =>
          EFFECTFUL_UPGRADE_MODULES.includes(path),
        ),
      ).toEqual([]);
      expect(sorted(upgradeModules)).toEqual(sorted(classified));
    });

    it("never imports Clack", () => {
      const violations = modules
        .filter((module) => module.path.startsWith("upgrade/"))
        .filter((module) => matchesAny(module, [CLACK]).length > 0)
        .map(
          (module) =>
            `src/${module.path}.ts imports ${quote(matchesAny(module, [CLACK]))}`,
        );
      assertNone(
        violations,
        "`upgrade/` takes no Clack.",
        "return a plain value and let src/cli/upgrade-output.ts (Clack) print it.",
      );
    });

    it("never imports from src/cli/ or src/prompts/", () => {
      const forbidden = ["cli", "prompts"];
      const violations = modules
        .filter((module) => module.path.startsWith("upgrade/"))
        .filter((module) =>
          module.internal.some((target) => forbidden.includes(layerOf(target))),
        )
        .map((module) => {
          const hits = module.internal.filter((target) =>
            forbidden.includes(layerOf(target)),
          );
          return `src/${module.path}.ts imports ${hits.map((hit) => `src/${hit}.ts`).join(", ")}`;
        });
      assertNone(
        violations,
        "`upgrade/` never imports `cli/` or `prompts/` (the reverse is fine).",
        "the dependency has to go the other way: pass the value in from src/cli/upgrade.ts.",
      );
    });

    it("keeps its contract modules free of I/O and processes", () => {
      const violations = modules
        .filter((module) => PURE_UPGRADE_MODULES.includes(module.path))
        .filter(
          (module) =>
            matchesAny(module, UPGRADE_FORBIDDEN_EXTERNAL).length > 0 ||
            module.internal.includes(FILESYSTEM_MODULE) ||
            module.internal.includes(EXEC_MODULE),
        )
        .map((module) => {
          const hits = [
            ...matchesAny(module, UPGRADE_FORBIDDEN_EXTERNAL),
            ...[FILESYSTEM_MODULE, EXEC_MODULE].filter((name) =>
              module.internal.includes(name),
            ),
          ];
          return `src/${module.path}.ts imports ${quote(hits)}`;
        });
      assertNone(
        violations,
        "the contract modules of `upgrade/` (types, manifest, managed-files, notes, version, package-json, report, plan, pr-body, template-snapshot, migrations/index) are pure: no I/O, no processes, no Clack.",
        "return strings/objects and leave the write, the spawn and the prompt to the orchestration (state, preflight, apply, migrations/*) or to src/cli/.",
      );
    });

    it("routes the I/O and the processes of its orchestration through utils/", () => {
      const violations = modules
        .filter((module) => EFFECTFUL_UPGRADE_MODULES.includes(module.path))
        .filter(
          (module) =>
            matchesAnySet(module, FS_SPECIFIERS).length > 0 ||
            matchesAnySet(module, PROCESS_SPECIFIERS).length > 0,
        )
        .map((module) => {
          const hits = [
            ...matchesAnySet(module, FS_SPECIFIERS),
            ...matchesAnySet(module, PROCESS_SPECIFIERS),
          ];
          return `src/${module.path}.ts imports ${quote(hits)}`;
        });
      assertNone(
        violations,
        "the orchestration of `upgrade/` (state, preflight, apply, migrations/*) does use I/O and processes, but only through src/utils/filesystem.ts and src/utils/exec.ts.",
        "import the helpers from ../../utils/ instead of touching node:fs or child_process.",
      );
    });
  });
});

function quote(values: string[]): string {
  return sorted(values)
    .map((value) => `"${value}"`)
    .join(", ");
}

function emptyModule(): ModuleInfo {
  return { path: "", layer: "", external: [], internal: [] };
}
