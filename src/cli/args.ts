export const VERSION = "1.0.5";

export interface CliArgs {
  help: boolean;
  version: boolean;
  verbose: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  return {
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
    "  raulmoracode-create [options]",
    "",
    "Options:",
    "  --verbose        Print the output of every external command.",
    "  -h, --help       Show this help message.",
    "  -V, --version    Show the installed version.",
    "",
    "Examples:",
    "  raulmoracode-create",
    "  raulmoracode-create --verbose",
    "",
  ].join("\n");
}

export function printHelp(): void {
  console.log(helpText());
}
