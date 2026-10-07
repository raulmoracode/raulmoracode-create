import type { FileChange, UpgradeChangeNote, UpgradeReport } from "./types.js";

export const GITHUB_PR_BODY_LIMIT = 65_000;
export const MAX_DIFF_LINES = 400;
export const MAX_DIFF_CHARS = 8_000;
const DIFF_CONTEXT = 3;

const DIFF_BLOCK_BEGIN = "<!-- upgrade-pr:diff-begin -->";
const DIFF_BLOCK_END = "<!-- upgrade-pr:diff-end -->";
const DIFF_BLOCK_PATTERN =
  /[ \t]*<!-- upgrade-pr:diff-begin -->[\s\S]*?<!-- upgrade-pr:diff-end -->[ \t]*\n?/g;
const TRIM_NOTE_ANCHOR = "<!-- upgrade-pr:trim-note -->";
const TRIM_NOTE =
  "> [!NOTE]\n> Some inline diffs were trimmed to fit GitHub's pull request body limit. See the **Files changed** tab for the complete diffs.";

const NOT_TOUCHED = [
  "Application code under `src/`",
  "`README.md`",
  "`CHANGELOG.md`",
  "`LICENSE`",
];

export function upgradePrTitle(report: UpgradeReport): string {
  return `chore: upgrade raulmoracode-create to ${report.toVersion}`;
}

export function upgradePrBody(report: UpgradeReport): string {
  return [
    titleSection(report),
    summarySection(report),
    overwrittenSection(report),
    changesByVersionSection(report),
    dependenciesSection(report),
    migrationsSection(report),
    actionItemsSection(report),
    notTouchedSection(),
    commitsSection(report),
    footerSection(report),
  ]
    .filter((section) => section.length > 0)
    .join("\n\n")
    .concat("\n");
}

function titleSection(report: UpgradeReport): string {
  return [
    `# Upgrade raulmoracode-create ${report.fromVersion} → ${report.toVersion}`,
    TRIM_NOTE_ANCHOR,
  ].join("\n");
}

function summarySection(report: UpgradeReport): string {
  const counts = countFiles(report.files);
  const lines = [
    "## Summary",
    "",
    `This pull request upgrades a project scaffolded with \`raulmoracode-create\` from **${report.fromVersion}** to **${report.toVersion}** (framework: \`${report.framework}\`). The CLI re-renders the managed files it owns, refreshes the exact versions it pins and applies the migrations required to keep the project on the supported template. Nothing else in the repository is modified.`,
    "",
    "| Count | Value |",
    "| --- | ---: |",
    `| Files updated | ${counts.updated} |`,
    `| Files new | ${counts.new} |`,
    `| Files overwritten with local changes | ${counts.overwritten} |`,
    `| Files removed | ${counts.removed} |`,
    `| Files skipped | ${report.skippedFiles.length} |`,
    `| Dependencies updated | ${report.dependencies.length} |`,
    `| Dependencies kept as-is | ${report.keptDependencies.length} |`,
    `| Migrations applied | ${report.migrations.length} |`,
  ];
  if (counts.overwritten > 0) {
    lines.push(
      "",
      `> [!WARNING]`,
      `> ${counts.overwritten} file(s) had local changes and were overwritten. Review the section below before merging.`,
    );
  }
  return lines.join("\n");
}

function overwrittenSection(report: UpgradeReport): string {
  const overwritten = report.files.filter(
    (file) => file.status === "overwritten",
  );
  if (overwritten.length === 0) {
    return "";
  }
  const lines = [
    "## ⚠️ Overwritten files with local changes",
    "",
    `The ${overwritten.length} file(s) below had local modifications, so the upgrade could not merge them: the template version won. Each one is isolated in its own commit in this branch, so you can re-apply your customizations on top of it (or restore the previous content) and keep reviewing the rest of the upgrade.`,
  ];
  for (const file of overwritten) {
    lines.push("", `### \`${file.path}\``, "");
    const note = findNoteFor(report, file.path);
    if (note) {
      lines.push(`- **What**: ${note.what}`);
      lines.push(`- **Why**: ${note.why}`);
      lines.push(`- **Action**: ${note.action ?? "none"}`);
    } else {
      lines.push(
        "- _No upgrade note for this file: it was updated as part of the upgrade but no release note describes it._",
      );
    }
    lines.push("", diffBlock(file), "");
    lines.push(
      `Re-apply your customizations to \`${file.path}\` in this branch; the overwritten version is isolated in its own commit.`,
    );
  }
  return lines.join("\n").trimEnd();
}

