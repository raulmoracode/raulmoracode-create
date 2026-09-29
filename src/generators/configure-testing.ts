import { smokeTest, vitestConfig } from "../config/testing.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureTesting(projectDir: string): Promise<void> {
  await writeTextFile(joinPath(projectDir, "vitest.config.ts"), vitestConfig());
  await writeTextFile(
    joinPath(projectDir, "src", "test", "smoke.test.tsx"),
    smokeTest(),
  );
}
