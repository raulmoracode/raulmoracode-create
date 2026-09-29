export const RAULMORACODE_REGISTRY_NAME = "@raulmoracode";
export const RAULMORACODE_REGISTRY_URL =
  "https://registry.raulmoracode.com/r/{name}.json";

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
