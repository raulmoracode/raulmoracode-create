import { pullRequestTemplate } from "../config/pull-request.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../config/tech.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configurePrTemplate(
  projectDir: string,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".github", "pull_request_template.md"),
    pullRequestTemplate(selection),
  );
}
