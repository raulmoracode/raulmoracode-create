import { commitlintConfig } from "../config/commitlint.js";
import { huskyCommitMsg, huskyPreCommit } from "../config/husky.js";
import { FULL_TECH_SELECTION, type TechSelection } from "../config/tech.js";
import {
  joinPath,
  makeExecutable,
  writeTextFile,
} from "../utils/filesystem.js";

export async function configureGitHooks(
  projectDir: string,
  selection: TechSelection = FULL_TECH_SELECTION,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".husky", "pre-commit"),
    huskyPreCommit(selection),
  );
  await writeTextFile(
    joinPath(projectDir, ".husky", "commit-msg"),
    huskyCommitMsg(),
  );
  await makeExecutable(joinPath(projectDir, ".husky", "pre-commit"));
  await makeExecutable(joinPath(projectDir, ".husky", "commit-msg"));
  await writeTextFile(
    joinPath(projectDir, "commitlint.config.ts"),
    commitlintConfig(),
  );
}
