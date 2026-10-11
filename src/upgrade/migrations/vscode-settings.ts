import { ensureVscodeSettingsTracked } from "../../config/gitignore.js";
import type { MigrationResult } from "../types.js";
import { GITIGNORE_PATH } from "./gitignore.js";
import type { UpgradeMigration } from "./index.js";
import { patchProjectFile } from "./support.js";

/**
 * `create-vite`'s template ignores every file under `.vscode/` except
 * `extensions.json`, so the `.vscode/settings.json` the CLI writes for the
 * whole team is silently dropped by git. Unlike the `.gitignore` entries
 * migration, this one REMOVES nothing: it adds the `!` exception (which works
 * under the `.vscode/*` glob, exactly like the template's own
 * `!.vscode/extensions.json`), keeping every other editor file ignored.
 */
export const migrateVscodeSettingsTracked: UpgradeMigration = {
  id: "vscode-settings-tracked",
  version: "1.1.0",
  handles: [],
  description: `Adds the \`!.vscode/settings.json\` exception to \`${GITIGNORE_PATH}\` so the team-wide editor settings are committed.`,
  why: "The `.vscode/settings.json` the CLI writes was ignored by the `create-vite` `.gitignore` (only `extensions.json` was excepted), so each developer had to configure the editor by hand. A negation for one direct child works under `.vscode/*` — that glob excludes the children, not the directory itself, unlike a directory pattern like `.vscode/` — so adding the exception commits the settings while keeping every other editor file ignored.",
  async run(context): Promise<MigrationResult> {
    const written = await patchProjectFile(
      context.projectDir,
      GITIGNORE_PATH,
      (content) => ensureVscodeSettingsTracked(content),
    );
    return { touched: written ? [GITIGNORE_PATH] : [], removed: [] };
  },
};
