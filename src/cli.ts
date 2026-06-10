import type { CliOptions, EncodingOptions, SupportedEncoding } from "./types.js";
import { compareUtf16CodeUnits, normalizePattern } from "./path-utils.js";

const CLI_DEFAULT_MAX_CHARS = 120000;
const CLI_DEFAULT_MAX_INPUT_FILE_BYTES = 1_000_000;
const CLI_DEFAULT_FILENAME_PREFIX = "text-bundle";
export const CLI_VERSION = "1.0.1";
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
  filenamePrefix: string;
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

function parseFilenamePrefix(value: string): string {
  const prefix = value.trim();
  if (prefix.length === 0) {
    throw new Error("--filename-prefix must not be empty.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(prefix)) {
    throw new Error("--filename-prefix must contain only ASCII letters, digits, dots, underscores, and hyphens.");
  }
  return prefix;
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
    filenamePrefix: CLI_DEFAULT_FILENAME_PREFIX,
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

  if (arg === "--filename-prefix") {
    state.filenamePrefix = parseFilenamePrefix(readRequiredOptionValue(argv, index, "--filename-prefix"));
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
    filenamePrefix: state.filenamePrefix,
    maxChars: state.maxChars,
    maxInputFileBytes: state.maxInputFileBytes,
    encoding: state.encoding,
    excludeExtensions: [...state.excludeExtensions].sort(compareUtf16CodeUnits),
    excludeDirectories: [...state.excludeDirectories].sort(compareUtf16CodeUnits),
    verbose: state.verbose,
  };
}

export function printHelp(): void {
  console.log(`Usage:
  miku-text-bundle --input <dir> --output <dir> [options]
  miku-text-bundle --help
  miku-text-bundle --version

Description:
  Scan local text-like files under --input and generate split Markdown bundle
  files under --output for generative AI handoff. No network access is used.

Default behavior:
  Required: --input <dir>, --output <dir>
  Defaults: --filename-prefix text-bundle, --max-chars 120000,
  --max-input-file-bytes 1000000, --encoding utf-8.
  Input paths are ordered by POSIX relative path using UTF-16 code units.

Inputs:
  Reads regular files under --input. Skips known binary extensions, default
  excluded directories such as .git, node_modules, dist, coverage, target,
  workplace, and files ignored by the input root .gitignore.

Generated artifacts:
  <prefix>-000-prompt.md
  <prefix>-001.md ... <prefix>-998.md
  <prefix>-999-index.md
  These files are generated artifacts and may be regenerated.
  For Web UI, pasting <prefix>-000-prompt.md as the first message body is recommended, not required.

Output and overwrite behavior:
  Creates --output when missing. Existing generated files with the same names
  are overwritten. Terminal stdout is progress/completion text, not a stable
  machine-readable API. The Markdown files are the stable handoff artifacts.

Diagnostics and exit codes:
  Skipped readable-candidate files and split warnings are recorded in
  <prefix>-999-index.md. Invalid usage or processing errors are printed to
  stderr. Exit code 0 means success/help/version; exit code 1 means failure.

Options:
  --filename-prefix <prefix>       File basename prefix. Allowed: A-Z a-z 0-9 . _ -
  --max-chars <number>             Max approximate characters per part.
  --max-input-file-bytes <number>  Max bytes read from one input file.
  --encoding utf-8|shift_jis       Default input file encoding.
  --encoding-extension ".java=shift_jis"
  --add-exclude-extension ".ext"
  --remove-exclude-extension ".ext"
  --add-exclude-directory "dir"
  --remove-exclude-directory "dir"
  --verbose                        Print ignored-file count details.

Example:
  miku-text-bundle --input . --output out --filename-prefix my-repo-text-bundle
`);
}

export function printVersion(): void {
  console.log(CLI_VERSION);
}
