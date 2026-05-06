#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { HelpRequestedError, parseArgs, printHelp, printVersion, VersionRequestedError } from "./cli.js";
import { createTextBundle } from "./bundler.js";

export type {
  BundleChunk,
  BundlePart,
  BundleResult,
  CliOptions,
  CollectedFile,
  Marker,
  SkippedFile,
} from "./types.js";
export { CLI_VERSION, HelpRequestedError, parseArgs, printHelp, printVersion, VersionRequestedError } from "./cli.js";
export { createTextBundle, chooseOutputDirectory, defaultOutputBase } from "./bundler.js";
export { buildIndexMarkdown, buildPartMarkdown, buildPromptMarkdown } from "./markdown.js";
export { matchesAnyPattern, matchesGitignore, parseGitignore } from "./match.js";
export { getExtension, normalizePattern, toPosixPath } from "./path-utils.js";

export function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = createTextBundle(options);
    console.log(`completed: ${result.partsGenerated} part(s), ${result.filesCollected} file(s) collected`);
  } catch (error) {
    if (error instanceof HelpRequestedError) {
      printHelp();
      process.exit(0);
    }

    if (error instanceof VersionRequestedError) {
      printVersion();
      process.exit(0);
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    printHelp();
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
