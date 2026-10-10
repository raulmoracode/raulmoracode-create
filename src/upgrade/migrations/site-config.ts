import {
  SITE_CONFIG_PATH,
  siteConfigTs,
  siteValues,
} from "../../config/site.js";
import type { MigrationResult, ProjectManifest } from "../types.js";
import type { UpgradeMigration } from "./index.js";
import { patchProjectFile } from "./support.js";

const SITE_CONFIG_OPEN = "export const site = {";
const SITE_CONFIG_CLOSE = "} as const;";
const SITE_FIELD_LINE = /^(\s+)([A-Za-z_$][\w$]*)\s*:\s*.+,\s*$/;
const SITE_COMMENT_LINE = /^\s*(\/\/|\/\*|\*\/|\*)/;
const DEFAULT_INDENT = "  ";

/**
 * Field names the CLI's current `src/config/site.ts` template renders, in
 * template order. They are read back from the template instead of copied, so
 * a field added to `SiteValues` reaches the migration without anybody having
 * to remember to update a second list.
 */
export function siteConfigTemplateFields(manifest: ProjectManifest): string[] {
  const values = siteValues({
    projectName: manifest.projectName,
    packageJson: {},
  });
  const fields: string[] = [];
  for (const line of siteConfigTs(values).split("\n")) {
    const name = SITE_FIELD_LINE.exec(line)?.[2];
    if (name !== undefined) {
      fields.push(name);
    }
  }
  return fields;
}

/**
 * Adds the fields the template renders and the project's `site` object is
 * missing, keeping every existing field (value, order and comments included).
 * The new fields start empty on purpose: an empty value is never rendered, so
 * the migration restores the shape both framework consumers expect without
 * inventing content the user never asked for.
 *
 * Returns `null` — nothing is touched — when the file has no recognizable
 * `site` object, when its body is not a plain list of fields (a spread, a
 * nested object, a field without its trailing comma) or when nothing is
 * missing, which makes the migration idempotent.
 */
export function mergeSiteConfigFields(
  content: string,
  templateFields: readonly string[],
): string | null {
  const lines = content.split("\n");
  const open = lines.findIndex((line) => line.trim() === SITE_CONFIG_OPEN);
  if (open < 0) {
    return null;
  }
  const close = lines.findIndex(
    (line, index) => index > open && line.trim() === SITE_CONFIG_CLOSE,
  );
  if (close < 0) {
    return null;
  }

  const present = new Set<string>();
  let indent: string | null = null;
  for (let index = open + 1; index < close; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || SITE_COMMENT_LINE.test(line)) {
      continue;
    }
    const match = SITE_FIELD_LINE.exec(line);
    if (match === null) {
      return null;
    }
    present.add(match[2] ?? "");
    if (indent === null && match[1]) {
      indent = match[1];
    }
  }

  const missing = templateFields.filter((field) => !present.has(field));
  if (missing.length === 0) {
    return null;
  }
  const prefix = indent ?? DEFAULT_INDENT;
  const added = missing.map((field) => `${prefix}${field}: "",`);
  return [...lines.slice(0, close), ...added, ...lines.slice(close)].join("\n");
}

export const migrateSiteConfig: UpgradeMigration = {
  id: "site-config-missing-fields",
  version: "1.0.9",
  handles: [],
  description: `Adds the fields the current \`${SITE_CONFIG_PATH}\` template defines that the project's \`site\` object is missing, keeping every value already set.`,
  why: "`src/config/site.ts` is not a managed file, so a project created before a new identity field existed never received it and the Vite plugin (or the Next.js `metadata` export) stops compiling when the CLI starts reading it. Merging the missing fields keeps the file the user owns.",
  async run(context): Promise<MigrationResult> {
    const templateFields = siteConfigTemplateFields(context.manifest);
    const written = await patchProjectFile(
      context.projectDir,
      SITE_CONFIG_PATH,
      (content) => mergeSiteConfigFields(content, templateFields),
    );
    return { touched: written ? [SITE_CONFIG_PATH] : [], removed: [] };
  },
};
