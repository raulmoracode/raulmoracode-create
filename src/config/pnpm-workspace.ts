export const PNPM_MINIMUM_RELEASE_AGE = 10080;

export function pnpmWorkspaceYaml(): string {
  return `minimumReleaseAge: ${PNPM_MINIMUM_RELEASE_AGE}\n`;
}

/**
 * Strips the YAML quoting tools such as the shadcn CLI add around entries when
 * they write `minimumReleaseAgeExclude` themselves. Without this, re-merging an
 * existing file would double-quote the entries and produce invalid YAML.
 */
function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return trimmed.slice(1, -1).replaceAll("''", "'");
    }
  }
  return trimmed;
}

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export function collectLockedPackages(tree: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    const record = node as Record<string, unknown>;
    for (const section of DEPENDENCY_SECTIONS) {
      const deps = record[section];
      if (!deps || typeof deps !== "object") {
        continue;
      }
      for (const [name, child] of Object.entries(
        deps as Record<string, unknown>,
      )) {
        if (!child || typeof child !== "object") {
          continue;
        }
        const version = (child as Record<string, unknown>).version;
        if (typeof version === "string" && version.length > 0) {
          found.add(`${name}@${version}`);
        }
        visit(child);
      }
    }
  };
  if (Array.isArray(tree)) {
    for (const project of tree) {
      visit(project);
    }
  } else {
    visit(tree);
  }
  return [...found].sort();
}

export function mergePnpmWorkspaceYaml(
  existing: string | null,
  excludePackages: string[] = [],
): string {
  const releaseLine = `minimumReleaseAge: ${PNPM_MINIMUM_RELEASE_AGE}`;
  const base = !existing || existing.trim() === "" ? "" : existing;
  const lines = base === "" ? [] : base.split("\n");
  while (lines.length > 0 && (lines[lines.length - 1]?.trim() ?? "") === "") {
    lines.pop();
  }

  const preserved: string[] = [];
  const existingExcludes: string[] = [];
  let inExcludeBlock = false;
  for (const line of lines) {
    if (/^minimumReleaseAge\s*:/.test(line)) {
      continue;
    }
    if (/^minimumReleaseAgeExclude\s*:/.test(line)) {
      inExcludeBlock = true;
      continue;
    }
    if (inExcludeBlock) {
      const item = /^\s*-\s*(.+?)\s*$/.exec(line);
      if (item?.[1]) {
        const value = unquote(item[1]);
        if (value.length > 0) {
          existingExcludes.push(value);
        }
        continue;
      }
      if (line.trim() === "") {
        continue;
      }
      inExcludeBlock = false;
    }
    preserved.push(line);
  }

  const excludes = [
    ...new Set(
      [...existingExcludes, ...excludePackages]
        .map((pkg) => unquote(pkg))
        .filter((pkg) => pkg.length > 0),
    ),
  ].sort();
  const out = [releaseLine, ...preserved];
  if (excludes.length > 0) {
    out.push("minimumReleaseAgeExclude:");
    for (const pkg of excludes) {
      out.push(`  - '${pkg.replaceAll("'", "''")}'`);
    }
  }
  return `${out.join("\n")}\n`;
}
