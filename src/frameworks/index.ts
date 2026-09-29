import type { Framework } from "../utils/validation.js";
import { nextFramework } from "./next.js";
import type { ProjectFramework } from "./types.js";
import { viteFramework } from "./vite.js";

export const frameworks: Record<Framework, ProjectFramework> = {
  vite: viteFramework,
  next: nextFramework,
};

export function getFramework(id: Framework): ProjectFramework {
  return frameworks[id];
}

export type { ProjectFramework } from "./types.js";
