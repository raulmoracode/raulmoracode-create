import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

export const RAULMORACODE_REGISTRY_NAME = "@raulmoracode";
export const RAULMORACODE_REGISTRY_URL =
  "https://registry.raulmoracode.com/r/{name}.json";
export const RAULMORACODE_REGISTRY_CATALOG_URL =
  "https://registry.raulmoracode.com";
export const RAULMORACODE_REGISTRY_ADD_EXAMPLE =
  "pnpm dlx shadcn@latest add @raulmoracode/<component>";

/** Registry item applied by the optional theme preset. */
export const REGISTRY_THEME_SPEC = "@raulmoracode/theme";

/**
 * Path aliases required by the `@raulmoracode` registry items.
 *
 * Registry file targets use the `@components/...` and `@lib/...` prefixes
 * (without a slash after `@`), which the default `@/*` alias does not cover.
 * Without these mappings the shadcn CLI cannot resolve where to write the
 * files and falls back to creating literal folders.
 */
export const REGISTRY_PATH_ALIASES: Record<string, string[]> = {
  "@components/*": ["./src/components/*"],
  "@lib/*": ["./src/lib/*"],
  "@hooks/*": ["./src/hooks/*"],
};

/**
 * Merges the registry aliases into an existing tsconfig `paths` map.
 * Existing entries always win so project-specific mappings are preserved.
 */
export function withRegistryAliases(
  existing?: Record<string, string[]>,
): Record<string, string[]> {
  return { ...REGISTRY_PATH_ALIASES, ...existing };
}

/**
 * Scope exclusion so `shadcn add @raulmoracode/<component>` can install
 * fresh `@raulmoracode/*` packages despite `minimumReleaseAge`.
 * pnpm supports scope patterns here (verified against pnpm 12.6.0).
 */
export const REGISTRY_SCOPE_EXCLUDE = `${RAULMORACODE_REGISTRY_NAME}/*`;

export function registryScopeExcludes(
  selection: TechSelection = FULL_TECH_SELECTION,
): string[] {
  return selection.shadcn ? [REGISTRY_SCOPE_EXCLUDE] : [];
}

export interface ComponentsJsonOptions {
  rsc: boolean;
  tailwindCssPath: string;
}

export function componentsJson(options: ComponentsJsonOptions): string {
  return `${JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "new-york",
      rsc: options.rsc,
      tsx: true,
      tailwind: {
        css: options.tailwindCssPath,
        baseColor: "neutral",
        cssVariables: true,
      },
      aliases: {
        components: "@/components",
        ui: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
        utils: "@/lib/utils",
      },
      registries: {
        [RAULMORACODE_REGISTRY_NAME]: RAULMORACODE_REGISTRY_URL,
      },
    },
    null,
    2,
  )}\n`;
}

export function utilsTs(): string {
  return [
    'import { clsx, type ClassValue } from "clsx";',
    'import { twMerge } from "tailwind-merge";',
    "",
    "export function cn(...inputs: ClassValue[]) {",
    "  return twMerge(clsx(inputs));",
    "}",
    "",
  ].join("\n");
}
