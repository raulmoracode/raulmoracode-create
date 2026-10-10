import {
  joinPath,
  readTextFile,
  writeTextFile,
} from "../../utils/filesystem.js";

/** Reads a project file, or `null` when it does not exist. */
export async function readProjectFile(
  projectDir: string,
  path: string,
): Promise<string | null> {
  try {
    return await readTextFile(joinPath(projectDir, path));
  } catch {
    return null;
  }
}

/**
 * Applies a pure merge to one project file. The merge returns `null` when
 * there is nothing to do, so a missing file, a file the user rewrote beyond
 * recognition and an already correct file are all left untouched: nothing is
 * written and nothing is ever overwritten wholesale.
 *
 * @returns `true` when the file was written.
 */
export async function patchProjectFile(
  projectDir: string,
  path: string,
  merge: (content: string) => string | null,
): Promise<boolean> {
  const content = await readProjectFile(projectDir, path);
  if (content === null) {
    return false;
  }
  const next = merge(content);
  if (next === null) {
    return false;
  }
  await writeTextFile(joinPath(projectDir, path), next);
  return true;
}
