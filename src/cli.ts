import type { CliOptions } from "./types.js";

const DEFAULT_MAX_CHARS = 120000;

export class HelpRequestedError extends Error {
  constructor() {
    super("Help requested.");
    this.name = "HelpRequestedError";
  }
}

function readRequiredOptionValue(argv: string[], index: number, optionName: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Please specify a value for ${optionName}.`);
  }
  return value;
}

function parsePatternList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePositiveInteger(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

export function parseArgs(argv: string[]): CliOptions {
  let inputDirectory: string | undefined;
  let outputDirectory: string | undefined;
  let maxChars = DEFAULT_MAX_CHARS;
  let includePatterns: string[] = [];
  let excludePatterns: string[] = [];
  let verbose = false;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      throw new HelpRequestedError();
    }

    if (arg === "--input-directory") {
      inputDirectory = readRequiredOptionValue(argv, i, "--input-directory");
      i += 1;
      continue;
    }

    if (arg === "--output-directory") {
      outputDirectory = readRequiredOptionValue(argv, i, "--output-directory");
      i += 1;
      continue;
    }

    if (arg === "--max-chars") {
      maxChars = parsePositiveInteger(readRequiredOptionValue(argv, i, "--max-chars"), "--max-chars");
      i += 1;
      continue;
    }

    if (arg === "--include") {
      includePatterns = parsePatternList(readRequiredOptionValue(argv, i, "--include"));
      i += 1;
      continue;
    }

    if (arg === "--exclude") {
      excludePatterns = parsePatternList(readRequiredOptionValue(argv, i, "--exclude"));
      i += 1;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    positional.push(arg);
  }

  if (!inputDirectory) {
    inputDirectory = positional[0];
  }

  if (!outputDirectory) {
    outputDirectory = positional[1];
  }

  if (positional.length > 2) {
    throw new Error(`Unexpected positional argument: ${positional[2]}`);
  }

  if (!inputDirectory) {
    throw new Error("Please specify an input directory.");
  }

  return {
    inputDirectory,
    outputDirectory,
    maxChars,
    includePatterns,
    excludePatterns,
    verbose,
  };
}

export function printHelp(): void {
  console.log(`Usage:
  miku-text-bundle <inputDir> [outputDir] [--max-chars 120000] [--include "glob"] [--exclude "glob"] [--verbose]
  miku-text-bundle --input-directory <dir> [--output-directory <dir>] [--max-chars 120000]

Description:
  Collect repository text files and generate split Markdown bundles for
  generative AI handoff. When outputDir is omitted, outputs are written under
  workplace/miku-text-bundle/<yyyyMMddHHmm>/.
`);
}
