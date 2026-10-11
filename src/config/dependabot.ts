import { PNPM_MINIMUM_RELEASE_AGE } from "./pnpm-workspace.js";

/** `minimumReleaseAge` is configured in minutes; Dependabot cooldown in days. */
const MINIMUM_RELEASE_AGE_DAYS = PNPM_MINIMUM_RELEASE_AGE / 1440;

/**
 * `.github/dependabot.yml` for a generated project.
 *
 * - `package-ecosystem: npm` is what pnpm projects use: Dependabot detects
 *   `pnpm-lock.yaml` and drives `pnpm` to update it. `directory: /` targets
 *   the root manifest (the only workspace here).
 * - `versioning-strategy: increase` keeps the exact-pin policy: for an exact
 *   version it bumps to the exact new version. `widen` would introduce range
 *   constraints and `increase-if-necessary`/`lockfile-only` would leave stale
 *   `package.json` pins.
 * - `cooldown.default-days` mirrors `minimumReleaseAge: 10080` (7 days) in
 *   `pnpm-workspace.yaml`: Dependabot only proposes version updates for
 *   releases older than the pnpm maturity gate, so its `pnpm update` sandbox
 *   run cannot be rejected with `ERR_PNPM_NO_MATCHING_VERSION`. Security
 *   updates are exempt from the cooldown, so critical fixes are never delayed.
 * - Minor and patch bumps are grouped into one PR; majors stay individual.
 */
export function dependabotYaml(): string {
  return [
    "version: 2",
    "updates:",
    "  - package-ecosystem: npm # pnpm projects use the npm ecosystem",
    "    directory: /",
    "    schedule:",
    "      interval: weekly",
    "    versioning-strategy: increase # bumps exact versions, never creates ranges",
    "    cooldown:",
    `      # Same 7-day maturity gate as pnpm-workspace.yaml (minimumReleaseAge: ${PNPM_MINIMUM_RELEASE_AGE})`,
    `      default-days: ${MINIMUM_RELEASE_AGE_DAYS}`,
    "    groups:",
    "      minor-and-patch:",
    "        applies-to: version-updates",
    "        update-types:",
    "          - minor",
    "          - patch",
    "",
  ].join("\n");
}
