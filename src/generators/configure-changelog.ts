import { changelogMd } from "../config/changelog.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureChangelog(projectDir: string): Promise<void> {
  await writeTextFile(joinPath(projectDir, "CHANGELOG.md"), changelogMd());
}
