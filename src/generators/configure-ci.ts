import { ciWorkflowYaml } from "../config/ci.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../config/tech.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureCi(
  projectDir: string,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".github", "workflows", "ci.yml"),
    ciWorkflowYaml(selection),
  );
}
