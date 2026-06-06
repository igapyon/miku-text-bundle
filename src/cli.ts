import type { CliOptions, EncodingOptions, SupportedEncoding } from "./types.js";
import { normalizePattern } from "./path-utils.js";

const CLI_DEFAULT_MAX_CHARS = 120000;
const CLI_DEFAULT_MAX_INPUT_FILE_BYTES = 1_000_000;
export const CLI_VERSION = "0.9.0";
const SUPPORTED_ENCODINGS = new Set<SupportedEncoding>(["utf-8", "shift_jis"]);
export const DEFAULT_EXCLUDE_EXTENSIONS = [
  ".7z",
  ".aac",
  ".avi",
  ".bmp",
  ".bz2",
  ".class",
  ".db",
  ".dll",
  ".doc",
  ".docx",
  ".dylib",
  ".exe",
  ".flac",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".parquet",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rar",
  ".so",
  ".sqlite",
  ".svgz",
  ".tar",
  ".tgz",
  ".tiff",
  ".ttf",
  ".war",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".xz",
  ".zip",
];
export const DEFAULT_EXCLUDE_DIRECTORIES = [
  ".git",
  ".codex",
  ".vscode",
  ".idea",
  "node_modules",
  "dist",
  "build",
  "target",
  "coverage",
  "workplace",
  "tmp",
  "temp",
];

type ParseState = {
  inputDirectory?: string;
  outputDirectory?: string;
  maxChars: number;
  maxInputFileBytes: number;
  encoding: EncodingOptions;
  excludeExtensions: Set<string>;
  excludeDirectories: Set<string>;
  verbose: boolean;
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

function parseExtensionList(value: string, optionName: string): string[] {
  return parsePatternList(value).map((item) => {
    const extension = item.toLowerCase();
    if (extension.length <= 1 || !extension.startsWith(".") || extension.includes("/") || extension.includes("\\")) {
      throw new Error(`${optionName} values must be extensions with a leading dot.`);
    }
    return extension;
  });
}

function parseDirectoryList(value: string, optionName: string): string[] {
  return parsePatternList(value).map((item) => {
    const directory = normalizePattern(item).replace(/\/+$/, "");
    if (directory.length === 0 || directory === ".") {
      throw new Error(`${optionName} values must be relative directory names or paths.`);
    }
    return directory;
  });
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
    excludeExtensions: new Set(DEFAULT_EXCLUDE_EXTENSIONS),
    excludeDirectories: new Set(DEFAULT_EXCLUDE_DIRECTORIES),
    verbose: false,
  };
}

function consumeOption(argv: string[], index: number, state: ParseState): number {
  const arg = argv[index];

  if (arg === "--help") {
    throw new HelpRequestedError();
  }

  if (arg === "--version") {
    throw new VersionRequestedError();
  }

  if (arg === "--input") {
    state.inputDirectory = readRequiredOptionValue(argv, index, "--input");
    return index + 1;
  }

  if (arg === "--output") {
    state.outputDirectory = readRequiredOptionValue(argv, index, "--output");
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

  if (arg === "--add-exclude-extension") {
    for (const extension of parseExtensionList(readRequiredOptionValue(argv, index, "--add-exclude-extension"), "--add-exclude-extension")) {
      state.excludeExtensions.add(extension);
    }
    return index + 1;
  }

  if (arg === "--remove-exclude-extension") {
    for (const extension of parseExtensionList(readRequiredOptionValue(argv, index, "--remove-exclude-extension"), "--remove-exclude-extension")) {
      state.excludeExtensions.delete(extension);
    }
    return index + 1;
  }

  if (arg === "--add-exclude-directory") {
    for (const directory of parseDirectoryList(readRequiredOptionValue(argv, index, "--add-exclude-directory"), "--add-exclude-directory")) {
      state.excludeDirectories.add(directory);
    }
    return index + 1;
  }

  if (arg === "--remove-exclude-directory") {
    for (const directory of parseDirectoryList(readRequiredOptionValue(argv, index, "--remove-exclude-directory"), "--remove-exclude-directory")) {
      state.excludeDirectories.delete(directory);
    }
    return index + 1;
  }

  if (arg === "--verbose") {
    state.verbose = true;
    return index;
  }

  if (arg.startsWith("-")) {
    throw new Error(`Unknown argument: ${arg}`);
  }

  throw new Error(`Positional arguments are not supported. Use --input and --output: ${arg}`);
}

function validateRequiredDirectories(state: ParseState): void {
  if (!state.inputDirectory) {
    throw new Error("Please specify --input.");
  }

  if (!state.outputDirectory) {
    throw new Error("Please specify --output.");
  }
}

export function parseArgs(argv: string[]): CliOptions {
  const state = createParseState();

  for (let i = 0; i < argv.length; i += 1) {
    i = consumeOption(argv, i, state);
  }

  validateRequiredDirectories(state);
  const inputDirectory = state.inputDirectory;
  const outputDirectory = state.outputDirectory;

  if (!inputDirectory || !outputDirectory) {
    throw new Error("Please specify --input and --output.");
  }

  return {
    inputDirectory,
    outputDirectory,
    maxChars: state.maxChars,
    maxInputFileBytes: state.maxInputFileBytes,
    encoding: state.encoding,
    excludeExtensions: [...state.excludeExtensions].sort((a, b) => a.localeCompare(b, "ja")),
    excludeDirectories: [...state.excludeDirectories].sort((a, b) => a.localeCompare(b, "ja")),
    verbose: state.verbose,
  };
}

export function printHelp(): void {
  console.log(`Usage:
  miku-text-bundle --input <dir> --output <dir> [options]
  miku-text-bundle --help
  miku-text-bundle --version

Options:
  --max-chars <number>
  --max-input-file-bytes <number>
  --encoding utf-8|shift_jis
  --encoding-extension ".java=shift_jis"
  --add-exclude-extension ".ext"
  --remove-exclude-extension ".ext"
  --add-exclude-directory "dir"
  --remove-exclude-directory "dir"
  --verbose

Description:
  Collect text-like files under the input directory and generate split
  Markdown bundles for generative AI handoff.
`);
}

export function printVersion(): void {
  console.log(CLI_VERSION);
}
