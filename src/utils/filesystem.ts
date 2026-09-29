import {
  access,
  chmod,
  mkdir,
  readdir,
  readFile,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function isDirectoryEmpty(path: string): Promise<boolean> {
  const entries = await readdir(path);
  return entries.length === 0;
}

export async function listDirEntries(path: string): Promise<string[]> {
  return readdir(path);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeTextFile(
  path: string,
  content: string,
): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, content, "utf8");
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function stripJsonComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  while (i < content.length) {
    const char = content[i] ?? "";
    if (inString) {
      result += char;
      if (char === "\\") {
        result += content[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      i += 1;
      continue;
    }
    if (char === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (char === "/" && content[i + 1] === "*") {
      i += 2;
      while (
        i < content.length &&
        !(content[i] === "*" && content[i + 1] === "/")
      ) {
        i += 1;
      }
      i += 2;
      continue;
    }
    result += char;
    i += 1;
  }
  return result;
}

export function parseJsonc<T>(content: string): T {
  return JSON.parse(stripJsonComments(content)) as T;
}

export async function removeIfExists(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function joinPath(...parts: string[]): string {
  return join(...parts);
}

export function resolvePath(...parts: string[]): string {
  return resolve(...parts);
}

export async function removeEmptyDir(path: string): Promise<boolean> {
  try {
    await rmdir(path);
    return true;
  } catch {
    return false;
  }
}

export async function makeExecutable(path: string): Promise<void> {
  await chmod(path, 0o755);
}
