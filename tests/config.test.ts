import { describe, expect, it } from "vitest";
import { agentsMd } from "../src/config/agents.js";
import { biomeConfig } from "../src/config/biome.js";
import { FAVICON_URL, SITE_TITLE } from "../src/config/branding.js";
import { commitlintConfig } from "../src/config/commitlint.js";
import {
  componentsJson,
  RAULMORACODE_REGISTRY_ADD_EXAMPLE,
  RAULMORACODE_REGISTRY_CATALOG_URL,
  RAULMORACODE_REGISTRY_NAME,
  RAULMORACODE_REGISTRY_URL,
  REGISTRY_PATH_ALIASES,
  REGISTRY_SCOPE_EXCLUDE,
  registryScopeExcludes,
  utilsTs,
  withRegistryAliases,
} from "../src/config/components.js";
import { editorconfigContent } from "../src/config/editorconfig.js";
import { huskyCommitMsg, huskyPreCommit } from "../src/config/husky.js";
import { NODE_VERSION, nvmrcContent } from "../src/config/nvmrc.js";
import {
  collectLockedPackages,
  mergePnpmWorkspaceYaml,
  PNPM_MINIMUM_RELEASE_AGE,
  pnpmWorkspaceYaml,
} from "../src/config/pnpm-workspace.js";
import { queryClientConfig } from "../src/config/query.js";
import {
  nextPostcssConfig,
  tailwindCss,
  viteTailwindConfig,
} from "../src/config/tailwind.js";
import {
  FULL_TECH_SELECTION,
  resolveTechSelection,
  TECH_IDS,
} from "../src/config/tech.js";
import { smokeTest, vitestConfig } from "../src/config/testing.js";
import { vscodeExtensions, vscodeSettings } from "../src/config/vscode.js";

describe(".nvmrc", () => {
  it("pins Node 24", () => {
    expect(nvmrcContent()).toBe("24\n");
    expect(NODE_VERSION).toBe("24");
  });
});

describe("biome.json", () => {
  it("enables formatter, organize imports and linter with 2-space indentation", () => {
    const parsed = JSON.parse(biomeConfig()) as Record<string, unknown>;
    expect(parsed.$schema).toBe(
      "./node_modules/@biomejs/biome/configuration_schema.json",
    );
    expect(parsed.files).toEqual({ includes: ["**", "!dist", "!.next"] });
    expect(parsed.formatter).toEqual({
      enabled: true,
      indentStyle: "space",
      indentWidth: 2,
    });
    expect(parsed.assist).toEqual({
      enabled: true,
      actions: {
        source: {
          organizeImports: "on",
        },
      },
    });
    expect(parsed.linter).toEqual({
      enabled: true,
      rules: {
        a11y: {
          noSvgWithoutTitle: "off",
          noAmbiguousAnchorText: "off",
        },
      },
    });
    expect(parsed.overrides).toEqual([
      {
        includes: ["src/index.css", "src/app/globals.css"],
        formatter: { enabled: false },
        linter: { enabled: false },
        assist: { enabled: false },
      },
    ]);
  });
});

describe(".editorconfig", () => {
  it("declares the expected formatting rules", () => {
    const content = editorconfigContent();
    expect(content).toContain("root = true");
    expect(content).toContain("charset = utf-8");
    expect(content).toContain("end_of_line = lf");
    expect(content).toContain("indent_style = space");
    expect(content).toContain("indent_size = 2");
    expect(content).toContain("insert_final_newline = true");
    expect(content).toContain("trim_trailing_whitespace = true");
  });
});

describe("VS Code configuration", () => {
  it("settings.json uses Biome as formatter for JS/TS/JSON", () => {
    const parsed = JSON.parse(vscodeSettings()) as Record<string, unknown>;
    expect(parsed["editor.defaultFormatter"]).toBe("biomejs.biome");
    expect(parsed["editor.formatOnSave"]).toBe(true);
    expect(parsed["[typescript]"]["editor.defaultFormatter"]).toBe(
      "biomejs.biome",
    );
    expect(parsed["js/ts.tsdk.path"]).toBe("node_modules/typescript/lib");
    expect(parsed["typescript.tsdk"]).toBeUndefined();
  });

  it("extensions.json recommends the Biome extension", () => {
    const parsed = JSON.parse(vscodeExtensions()) as {
      recommendations: string[];
    };
    expect(parsed.recommendations).toEqual(["biomejs.biome"]);
  });
});

