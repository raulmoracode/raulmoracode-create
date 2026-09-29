#!/usr/bin/env node
import { parseArgs, printHelp, VERSION } from "./cli/args.js";
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

run({ verbose: args.verbose }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
