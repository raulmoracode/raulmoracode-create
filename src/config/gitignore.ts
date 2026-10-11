/**
 * Entries every generated `.gitignore` has to carry. Project creation
 * (`augmentGitignore`) and the `upgrade` migration merge from this single
 * list, so a project scaffolded today and one upgraded from an older CLI end
 * up with the same entries.
 */
export const REQUIRED_GITIGNORE_ENTRIES = [
  "node_modules",
  "dist",
  ".env",
  ".env.*",
  // The negation must follow `.env.*` (git applies the last matching pattern),
  // otherwise `.env.example` would be ignored and could never be committed.
  "# Keep .env.example trackable (negates .env.*)",
  "!.env.example",
  ".next",
  "coverage",
] as const;

/**
 * Merges the required entries into an existing `.gitignore`, keeping every
 * line the user wrote (order, comments and blank lines included) and only
 * appending what is missing. Returns `null` when nothing is missing, which
 * makes the merge idempotent and lets both callers skip the write.
 */
export function mergeGitignoreEntries(
  content: string,
  required: readonly string[] = REQUIRED_GITIGNORE_ENTRIES,
): string | null {
  const existing = new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const missing = required.filter((entry) => !existing.has(entry));
  if (missing.length === 0) {
    return null;
  }
  const merged = content.replace(/\s+$/, "");
  return merged
    ? `${merged}\n${missing.join("\n")}\n`
    : `${missing.join("\n")}\n`;
}

/**
 * The negation that makes `.vscode/settings.json` trackable despite the
 * `.vscode/*` exclusion `create-vite` ships (its template only excepts
 * `extensions.json`). `create-next-app` never ignores `.vscode`, so the
 * exception only ever matters for Vite projects.
 */
export const VSCODE_SETTINGS_EXCEPTION = "!.vscode/settings.json";

/** The exclusion this negation counteracts. */
export const VSCODE_EDITOR_EXCLUSION = ".vscode/*";

/**
 * Makes `.vscode/settings.json` trackable by appending `VSCODE_SETTINGS_EXCEPTION`
 * when the project's `.gitignore` excludes the `.vscode` directory with
 * `VSCODE_EDITOR_EXCLUSION`. A `!` for a direct child DOES work under
 * `.vscode/*`: that glob only excludes the entries inside the directory (git
 * keeps descending), unlike a directory pattern like `.vscode/`, under which
 * no exception can re-include anything. Adding the exception (instead of
 * removing the exclusion) keeps every other editor file ignored, mirroring the
 * template's own `!.vscode/extensions.json`. Returns `null` when there is
 * nothing to do: no `.vscode/*` exclusion, or the exception already present.
 */
export function ensureVscodeSettingsTracked(content: string): string | null {
  const lines = content.split("\n");
  if (!lines.some((line) => line.trim() === VSCODE_EDITOR_EXCLUSION)) {
    return null;
  }
  if (lines.some((line) => line.trim() === VSCODE_SETTINGS_EXCEPTION)) {
    return null;
  }
  const merged = content.replace(/\s+$/, "");
  return merged
    ? `${merged}\n${VSCODE_SETTINGS_EXCEPTION}\n`
    : `${VSCODE_SETTINGS_EXCEPTION}\n`;
}
