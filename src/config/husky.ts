import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

export function huskyPreCommit(
  selection: TechSelection = FULL_TECH_SELECTION,
): string {
  const lines: string[] = [];
  if (selection.biome) {
    lines.push("pnpm check");
  }
  if (selection.testing) {
    lines.push("pnpm test");
  }
  return [...lines, ""].join("\n");
}

export function huskyCommitMsg(): string {
  return ['pnpm exec commitlint --edit "$1"', ""].join("\n");
}
