/**
 * OpenCode configuration every generated project ships, so a coding session
 * started in the repository discovers the `@raulmoracode` skills catalog
 * without any manual setup. The `.gitignore` guarantees the `.opencode/`
 * folder stays trackable, so the configuration always travels with the repo.
 */
export function opencodeConfigJson(): string {
  return [
    "{",
    '  "$schema": "https://opencode.ai/config.json",',
    '  "skills": ["https://raulmoracode.github.io/raulmoracode-skills/"]',
    "}",
    "",
  ].join("\n");
}
