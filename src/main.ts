#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HelpRequestedError, parseArgs, printHelp, printVersion, VersionRequestedError } from "./cli.js";
import { createTextBundle } from "./bundler.js";

export type {
  BundleChunk,
  BundlePart,
  BundleResult,
  CliOptions,
  CollectedFile,
  EncodingOptions,
  IgnoreStats,
  Marker,
  SkippedFile,
  SupportedEncoding,
} from "./types.js";
export {
  CLI_VERSION,
  DEFAULT_EXCLUDE_DIRECTORIES,
  DEFAULT_EXCLUDE_EXTENSIONS,
  HelpRequestedError,
  parseArgs,
  printHelp,
  printVersion,
  VersionRequestedError,
} from "./cli.js";
export { createTextBundle, chooseOutputDirectory } from "./bundler.js";
export { discoverCandidateFiles } from "./discovery.js";
export { buildIndexMarkdown, buildPartMarkdown, buildPromptMarkdown } from "./markdown.js";
export { matchesAnyPattern, matchesGitignore, parseGitignore } from "./match.js";
export { compareUtf16CodeUnits, getExtension, normalizePattern, toPosixPath } from "./path-utils.js";

function isCliEntrypoint(metaUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

export function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = createTextBundle(options);
    const prefix = result.dryRun ? "dry-run" : "completed";
    const suffix = result.dryRun ? ", no files written" : "";
    console.log(`${prefix}: ${result.partsGenerated} part(s), ${result.filesCollected} file(s) collected, ${result.filesSkipped} file(s) skipped, ${result.directoriesIgnored} directories ignored, ${result.filesIgnored} file(s) ignored${suffix}`);
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

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  main();
}
