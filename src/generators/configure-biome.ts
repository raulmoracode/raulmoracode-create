import { biomeConfig } from "../config/biome.js";
import { exec } from "../utils/exec.js";
import {
  joinPath,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";

export const TOOLING_CONFIG_FILES = [
  "eslint.config.mjs",
  "eslint.config.js",
  ".oxlintrc.json",
  "_oxlintrc.json",
  "oxlint.json",
];

export async function configureBiome(projectDir: string): Promise<void> {
  await writeTextFile(joinPath(projectDir, "biome.json"), biomeConfig());
  for (const file of TOOLING_CONFIG_FILES) {
    await removeIfExists(joinPath(projectDir, file));
  }
}

export function biomeCheckWriteArgs(): string[] {
  return ["exec", "biome", "check", "--write", "."];
}

export async function formatProject(
  projectDir: string,
  verbose: boolean,
): Promise<void> {
  await exec("pnpm", biomeCheckWriteArgs(), { cwd: projectDir, verbose });
}
