import { dependabotYaml } from "../config/dependabot.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureDependabot(projectDir: string): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".github", "dependabot.yml"),
    dependabotYaml(),
  );
}
