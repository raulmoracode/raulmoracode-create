export function commitlintConfig(): string {
  return [
    "export default {",
    '  extends: ["@commitlint/config-conventional"],',
    "};",
    "",
  ].join("\n");
}
