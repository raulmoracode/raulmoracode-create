import { ciWorkflowYaml } from "../config/ci.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureCi(projectDir: string): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".github", "workflows", "ci.yml"),
    ciWorkflowYaml(),
  );
}
