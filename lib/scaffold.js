import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

/**
 * Official framework scaffolds, always invoked through pnpm.
 * Never via npm / yarn / bun.
 */
export function scaffoldCommands({ framework, projectName, projectDir }) {
  if (framework === "vite") {
    // NOTE: no `--` separator. Unlike npm, pnpm forwards extra args
    // directly, and `--template` after `--` is silently ignored
    // (scaffolds vanilla-ts instead of react-ts).
    return {
      command: "pnpm",
      args: ["create", "vite@latest", projectName, "--template", "react-ts"],
      cwd: dirname(projectDir),
    };
  }
  return {
    command: "pnpm",
    args: [
      "create",
      "next-app@latest",
      projectName,
      "--typescript",
      "--tailwind",
      "--app",
      "--src-dir",
      "--import-alias",
      "@/*",
      "--biome",
      "--use-pnpm",
      "--yes",
    ],
    cwd: dirname(projectDir),
  };
}

/** Execute the scaffold synchronously, inheriting stdio. Returns exit code. */
export function runScaffold({ command, args, cwd }) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) return 1;
  return result.status ?? 1;
}
