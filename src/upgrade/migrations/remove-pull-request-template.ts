import type { MigrationResult } from "../types.js";
import type { UpgradeMigration } from "./index.js";

export const PULL_REQUEST_TEMPLATE_PATH = ".github/pull_request_template.md";

/**
 * The CLI stopped generating `.github/pull_request_template.md`: the pull
 * request flow is now covered by the `git-pr` skill of the @raulmoracode
 * skills catalog, which writes the PR body from the actual diff, so a static
 * template file is dead weight.
 *
 * The migration itself removes nothing: declaring the path in `handles` is
 * what lets the plan classify the file as `removed` (the managed-file writer
 * deletes it and the commits record the deletion). A no-op `run()` keeps the
 * removal reversible and visible in the same upgrade.
 */
export const removePullRequestTemplate: UpgradeMigration = {
  id: "remove-pull-request-template",
  version: "1.3.0",
  handles: [PULL_REQUEST_TEMPLATE_PATH],
  description: `Removes \`${PULL_REQUEST_TEMPLATE_PATH}\`, which the CLI no longer generates.`,
  why: "Pull request bodies are now written by the `git-pr` skill of the @raulmoracode skills catalog, so the generated template is redundant. Deleting it keeps the repository free of a file nothing maintains; the removal is a normal managed-file deletion, so a project that wants it back can restore it from the same commit in the upgrade pull request.",
  async run(): Promise<MigrationResult> {
    return { touched: [], removed: [] };
  },
};
