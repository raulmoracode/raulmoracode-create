import { playwrightConfig, playwrightSmokeSpec } from "../config/playwright.js";
import type { ProjectFramework } from "../frameworks/types.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configurePlaywright(
  projectDir: string,
  framework: ProjectFramework,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, "playwright.config.ts"),
    playwrightConfig(framework.id),
  );
  await writeTextFile(
    joinPath(projectDir, "e2e", "smoke.e2e.ts"),
    playwrightSmokeSpec(),
  );
}