function changesByVersionSection(report: UpgradeReport): string {
  const notes = [...report.notes].sort((a, b) =>
    a.version.localeCompare(b.version, undefined, { numeric: true }),
  );
  if (notes.length === 0) {
    return "## Changes by version\n\n_No release between the two versions changes the generated project._";
  }
  const lines = ["## Changes by version"];
  for (const entry of notes) {
    lines.push("", `### ${entry.version}`, "", entry.summary, "");
    lines.push("| File | Status | +/− lines | What | Why |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const change of entry.changes) {
      for (const path of change.files.length > 0 ? change.files : ["—"]) {
        const file = findFile(report.files, path);
        lines.push(
          `| ${escapeCell(path)} | ${escapeCell(file ? file.status : "—")} | ${file ? escapeCell(diffCounts(file.previousContent, file.nextContent)) : "—"} | ${escapeCell(change.what)} | ${escapeCell(change.why)} |`,
        );
      }
    }
    const actions = entry.changes
      .map((change) => change.action)
      .filter((action): action is string => Boolean(action));
    if (actions.length > 0) {
      lines.push("", "**Action**:", "");
      for (const action of actions) {
        lines.push(`- ${action}`);
      }
    }
    for (const path of filesInChanges(entry.changes)) {
      const file = findFile(report.files, path);
      if (!file || file.previousContent === null || file.nextContent === null) {
        continue;
      }
      const block = diffBlock(file);
      if (block.length > 0) {
        lines.push("", block);
      }
    }
  }
  return lines.join("\n").trimEnd();
}

function dependenciesSection(report: UpgradeReport): string {
  const lines = ["## Dependencies"];
  if (report.dependencies.length === 0) {
    lines.push("", "_No dependency changed._");
  } else {
    lines.push("", "| Package | Type | From | To | Note |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const dependency of report.dependencies) {
      const note = dependency.hadLocalVersion ? "had a local version" : "—";
      lines.push(
        `| ${escapeCell(dependency.name)} | ${escapeCell(dependency.type)} | ${escapeCell(dependency.from ?? "—")} | ${escapeCell(dependency.to)} | ${escapeCell(note)} |`,
      );
    }
  }
  if (report.keptDependencies.length > 0) {
    lines.push("", "### Kept as-is", "");
    lines.push("| Package | CLI pin | Reason |");
    lines.push("| --- | --- | --- |");
    for (const kept of report.keptDependencies) {
      lines.push(
        `| ${escapeCell(kept.name)} | ${escapeCell(kept.pinned)} | ${escapeCell(kept.reason)} |`,
      );
    }
  }
  return lines.join("\n");
}

function migrationsSection(report: UpgradeReport): string {
  if (report.migrations.length === 0) {
    return "## Migrations\n\n_No migration had to be applied._";
  }
  const lines = ["## Migrations", ""];
  for (const migration of report.migrations) {
    lines.push(
      `### ${migration.id}`,
      "",
      `- **Version**: ${migration.version}`,
      `- **Description**: ${migration.description}`,
      `- **Why**: ${migration.why}`,
    );
  }
  return lines.join("\n");
}

function actionItemsSection(report: UpgradeReport): string {
  const paths = new Set<string>([
    ...report.files.map((file) => file.path),
    ...report.skippedFiles.map((file) => file.path),
    ...report.notes.flatMap((entry) =>
      entry.changes.flatMap((change) => change.files),
    ),
  ]);
  const items: string[] = [];
  const hasOverwritten = report.files.some(
    (file) => file.status === "overwritten",
  );
  items.push(
    hasOverwritten
      ? "Re-apply or drop the local customizations of every overwritten file listed in the ⚠️ section."
      : "Review the whole diff of this pull request before merging.",
  );
  for (const action of uniqueActions(report.notes)) {
    items.push(action);
  }
  if (
    [...paths].some(
      (path) =>
        /(^|\/)(biome\.json|\.vscode\/settings\.json)$/.test(path) ||
        path.includes("biome"),
    )
  ) {
    items.push("Run `pnpm check` (Biome config and hooks may have changed).");
  }
  if (
    [...paths].some(
      (path) => path.includes("vitest") || path.includes("src/test"),
    )
  ) {
    items.push("Run `pnpm test` and make sure the suite still passes.");
  }
  if ([...paths].some((path) => path.startsWith(".github/workflows/"))) {
    items.push("Verify the CI workflow runs green on this branch.");
  }
  items.push(
    "Delete nothing else: this branch only touches files managed by `raulmoracode-create`.",
  );
  return ["## Action items", "", ...items.map((item) => `- [ ] ${item}`)].join(
    "\n",
  );
}

