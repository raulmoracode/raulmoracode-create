import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

/**
 * Name of the CI job in the generated `.github/workflows/ci.yml`. The branch
 * protection rule applied after the initial push requires this exact job
 * (`github/branch-protection.ts`), so it must stay a single source of truth.
 */
export const CI_VALIDATE_JOB = "validate";

export function ciWorkflowYaml(
  selection: TechSelection = FULL_TECH_SELECTION,
): string {
  const steps = [
    "      - run: pnpm install --no-frozen-lockfile",
    ...(selection.biome ? ["      - run: pnpm check"] : []),
    "      - run: pnpm typecheck",
    ...(selection.testing ? ["      - run: pnpm test"] : []),
    "      - run: pnpm build",
  ];
  return [
    "name: CI",
    "",
    "on:",
    "  push:",
    "  pull_request:",
    "",
    "jobs:",
    `  ${CI_VALIDATE_JOB}:`,
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "",
    "      - uses: pnpm/action-setup@v4",
    "        with:",
    "          version: 12.6.0",
    "",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 24",
    "          cache: pnpm",
    "",
    ...steps,
    "",
  ].join("\n");
}