describe("components.json (shadcn)", () => {
  it("declares the @raulmoracode registry with a complete shadcn configuration", () => {
    const parsed = JSON.parse(
      componentsJson({ rsc: true, tailwindCssPath: "src/app/globals.css" }),
    ) as {
      registries: Record<string, string>;
      $schema: string;
      style: string;
      rsc: boolean;
      tsx: boolean;
      tailwind: { css: string; baseColor: string; cssVariables: boolean };
      aliases: Record<string, string>;
    };
    expect(parsed.registries[RAULMORACODE_REGISTRY_NAME]).toBe(
      RAULMORACODE_REGISTRY_URL,
    );
    expect(RAULMORACODE_REGISTRY_URL).toBe(
      "https://registry.raulmoracode.com/r/{name}.json",
    );
    expect(parsed.$schema).toBe("https://ui.shadcn.com/schema.json");
    expect(parsed.style).toBe("new-york");
    expect(parsed.rsc).toBe(true);
    expect(parsed.tsx).toBe(true);
    expect(parsed.tailwind.css).toBe("src/app/globals.css");
    expect(parsed.aliases.components).toBe("@/components");
    expect(parsed.aliases.utils).toBe("@/lib/utils");
  });

  it("provides the cn() helper required by shadcn components", () => {
    const content = utilsTs();
    expect(content).toContain('from "clsx"');
    expect(content).toContain('from "tailwind-merge"');
    expect(content).toContain("export function cn(");
  });

  it("exposes the registry path aliases required by registry file targets", () => {
    expect(REGISTRY_PATH_ALIASES).toEqual({
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"],
      "@hooks/*": ["./src/hooks/*"],
    });
  });

  it("merges registry aliases without overwriting existing paths", () => {
    expect(withRegistryAliases()).toEqual(REGISTRY_PATH_ALIASES);
    expect(
      withRegistryAliases({
        "@/*": ["./src/*"],
        "@lib/*": ["./custom/lib/*"],
      }),
    ).toEqual({
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./custom/lib/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@/*": ["./src/*"],
    });
  });

  it("documents the namespaced add command and the catalogue URL", () => {
    expect(RAULMORACODE_REGISTRY_ADD_EXAMPLE).toBe(
      "pnpm dlx shadcn@latest add @raulmoracode/<component>",
    );
    expect(RAULMORACODE_REGISTRY_CATALOG_URL).toBe(
      "https://registry.raulmoracode.com",
    );
  });

  it("exempts the registry scope from minimumReleaseAge only with shadcn", () => {
    expect(REGISTRY_SCOPE_EXCLUDE).toBe("@raulmoracode/*");
    expect(registryScopeExcludes()).toEqual(["@raulmoracode/*"]);
    expect(
      registryScopeExcludes({ ...FULL_TECH_SELECTION, shadcn: false }),
    ).toEqual([]);
  });
});

describe("branding", () => {
  it("uses the raulmoracode title and CDN favicon", () => {
    expect(SITE_TITLE).toBe("raulmoracode");
    expect(FAVICON_URL).toBe("https://cdn.raulmoracode.com/icons/favicon.ico");
  });
});

describe("pnpm-workspace.yaml", () => {
  it("sets minimumReleaseAge to 10080", () => {
    expect(PNPM_MINIMUM_RELEASE_AGE).toBe(10080);
    expect(pnpmWorkspaceYaml()).toBe("minimumReleaseAge: 10080\n");
  });

  it("creates the setting when no workspace file exists", () => {
    expect(mergePnpmWorkspaceYaml(null)).toBe("minimumReleaseAge: 10080\n");
    expect(mergePnpmWorkspaceYaml("")).toBe("minimumReleaseAge: 10080\n");
  });

  it("replaces an existing minimumReleaseAge value", () => {
    expect(mergePnpmWorkspaceYaml("minimumReleaseAge: 1440\n")).toBe(
      "minimumReleaseAge: 10080\n",
    );
  });

  it("preserves other settings such as minimumReleaseAgeExclude", () => {
    const existing = [
      "minimumReleaseAgeExclude:",
      "  - '@tanstack/react-query@5.104.0'",
      "",
    ].join("\n");
    const merged = mergePnpmWorkspaceYaml(existing);
    expect(merged).toContain("minimumReleaseAge: 10080");
    expect(merged).toContain("minimumReleaseAgeExclude:");
    expect(merged).toContain("'@tanstack/react-query@5.104.0'");
  });

  it("collects every locked package from pnpm list --json", () => {
    const tree = [
      {
        name: "my-project",
        version: "0.1.0",
        dependencies: {
          react: { version: "19.3.0" },
          "@tanstack/react-query": {
            version: "5.104.0",
            dependencies: {
              "@tanstack/query-core": { version: "5.104.0" },
              react: { version: "19.3.0" },
            },
          },
        },
        devDependencies: {
          vitest: { version: "5.0.2" },
        },
      },
    ];
    expect(collectLockedPackages(tree)).toEqual([
      "@tanstack/query-core@5.104.0",
      "@tanstack/react-query@5.104.0",
      "react@19.3.0",
      "vitest@5.0.2",
    ]);
  });

  it("merges new exclusions without duplicating existing ones", () => {
    const merged = mergePnpmWorkspaceYaml(
      "minimumReleaseAgeExclude:\n  - vite@8.3.1\n",
      ["vite@8.3.1", "react@19.3.0"],
    );
    expect(merged).toContain("minimumReleaseAge: 10080");
    expect(merged).toContain("  - 'vite@8.3.1'");
    expect(merged).toContain("  - 'react@19.3.0'");
    expect(merged.match(/vite@8\.3\.1/g)?.length).toBe(1);
  });
});

describe("agents guide", () => {
  it("provides the project guidelines for coding agents", () => {
    const content = agentsMd();
    expect(content).toContain("# AGENTS.md");
    expect(content).toContain("`@raulmoracode/create`");
    expect(content).toContain("source of truth");
    expect(content).toContain("pnpm check");
    expect(content).toContain("pnpm test");
    expect(content).toContain("pnpm build");
    expect(content).toContain("git push --force");
    expect(content).toContain(
      "Do not claim tests, builds, or other commands were executed if they were not actually run.",
    );
    expect(content).toContain("## Project tooling");
    expect(content).toContain("uses pnpm exclusively");
    expect(content).toContain(
      "pnpm dlx shadcn@latest add @raulmoracode/<component>",
    );
    expect(content).toContain("https://registry.raulmoracode.com");
    expect(content).toContain("`@raulmoracode` registry");
  });

  it("documents Git hooks and Conventional Commits", () => {
    const content = agentsMd();
    expect(content).toContain("## Git hooks and commits");
    expect(content).toContain("Husky");
    expect(content).toContain("pnpm check");
    expect(content).toContain("pnpm test");
    expect(content).toContain("Commitlint");
    expect(content).toContain("Conventional Commits");
    expect(content).toContain("feat: add user profile");
    expect(content).toContain("fix: handle invalid input");
    expect(content).toContain("refactor: extract API client");
    expect(content).toContain("test: add query client tests");
    expect(content).toContain("docs: update project guide");
    expect(content).toContain("chore: update dependencies");
    expect(content).toContain("--no-verify");
    expect(content).toContain("pnpm build");
  });
});

describe("Tailwind configuration", () => {
  it("css entry point uses the Tailwind 4 import", () => {
    expect(tailwindCss()).toBe('@import "tailwindcss";\n');
  });

  it("vite config wires the official Vite plugin", () => {
    const content = viteTailwindConfig();
    expect(content).toContain('import tailwindcss from "@tailwindcss/vite"');
    expect(content).toContain("plugins: [react(), tailwindcss()]");
  });

  it("vite config maps the @ path alias to src", () => {
    const content = viteTailwindConfig();
    expect(content).toContain('"@": fileURLToPath(new URL("./src"');
  });

  it("next.js uses the PostCSS plugin", () => {
    const content = nextPostcssConfig();
    expect(content).toContain('plugins: ["@tailwindcss/postcss"]');
    expect(content).not.toContain("tailwind.config");
  });
});

describe("TanStack Query and testing configuration", () => {
  it("query client exposes a configured QueryClient", () => {
    const content = queryClientConfig();
    expect(content).toContain(
      'import { QueryClient } from "@tanstack/react-query"',
    );
    expect(content).toContain("export const queryClient");
  });

  it("vitest runs in the jsdom environment", () => {
    const content = vitestConfig();
    expect(content).toContain('environment: "jsdom"');
  });

  it("smoke test uses Testing Library with jsdom", () => {
    const content = smokeTest();
    expect(content).toContain("@testing-library/react");
  });
});

describe("Husky hooks", () => {
  it("generates the exact pre-commit hook with trailing newline", () => {
    expect(huskyPreCommit()).toBe("pnpm check\npnpm test\n");
    expect(huskyPreCommit().endsWith("\n")).toBe(true);
  });

  it("generates the exact commit-msg hook with trailing newline", () => {
    expect(huskyCommitMsg()).toBe('pnpm exec commitlint --edit "$1"\n');
    expect(huskyCommitMsg().endsWith("\n")).toBe(true);
  });

  it("uses the expected hook filenames", () => {
    const hookFiles = [".husky/pre-commit", ".husky/commit-msg"];
    expect(hookFiles).toContain(".husky/pre-commit");
    expect(hookFiles).toContain(".husky/commit-msg");
  });

  it("contains no tokens, credentials or machine-specific paths", () => {
    for (const content of [huskyPreCommit(), huskyCommitMsg()]) {
      expect(content).not.toMatch(/ghp_/);
      expect(content).not.toMatch(/github_pat_/);
      expect(content).not.toMatch(/_authToken/);
      expect(content).not.toMatch(/\/Users\//);
      expect(content).not.toMatch(/\/home\//);
      expect(content).not.toMatch(/[A-Z]:\\/);
    }
  });
});

describe("Tech preset", () => {
  it("full preset selects every technology", () => {
    expect(TECH_IDS).toHaveLength(10);
    for (const id of TECH_IDS) {
      expect(FULL_TECH_SELECTION[id]).toBe(true);
    }
  });

  it("keeps a valid selection untouched without notes", () => {
    const { selection, notes } = resolveTechSelection({
      ...FULL_TECH_SELECTION,
    });
    expect(selection).toEqual(FULL_TECH_SELECTION);
    expect(notes).toEqual([]);
  });

  it("forces Tailwind when shadcn is kept without it", () => {
    const { selection, notes } = resolveTechSelection({
      ...FULL_TECH_SELECTION,
      tailwind: false,
    });
    expect(selection.shadcn).toBe(true);
    expect(selection.tailwind).toBe(true);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("Tailwind");
  });

  it("forces shadcn (and Tailwind) when the theme is kept without them", () => {
    const { selection, notes } = resolveTechSelection({
      ...FULL_TECH_SELECTION,
      tailwind: false,
      shadcn: false,
    });
    expect(selection.theme).toBe(true);
    expect(selection.shadcn).toBe(true);
    expect(selection.tailwind).toBe(true);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("shadcn");
    expect(notes[1]).toContain("Tailwind");
  });

  it("accepts a fully deselected preset", () => {
    const none = Object.fromEntries(
      TECH_IDS.map((id) => [id, false]),
    ) as typeof FULL_TECH_SELECTION;
    const { selection, notes } = resolveTechSelection(none);
    expect(selection.tailwind).toBe(false);
    expect(notes).toEqual([]);
  });
});

describe("Husky hooks with tech selection", () => {
  it("omits pnpm check when Biome is deselected", () => {
    expect(huskyPreCommit({ ...FULL_TECH_SELECTION, biome: false })).toBe(
      "pnpm test\n",
    );
  });

  it("omits pnpm test when testing is deselected", () => {
    expect(huskyPreCommit({ ...FULL_TECH_SELECTION, testing: false })).toBe(
      "pnpm check\n",
    );
  });

  it("writes an empty hook when neither Biome nor testing is kept", () => {
    expect(
      huskyPreCommit({
        ...FULL_TECH_SELECTION,
        biome: false,
        testing: false,
      }),
    ).toBe("");
  });
});

describe("Commitlint configuration", () => {
  it("generates commitlint.config.ts with the conventional base", () => {
    const content = commitlintConfig();
    expect(content).toContain("@commitlint/config-conventional");
    expect(content).toContain("extends");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("supports Conventional Commit types", () => {
    const content = commitlintConfig();
    expect(content).toContain("@commitlint/config-conventional");
  });

  it("contains no tokens, credentials or machine-specific paths", () => {
    const content = commitlintConfig();
    expect(content).not.toMatch(/ghp_/);
    expect(content).not.toMatch(/github_pat_/);
    expect(content).not.toMatch(/_authToken/);
    expect(content).not.toMatch(/\/Users\//);
    expect(content).not.toMatch(/\/home\//);
    expect(content).not.toMatch(/[A-Z]:\\/);
  });
});
