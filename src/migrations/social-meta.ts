import {
  hasNextSocialMeta,
  hasViteSocialMeta,
  socialMetaOptions,
  withNextSocialMeta,
  withViteSocialMeta,
} from "../config/social-meta.js";
import { joinPath, readTextFile, writeTextFile } from "../utils/filesystem.js";
import type { Migration, MigrationOutcome } from "./types.js";

const VITE_INDEX = "index.html";
const NEXT_LAYOUT = joinPath("src", "app", "layout.tsx");

export const socialMetaMigration: Migration = {
  id: "social-meta",

  target(project) {
    if (project.framework === "vite") {
      return VITE_INDEX;
    }
    if (project.framework === "next") {
      return NEXT_LAYOUT;
    }
    return null;
  },

  async isApplied(project) {
    const target = socialMetaMigration.target(project);
    if (!target) {
      return false;
    }
    const content = await readTextFile(joinPath(project.root, target));
    return project.framework === "next"
      ? hasNextSocialMeta(content)
      : hasViteSocialMeta(content);
  },

  async apply(project): Promise<MigrationOutcome> {
    const target = socialMetaMigration.target(project);
    if (!target) {
      return {
        id: socialMetaMigration.id,
        status: "skipped",
        target: null,
        message:
          "No se detectó un proyecto de React + Vite ni de Next.js: la migración se omite.",
      };
    }
    const path = joinPath(project.root, target);
    const current = await readTextFile(path);
    const options = socialMetaOptions(project.projectName, project.packageJson);
    const patch =
      project.framework === "next"
        ? withNextSocialMeta(current, options)
        : withViteSocialMeta(current, options);
    if (patch.kind === "conflict") {
      return {
        id: socialMetaMigration.id,
        status: "conflict",
        target,
        message: patch.message,
        manual: patch.manual,
      };
    }
    if (!patch.changed) {
      return {
        id: socialMetaMigration.id,
        status: "skipped",
        target,
        message: "Los metadatos ya estaban presentes.",
      };
    }
    await writeTextFile(path, patch.content);
    return { id: socialMetaMigration.id, status: "applied", target };
  },
};
