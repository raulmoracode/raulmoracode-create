import { envExample } from "../config/env-example.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";
import type { Framework } from "../utils/validation.js";

export const ENV_EXAMPLE_PATH = ".env.example";

/**
 * Writes `.env.example`, the committed template every developer copies to
 * `.env` before filling in real values (the generated AGENTS.md instructs
 * coding agents to do exactly that). The placeholders are framework-specific:
 * `VITE_*` on Vite, `NEXT_PUBLIC_*` (plus a server-only variable) on Next.js.
 */
export async function configureEnvExample(
  projectDir: string,
  frameworkId: Framework,
): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ENV_EXAMPLE_PATH),
    envExample(frameworkId),
  );
}
