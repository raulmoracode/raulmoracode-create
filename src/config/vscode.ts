export function vscodeSettings(): string {
  return `${JSON.stringify(
    {
      "editor.defaultFormatter": "biomejs.biome",
      "editor.formatOnSave": true,
      "editor.codeActionsOnSave": {
        "quickfix.biome": "explicit",
        "source.organizeImports.biome": "explicit",
      },
      "[javascript]": {
        "editor.defaultFormatter": "biomejs.biome",
      },
      "[javascriptreact]": {
        "editor.defaultFormatter": "biomejs.biome",
      },
      "[typescript]": {
        "editor.defaultFormatter": "biomejs.biome",
      },
      "[typescriptreact]": {
        "editor.defaultFormatter": "biomejs.biome",
      },
      "[json]": {
        "editor.defaultFormatter": "biomejs.biome",
      },
      "[jsonc]": {
        "editor.defaultFormatter": "biomejs.biome",
      },
      "editor.insertSpaces": true,
      "editor.tabSize": 2,
      "editor.detectIndentation": false,
      "files.trimTrailingWhitespace": true,
      "files.insertFinalNewline": true,
      "js/ts.tsdk.path": "node_modules/typescript/lib",
    },
    null,
    2,
  )}\n`;
}

export function vscodeExtensions(): string {
  return `${JSON.stringify(
    {
      recommendations: ["biomejs.biome"],
    },
    null,
    2,
  )}\n`;
}
