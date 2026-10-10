import { pullRequestTemplate } from "../config/pull-request.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configurePrTemplate(projectDir: string): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".github", "pull_request_template.md"),
    pullRequestTemplate(),
  );
}
