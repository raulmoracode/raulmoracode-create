#!/usr/bin/env node
import { parseArgs, printHelp, VERSION } from "./cli/args.js";
import { run } from "./cli/run.js";
import { runUpgrade } from "./cli/upgrade.js";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.version) {
  console.log(VERSION);
  process.exit(0);
}

const main =
  args.command === "upgrade"
    ? runUpgrade({ verbose: args.verbose })
    : run({ verbose: args.verbose });

main.catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
