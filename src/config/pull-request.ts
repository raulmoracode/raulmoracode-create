import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

/**
 * Validation checklist for the pull request body, gated by the tech
 * selection: `pnpm check` only exists with Biome and `pnpm test` only with
 * testing (a bare checklist would list commands whose scripts do not exist),
 * `pnpm e2e` only with Playwright, while `pnpm typecheck` and `pnpm build`
 * are always present in generated projects.
 */
function prValidationChecklist(selection: TechSelection): string[] {
  const items: string[] = [];
  if (selection.biome) {
    items.push("- [ ] `pnpm check`");
  }
  if (selection.testing) {
    items.push("- [ ] `pnpm test`");
  }
  if (selection.playwright) {
    items.push("- [ ] `pnpm e2e`");
  }
  items.push("- [ ] `pnpm typecheck`");
  items.push("- [ ] `pnpm build`");
  return items;
}

/**
 * The pull request body template written to `.github/pull_request_template.md`
 * in every generated project and embedded verbatim in the generated AGENTS.md
 * ("## Pull requests"), so the two can never diverge. The opening HTML comment
 * is not rendered by GitHub but tells the person opening the PR to write the
 * title and body in English; the checklist adapts to the tech selection.
 */
export function pullRequestTemplate(
  selection: TechSelection = FULL_TECH_SELECTION,
): string {
  return [
    "<!-- Write the PR body in English -->",
    "",
    "## Summary",
    "",
    "<!-- Briefly describe what this PR does and why. -->",
    "",
    "## Changes",
    "",
    "- ",
    "",
    "## How to test",
    "",
    "1. ",
    "2. ",
    "",
    "## Validation",
    "",
    ...prValidationChecklist(selection),
    "",
    "## Breaking changes",
    "",
    '<!-- List any breaking changes, or write "None". -->',
    "",
    "None",
    "",
  ].join("\n");
}
