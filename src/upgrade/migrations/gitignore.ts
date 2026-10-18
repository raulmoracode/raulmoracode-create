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
  version: "1.2.0",
  handles: [],
  description: `Merges the required entries into \`${GITIGNORE_PATH}\`, keeping every line the project already has.`,
  why: "The entries `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example`, `.next`, `coverage`, `!.opencode/` and `!.opencode/opencode.json` are not managed files, so an older project never received them and risks committing build output or secrets (or ignoring `.env.example`, which must stay trackable), while the `.opencode/` negations guarantee the OpenCode configuration always travels with the repository (they win over a machine's global git excludes). Merging (instead of re-rendering) keeps any entry the user added. The version was bumped to 1.1.0 so projects created by 1.0.9 received the `.env.example` negation, and to 1.2.0 so every project created before it receives the `.opencode/` negations.",
  async run(context): Promise<MigrationResult> {
    const written = await patchProjectFile(
      context.projectDir,
      GITIGNORE_PATH,
      (content) => mergeGitignoreEntries(content, requiredGitignoreEntries()),
    );
    return { touched: written ? [GITIGNORE_PATH] : [], removed: [] };
  },
};
