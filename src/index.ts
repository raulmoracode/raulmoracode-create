#!/usr/bin/env node
import { parseArgs, printHelp, VERSION } from "./cli/args.js";
import { migrate } from "./cli/migrate.js";
import { run } from "./cli/run.js";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.version) {
  console.log(VERSION);
  process.exit(0);
}

if (args.command === "migrate") {
  migrate({
    cwd: process.cwd(),
    dryRun: args.dryRun,
    verbose: args.verbose,
  })
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
} else {
  run({ verbose: args.verbose }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
