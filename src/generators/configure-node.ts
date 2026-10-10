import { editorconfigContent } from "../config/editorconfig.js";
import {
  mergeGitignoreEntries,
  REQUIRED_GITIGNORE_ENTRIES,
} from "../config/gitignore.js";
import { NODE_VERSION, nvmrcContent } from "../config/nvmrc.js";
import { joinPath, readTextFile, writeTextFile } from "../utils/filesystem.js";

export async function configureNode(projectDir: string): Promise<void> {
  await writeTextFile(joinPath(projectDir, ".nvmrc"), nvmrcContent());
}

export function nodeVersion(): string {
  return NODE_VERSION;
}

export async function configureEditorconfig(projectDir: string): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".editorconfig"),
    editorconfigContent(),
  );
}

export function requiredGitignoreEntries(): string[] {
  return [...REQUIRED_GITIGNORE_ENTRIES];
}

export async function augmentGitignore(projectDir: string): Promise<void> {
  const gitignorePath = joinPath(projectDir, ".gitignore");
  let content = "";
  try {
    content = await readTextFile(gitignorePath);
  } catch {
    content = "";
  }
  const merged = mergeGitignoreEntries(content);
  if (merged === null) return;
  await writeTextFile(gitignorePath, merged);
}
