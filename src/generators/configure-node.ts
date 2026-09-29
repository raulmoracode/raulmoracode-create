import { editorconfigContent } from "../config/editorconfig.js";
import { NODE_VERSION, nvmrcContent } from "../config/nvmrc.js";
import { joinPath, readTextFile, writeTextFile } from "../utils/filesystem.js";

const REQUIRED_GITIGNORE_ENTRIES = [
  "node_modules",
  "dist",
  ".env",
  ".env.*",
  ".next",
  "coverage",
];

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
  const existing = new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const missing = REQUIRED_GITIGNORE_ENTRIES.filter(
    (entry) => !existing.has(entry),
  );
  if (missing.length === 0) return;
  const merged = content.replace(/\s+$/, "");
  const next = merged
    ? `${merged}\n${missing.join("\n")}\n`
    : `${missing.join("\n")}\n`;
  await writeTextFile(gitignorePath, next);
}
