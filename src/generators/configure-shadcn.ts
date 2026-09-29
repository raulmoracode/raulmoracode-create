import { componentsJson, utilsTs } from "../config/components.js";
import type { ProjectFramework } from "../frameworks/types.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureShadcn(
  projectDir: string,
  framework: ProjectFramework,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, "components.json"),
    componentsJson(framework.componentsJsonOptions()),
  );
  await writeTextFile(
    joinPath(projectDir, "src", "lib", "utils.ts"),
    utilsTs(),
  );
}