function notTouchedSection(): string {
  return [
    "## Not touched",
    "",
    "The upgrade never manages these paths, so they are guaranteed to be unchanged by this pull request:",
    "",
    ...NOT_TOUCHED.map((entry) => `- ${entry}`),
  ].join("\n");
}

function commitsSection(report: UpgradeReport): string {
  if (report.commits.length === 0) {
    return "## Commits\n\n_No commits were recorded for this upgrade._";
  }
  return [
    "## Commits",
    "",
    ...report.commits.map((commit, index) => `${index + 1}. ${commit}`),
  ].join("\n");
}

function footerSection(report: UpgradeReport): string {
  const lines = [
    "---",
    "",
    `Generated by \`raulmoracode-create\` \`upgrade\` (v${report.toVersion}). Do not edit by hand.`,
  ];
  if (report.changelogUrl.trim().length > 0) {
    lines.push("", `Changelog: ${report.changelogUrl}`);
  }
  return lines.join("\n");
}

interface FileCounts {
  updated: number;
  new: number;
  overwritten: number;
  removed: number;
}

function countFiles(files: FileChange[]): FileCounts {
  const counts: FileCounts = { updated: 0, new: 0, overwritten: 0, removed: 0 };
  for (const file of files) {
    counts[file.status] += 1;
  }
  return counts;
}

function findFile(files: FileChange[], path: string): FileChange | undefined {
  return files.find((file) => file.path === path);
}

function filesInChanges(changes: UpgradeChangeNote[]): string[] {
  const paths: string[] = [];
  for (const change of changes) {
    for (const path of change.files) {
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
  }
  return paths;
}

function findNoteFor(
  report: UpgradeReport,
  path: string,
): UpgradeChangeNote | undefined {
  for (const entry of report.notes) {
    const change = entry.changes.find((candidate) =>
      candidate.files.includes(path),
    );
    if (change) {
      return change;
    }
  }
  return undefined;
}

function uniqueActions(notes: UpgradeReport["notes"]): string[] {
  const actions: string[] = [];
  for (const entry of notes) {
    for (const change of entry.changes) {
      if (change.action && !actions.includes(change.action)) {
        actions.push(change.action);
      }
    }
  }
  return actions;
}

function diffBlock(file: FileChange): string {
  const diff = unifiedDiff(file.previousContent, file.nextContent);
  if (diff.length === 0) {
    return `${DIFF_BLOCK_BEGIN}\n_No content changes recorded for this file._\n${DIFF_BLOCK_END}`;
  }
  return [
    DIFF_BLOCK_BEGIN,
    "<details>",
    `<summary>Diff for <code>${escapeInline(file.path)}</code></summary>`,
    "",
    "```diff",
    diff,
    "```",
    "",
    "</details>",
    DIFF_BLOCK_END,
  ].join("\n");
}

export interface DiffLineCounts {
  added: number;
  removed: number;
}

type DiffOp = {
  kind: " " | "-" | "+";
  text: string;
  oldLine: number;
  newLine: number;
};

function normaliseLines(content: string): string[] {
  const normalised = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalised.length === 0) {
    return [];
  }
  const lines = normalised.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function buildOps(previous: string[], next: string[]): DiffOp[] {
  const rows = previous.length;
  const columns = next.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(columns + 1).fill(0),
  );
  for (let i = rows - 1; i >= 0; i -= 1) {
    const row = table[i] as number[];
    const below = table[i + 1] as number[];
    for (let j = columns - 1; j >= 0; j -= 1) {
      row[j] =
        previous[i] === next[j]
          ? (below[j + 1] as number) + 1
          : Math.max(below[j] as number, row[j + 1] as number);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;
  while (i < rows && j < columns) {
    if (previous[i] === next[j]) {
      ops.push({ kind: " ", text: previous[i] as string, oldLine, newLine });
      i += 1;
      j += 1;
      oldLine += 1;
      newLine += 1;
      continue;
    }
    const below = table[i + 1] as number[];
    const current = table[i] as number[];
    if ((below[j] as number) >= (current[j + 1] as number)) {
      ops.push({ kind: "-", text: previous[i] as string, oldLine, newLine });
      i += 1;
      oldLine += 1;
      continue;
    }
    ops.push({ kind: "+", text: next[j] as string, oldLine, newLine });
    j += 1;
    newLine += 1;
  }
  while (i < rows) {
    ops.push({ kind: "-", text: previous[i] as string, oldLine, newLine });
    i += 1;
    oldLine += 1;
  }
  while (j < columns) {
    ops.push({ kind: "+", text: next[j] as string, oldLine, newLine });
    j += 1;
    newLine += 1;
  }
  return ops;
}

function renderHunks(ops: DiffOp[]): string[] {
  const changed = ops
    .map((op, index) => (op.kind === " " ? -1 : index))
    .filter((index) => index >= 0);
  if (changed.length === 0) {
    return [];
  }
  const ranges: { start: number; end: number }[] = [];
  for (const index of changed) {
    const start = Math.max(0, index - DIFF_CONTEXT);
    const end = Math.min(ops.length - 1, index + DIFF_CONTEXT);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
      continue;
    }
    ranges.push({ start, end });
  }
  const lines: string[] = [];
  for (const range of ranges) {
    const slice = ops.slice(range.start, range.end + 1);
    const first = slice[0] as DiffOp;
    const oldCount = slice.filter((op) => op.kind !== "+").length;
    const newCount = slice.filter((op) => op.kind !== "-").length;
    lines.push(
      `@@ -${first.oldLine},${oldCount} +${first.newLine},${newCount} @@`,
    );
    for (const op of slice) {
      lines.push(`${op.kind}${op.text}`);
    }
  }
  return lines;
}

/** Counts of added/removed lines between two file contents. */
export function diffLineCounts(
  previousContent: string | null,
  nextContent: string | null,
): DiffLineCounts {
  const previous = normaliseLines(previousContent ?? "");
  const next = normaliseLines(nextContent ?? "");
  const ops = buildOps(previous, next);
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.kind === "+") added += 1;
    if (op.kind === "-") removed += 1;
  }
  return { added, removed };
}

