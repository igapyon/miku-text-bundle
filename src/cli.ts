import type { CliOptions, EncodingOptions, SupportedEncoding } from "./types.js";

const CLI_DEFAULT_MAX_CHARS = 120000;
const CLI_DEFAULT_MAX_INPUT_FILE_BYTES = 1_000_000;
export const CLI_VERSION = "0.5.4";
const SUPPORTED_ENCODINGS = new Set<SupportedEncoding>(["utf-8", "shift_jis"]);

type ParseState = {
  inputDirectory?: string;
  outputDirectory?: string;
  maxChars: number;
  maxInputFileBytes: number;
  encoding: EncodingOptions;
  includePatterns: string[];
  excludePatterns: string[];
  verbose: boolean;
  positional: string[];
};

export class HelpRequestedError extends Error {
  constructor() {
    super("Help requested.");
    this.name = "HelpRequestedError";
  }
}

export class VersionRequestedError extends Error {
  constructor() {
    super("Version requested.");
    this.name = "VersionRequestedError";
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

function parseSupportedEncoding(value: string, optionName: string): SupportedEncoding {
  if (SUPPORTED_ENCODINGS.has(value as SupportedEncoding)) {
    return value as SupportedEncoding;
  }
  throw new Error(`${optionName} must be one of: utf-8, shift_jis.`);
}

function parseEncodingExtensions(value: string): Record<string, SupportedEncoding> {
  const extensions: Record<string, SupportedEncoding> = {};

  for (const item of parsePatternList(value)) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === item.length - 1) {
      throw new Error("--encoding-extension entries must use .ext=encoding format.");
    }

    const extension = item.slice(0, separatorIndex).trim();
    const encoding = item.slice(separatorIndex + 1).trim();
    if (!extension.startsWith(".") || extension.includes("/") || extension.includes("\\")) {
      throw new Error("--encoding-extension keys must be exact extensions with a leading dot.");
    }

    extensions[extension] = parseSupportedEncoding(encoding, "--encoding-extension");
  }

  return extensions;
}

function createParseState(): ParseState {
  return {
    maxChars: CLI_DEFAULT_MAX_CHARS,
    maxInputFileBytes: CLI_DEFAULT_MAX_INPUT_FILE_BYTES,
    encoding: {
      default: "utf-8",
      extensions: {},
    },
    includePatterns: [],
    excludePatterns: [],
    verbose: false,
    positional: [],
  };
}

function consumeOption(argv: string[], index: number, state: ParseState): number {
  const arg = argv[index];

  if (arg === "--help" || arg === "-h") {
    throw new HelpRequestedError();
  }

  if (arg === "--version" || arg === "-v") {
    throw new VersionRequestedError();
  }

  if (arg === "--input-directory") {
    state.inputDirectory = readRequiredOptionValue(argv, index, "--input-directory");
    return index + 1;
  }

  if (arg === "--output-directory") {
    state.outputDirectory = readRequiredOptionValue(argv, index, "--output-directory");
    return index + 1;
  }

  if (arg === "--max-chars") {
    state.maxChars = parsePositiveInteger(readRequiredOptionValue(argv, index, "--max-chars"), "--max-chars");
    return index + 1;
  }

  if (arg === "--max-input-file-bytes") {
    state.maxInputFileBytes = parsePositiveInteger(readRequiredOptionValue(argv, index, "--max-input-file-bytes"), "--max-input-file-bytes");
    return index + 1;
  }

  if (arg === "--encoding") {
    state.encoding.default = parseSupportedEncoding(readRequiredOptionValue(argv, index, "--encoding"), "--encoding");
    return index + 1;
  }

  if (arg === "--encoding-extension") {
    state.encoding.extensions = {
      ...state.encoding.extensions,
      ...parseEncodingExtensions(readRequiredOptionValue(argv, index, "--encoding-extension")),
    };
    return index + 1;
  }

  if (arg === "--include") {
    state.includePatterns = parsePatternList(readRequiredOptionValue(argv, index, "--include"));
    return index + 1;
  }

  if (arg === "--exclude") {
    state.excludePatterns = parsePatternList(readRequiredOptionValue(argv, index, "--exclude"));
    return index + 1;
  }

  if (arg === "--verbose") {
    state.verbose = true;
    return index;
  }

  if (arg.startsWith("--")) {
    throw new Error(`Unknown argument: ${arg}`);
  }

  state.positional.push(arg);
  return index;
}

function applyPositionalDirectories(state: ParseState): void {
  if (!state.inputDirectory) {
    state.inputDirectory = state.positional[0];
  }

  if (!state.outputDirectory) {
    state.outputDirectory = state.positional[1];
  }

  if (state.positional.length > 2) {
    throw new Error(`Unexpected positional argument: ${state.positional[2]}`);
  }

  if (!state.inputDirectory) {
    throw new Error("Please specify an input directory.");
  }
}

export function parseArgs(argv: string[]): CliOptions {
  const state = createParseState();

  for (let i = 0; i < argv.length; i += 1) {
    i = consumeOption(argv, i, state);
  }

  applyPositionalDirectories(state);
  const inputDirectory = state.inputDirectory;

  if (!inputDirectory) {
    throw new Error("Please specify an input directory.");
  }

  return {
    inputDirectory,
    outputDirectory: state.outputDirectory,
    maxChars: state.maxChars,
    maxInputFileBytes: state.maxInputFileBytes,
    encoding: state.encoding,
    includePatterns: state.includePatterns,
    excludePatterns: state.excludePatterns,
    verbose: state.verbose,
  };
}

export function printHelp(): void {
  console.log(`Usage:
  miku-text-bundle <inputDir> [outputDir] [--max-chars 120000] [--max-input-file-bytes 1000000] [--encoding utf-8|shift_jis] [--encoding-extension ".java=shift_jis"] [--include "glob"] [--exclude "glob"] [--verbose]
  miku-text-bundle --input-directory <dir> [--output-directory <dir>] [--max-chars 120000] [--max-input-file-bytes 1000000] [--encoding utf-8|shift_jis]
  miku-text-bundle --help
  miku-text-bundle --version

Description:
  Collect repository text files and generate split Markdown bundles for
  generative AI handoff. When outputDir is omitted, outputs are written under
  workplace/miku-text-bundle/<yyyyMMddHHmm>/.
`);
}

export function printVersion(): void {
  console.log(CLI_VERSION);
}
