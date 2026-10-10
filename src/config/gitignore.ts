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
