import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { exec } from "../utils/exec.js";
import {
  joinPath,
  removeIfExists,
  writeTextFile,
} from "../utils/filesystem.js";
import { validateGitHubUrl } from "../utils/validation.js";
import { requireGhAuth } from "./gh.js";

/**
 * Branch protection for the fresh `main` branch is applied with a repository
 * **ruleset** (POST /repos/{owner}/{repo}/rulesets), not with the legacy
 * "protected branches" endpoints. Rulesets are GitHub's current, recommended
 * mechanism: the legacy API errors out on repositories that already have
 * rulesets enabled (GitHub keeps converting repos), while a ruleset keeps
 * working everywhere. The ruleset requires pull requests with an approval and
 * the generated CI (`validate`) as a required status check, and blocks force
 * pushes and deletions.
 */
export const MAIN_RULESET_NAME = "raulmoracode: protect main";

export const MAIN_BRANCH = "main";

export interface MainProtectionResult {
  status: "ok" | "warn";
  /** Copy-pasteable `gh api` command the user can run when apply failed. */
  manualCommand: string | null;
}

/**
 * JSON body for the ruleset. `requiredChecks` are the status check contexts
 * that must pass before merging (for GitHub Actions, the workflow job names).
 */
export function mainRulesetPayload(requiredChecks: readonly string[]): string {
  return JSON.stringify(
    {
      name: MAIN_RULESET_NAME,
      target: "branch",
      enforcement: "active",
      conditions: {
        ref_name: {
          include: [`refs/heads/${MAIN_BRANCH}`],
          exclude: [],
        },
      },
      rules: [
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 1,
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_review_thread_resolution: true,
          },
        },
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: true,
            do_not_enforce_on_create: false,
            required_status_checks: requiredChecks.map((context) => ({
              context,
            })),
          },
        },
        { type: "non_fast_forward" },
        { type: "deletion" },
      ],
    },
    null,
    2,
  );
}

/** `gh api` args that create the ruleset reading the body from `bodyFile`. */
export function ghMainRulesetArgs(
  owner: string,
  repo: string,
  bodyFile: string,
): string[] {
  return [
    "api",
    "--method",
    "POST",
    `repos/${owner}/${repo}/rulesets`,
    "--input",
    bodyFile,
  ];
}

/**
 * One-line, copy-pasteable equivalent of the automated call: pipes the same
 * JSON payload into `gh api ... --input -`.
 */
export function manualMainProtectionCommand(
  owner: string,
  repo: string,
  requiredChecks: readonly string[],
): string {
  const payload = JSON.stringify(
    JSON.parse(mainRulesetPayload(requiredChecks)),
  );
  return `echo '${payload}' | gh api --method POST repos/${owner}/${repo}/rulesets --input -`;
}

/**
 * Best-effort protection of `main` on the just-pushed repository. Never
 * throws: when `gh` is missing, unauthenticated, the repository cannot be
 * parsed or the API call fails (422 on invalid payload, 403 without admin
 * rights, ...), it returns a `warn` result carrying the exact manual command.
 * The scaffold is already complete on GitHub at this point, so failing the
 * whole run because protection could not be applied would discard finished
 * work — the caller shows a warning and continues.
 */
export async function applyMainProtection(
  githubUrl: string,
  requiredChecks: readonly string[],
  verbose: boolean,
): Promise<MainProtectionResult> {
  const parsed = validateGitHubUrl(githubUrl);
  if (!parsed.valid || !parsed.owner || !parsed.repo) {
    return { status: "warn", manualCommand: null };
  }
  try {
    await requireGhAuth(verbose);
  } catch {
    return unsuccessful(githubUrl, requiredChecks);
  }
  const { owner, repo } = parsed;
  const bodyFile = joinPath(
    tmpdir(),
    `raulmoracode-ruleset-${randomUUID()}.json`,
  );
  try {
    await writeTextFile(bodyFile, mainRulesetPayload(requiredChecks));
    await exec("gh", ghMainRulesetArgs(owner, repo, bodyFile), { verbose });
    return { status: "ok", manualCommand: null };
  } catch {
    return unsuccessful(githubUrl, requiredChecks);
  } finally {
    await removeIfExists(bodyFile);
  }
}

function unsuccessful(
  githubUrl: string,
  requiredChecks: readonly string[],
): MainProtectionResult {
  const parsed = validateGitHubUrl(githubUrl);
  const manualCommand =
    parsed.valid && parsed.owner && parsed.repo
      ? manualMainProtectionCommand(parsed.owner, parsed.repo, requiredChecks)
      : null;
  return { status: "warn", manualCommand };
}
