import { opencodeConfigJson } from "../config/opencode.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureOpencode(projectDir: string): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".opencode", "opencode.json"),
    opencodeConfigJson(),
  );
}
