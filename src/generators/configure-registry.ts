import { npmrcContent } from "../config/npmrc.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureRegistry(projectDir: string): Promise<void> {
  await writeTextFile(joinPath(projectDir, ".npmrc"), npmrcContent());
}
