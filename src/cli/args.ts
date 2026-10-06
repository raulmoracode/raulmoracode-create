export const VERSION = "1.0.4";

export type CliCommand = "create" | "migrate";

export interface CliArgs {
  help: boolean;
  version: boolean;
  verbose: boolean;
  dryRun: boolean;
  command: CliCommand;
}

const MIGRATE_COMMAND = "migrate";

export function parseArgs(argv: string[]): CliArgs {
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  const command: CliCommand =
    positional[0] === MIGRATE_COMMAND ? "migrate" : "create";
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    version: argv.includes("--version") || argv.includes("-V"),
    verbose: argv.includes("--verbose"),
    dryRun: argv.includes("--dry-run"),
    command,
  };
}

export function helpText(): string {
  return [
    `raulmoracode-create v${VERSION} — scaffolds React + Vite / Next.js projects.`,
    "",
    "Usage:",
    "  raulmoracode-create [options]        Create a new project.",
    "  raulmoracode-create migrate [options]",
    "                                        Apply the template migrations a project",
    "                                        created by an older version is missing.",
    "",
    "Options:",
    "  --dry-run        With migrate: report what would change, write nothing.",
    "  --verbose        Print the output of every external command.",
    "  -h, --help       Show this help.",
    "  -V, --version    Show the installed version.",
    "",
    "Examples:",
    "  raulmoracode-create",
    "  raulmoracode-create --verbose",
    "  pnpm dlx @raulmoracode/create@latest migrate --dry-run",
    "",
  ].join("\n");
}

export function printHelp(): void {
  console.log(helpText());
}
