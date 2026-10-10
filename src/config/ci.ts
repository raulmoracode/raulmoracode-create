import { FULL_TECH_SELECTION, type TechSelection } from "./tech.js";

export function ciWorkflowYaml(
  selection: TechSelection = FULL_TECH_SELECTION,
): string {
  const steps = [
    "      - run: pnpm install --no-frozen-lockfile",
    ...(selection.biome ? ["      - run: pnpm check"] : []),
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
    "  validate:",
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
