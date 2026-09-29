export function biomeConfig(): string {
  return `${JSON.stringify(
    {
      $schema: "./node_modules/@biomejs/biome/configuration_schema.json",
      files: {
        includes: ["**", "!dist", "!.next"],
      },
      formatter: {
        enabled: true,
        indentStyle: "space",
        indentWidth: 2,
      },
      assist: {
        enabled: true,
        actions: {
          source: {
            organizeImports: "on",
          },
        },
      },
      linter: {
        enabled: true,
        rules: {
          a11y: {
            noSvgWithoutTitle: "off",
            noAmbiguousAnchorText: "off",
          },
        },
      },
      // Tailwind v4 directives (@custom-variant, @theme, ...) are not
      // parseable by Biome and would fail `pnpm check`. These entry files
      // are Tailwind-owned (even more so with the registry theme), so Biome
      // skips them entirely on both frameworks.
      overrides: [
        {
          includes: ["src/index.css", "src/app/globals.css"],
          formatter: { enabled: false },
          linter: { enabled: false },
          assist: { enabled: false },
        },
      ],
    },
    null,
    2,
  )}\n`;
}
