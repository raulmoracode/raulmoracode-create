import { mergeGitignoreEntries } from "../../config/gitignore.js";
import { requiredGitignoreEntries } from "../../generators/configure-node.js";
import type { MigrationResult } from "../types.js";
import type { UpgradeMigration } from "./index.js";
import { patchProjectFile } from "./support.js";

export const GITIGNORE_PATH = ".gitignore";

/**
 * `.gitignore` is written once, when the project is scaffolded, and the
 * upgrade never re-renders it: `create-vite` and `create-next-app` ship their
 * own, so a project created before `REQUIRED_GITIGNORE_ENTRIES` grew can be
 * committing `dist/`, `coverage/` or `.env` files today.
 */
export const migrateGitignore: UpgradeMigration = {
  id: "gitignore-required-entries",
  version: "1.0.9",
  handles: [],
  description: `Merges the required entries into \`${GITIGNORE_PATH}\`, keeping every line the project already has.`,
  why: "The entries `node_modules`, `dist`, `.env`, `.env.*`, `.next` and `coverage` are not managed files, so an older project never received them and risks committing build output or secrets. Merging (instead of re-rendering) keeps any entry the user added.",
  async run(context): Promise<MigrationResult> {
    const written = await patchProjectFile(
      context.projectDir,
      GITIGNORE_PATH,
      (content) => mergeGitignoreEntries(content, requiredGitignoreEntries()),
    );
    return { touched: written ? [GITIGNORE_PATH] : [], removed: [] };
  },
};