/** `+N −M` summary of the difference between two file contents. */
export function diffCounts(
  previousContent: string | null,
  nextContent: string | null,
): string {
  const { added, removed } = diffLineCounts(previousContent, nextContent);
  return `+${added} −${removed}`;
}

export function unifiedDiff(
  previousContent: string | null,
  nextContent: string | null,
): string {
  const previous = normaliseLines(previousContent ?? "");
  const next = normaliseLines(nextContent ?? "");
  const previousCapped = previous.slice(0, MAX_DIFF_LINES);
  const nextCapped = next.slice(0, MAX_DIFF_LINES);
  const ops = buildOps(previousCapped, nextCapped);
  const body = renderHunks(ops).join("\n");
  if (body.length === 0) {
    return "";
  }
  const notes: string[] = [];
  if (previous.length > MAX_DIFF_LINES || next.length > MAX_DIFF_LINES) {
    notes.push(
      `@@ diff truncated to the first ${MAX_DIFF_LINES} lines of each file (previous: ${previous.length}, next: ${next.length}) @@`,
    );
  }
  if (body.length > MAX_DIFF_CHARS) {
    const kept = body.slice(0, MAX_DIFF_CHARS);
    const lastNewline = kept.lastIndexOf("\n");
    return `${kept.slice(0, lastNewline > 0 ? lastNewline : MAX_DIFF_CHARS)}\n@@ diff truncated (${body.length - MAX_DIFF_CHARS} more characters) @@`;
  }
  return [...notes, body].join("\n");
}

/**
 * GitHub rejects pull request bodies longer than ~65 000 characters. Diffs are
 * the only expendable content: they are collapsed first and dropped after that,
 * never the summary, the ⚠️ section, the tables or the action items. Idempotent.
 */
export function truncateForGithub(body: string): string {
  if (body.length <= GITHUB_PR_BODY_LIMIT) {
    return body;
  }
  const collapsed = body.replace(
    DIFF_BLOCK_PATTERN,
    `${DIFF_BLOCK_BEGIN}\n\n_Diff trimmed: see the **Files changed** tab._\n\n${DIFF_BLOCK_END}`,
  );
  const shortened =
    collapsed.length <= GITHUB_PR_BODY_LIMIT
      ? collapsed
      : collapsed.replace(
          DIFF_BLOCK_PATTERN,
          `${DIFF_BLOCK_BEGIN}\n${DIFF_BLOCK_END}`,
        );
  if (shortened.includes(TRIM_NOTE)) {
    return shortened;
  }
  if (shortened.includes(TRIM_NOTE_ANCHOR)) {
    return shortened.replace(TRIM_NOTE_ANCHOR, TRIM_NOTE);
  }
  return `${shortened.trimEnd()}\n\n${TRIM_NOTE}\n`;
}

function escapeCell(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, "<br>")
    .trim();
}

function escapeInline(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
