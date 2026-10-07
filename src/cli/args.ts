export const VERSION = "1.0.7";

export type CliCommand = "create" | "upgrade";

export interface CliArgs {
  command: CliCommand;
  help: boolean;
  version: boolean;
  verbose: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  return {
    command: positional[0] === "upgrade" ? "upgrade" : "create",
    help: argv.includes("--help") || argv.includes("-h"),
    version: argv.includes("--version") || argv.includes("-V"),
    verbose: argv.includes("--verbose"),
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
    "  -h, --help       Show this help message.",
    "  -V, --version    Show the installed version.",
    "",
    "Examples:",
    "  raulmoracode-create",
    "  raulmoracode-create --verbose",
    "  raulmoracode-create upgrade",
    "",
  ].join("\n");
}

export function printHelp(): void {
  console.log(helpText());
}
