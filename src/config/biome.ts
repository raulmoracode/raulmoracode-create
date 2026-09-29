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
    },
    null,
    2,
  )}\n`;
}
