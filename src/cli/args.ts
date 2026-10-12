export const VERSION = "1.1.0";

export type CliCommand = "create" | "upgrade";

export interface CliArgs {
  command: CliCommand;
  help: boolean;
  version: boolean;
  verbose: boolean;
  check: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  return {
    command: positional[0] === "upgrade" ? "upgrade" : "create",
    help: argv.includes("--help") || argv.includes("-h"),
    version: argv.includes("--version") || argv.includes("-V"),
    verbose: argv.includes("--verbose"),
    check: argv.includes("--check") || argv.includes("--dry-run"),
  };
}

export function helpText(): string {
  return [
    `raulmoracode-create v${VERSION} — scaffolds React + Vite / Next.js projects.`,
    "",
    "Usage:",
    "  raulmoracode-create [options]           Create a new project",
    "  raulmoracode-create upgrade [options]   Upgrade the current project to this CLI version (opens a pull request)",
    "",
    "Options:",
    "  --verbose        Print the output of every external command.",
    "  --check, --dry-run",
    "                   (upgrade only) Show the planned upgrade without touching the project.",
    "                   Exits 1 when changes are pending, 0 when the project is up to date.",
    "  -h, --help       Show this help message.",
    "  -V, --version    Show the installed version.",
    "",
    "Examples:",
    "  raulmoracode-create",
    "  raulmoracode-create --verbose",
    "  raulmoracode-create upgrade",
    "  raulmoracode-create upgrade --check",
    "",
  ].join("\n");
}

export function printHelp(): void {
  console.log(helpText());
}
