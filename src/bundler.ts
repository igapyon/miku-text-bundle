import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { CLI_VERSION } from "./cli.js";
import { discoverCandidateFiles } from "./discovery.js";
import { buildPartMarkdown } from "./markdown.js";
import { parseGitignore } from "./match.js";
import { getExtension, toPosixPath } from "./path-utils.js";
import type { BundleChunk, BundlePart, BundleResult, CliOptions, CollectedFile, IgnoreStats, Marker, SkippedFile, SupportedEncoding } from "./types.js";

type CollectedFilesResult = {
  files: CollectedFile[];
  skipped: SkippedFile[];
  ignored: IgnoreStats;
};

type BundleChunksResult = {
  chunks: BundleChunk[];
  warnings: string[];
};

type BundlePartsResult = {
  parts: BundlePart[];
  warnings: string[];
};

type BundlePartReserves = {
  firstPartChars: number;
  lastPartChars: number;
};

type BundleMarkdownWriteParams = {
  outputDirectory: string;
  filenamePrefix: string;
  inputDirectory: string;
  parts: BundlePart[];
  collectedFiles: CollectedFile[];
  skippedFiles: SkippedFile[];
  markers: Marker[];
  warnings: string[];
};

type BundleMarkdownPaths = {
  indexPath: string;
  promptPath: string;
  partPaths: string[];
};

const MAX_BUNDLE_PART_NUMBER = 999;
const DEFAULT_FILENAME_PREFIX = "text-bundle";
const DEFAULT_MAX_INPUT_FILE_BYTES = 1_000_000;
const EMBEDDED_SECTION_RESERVE_MARGIN_CHARS = 256;
const EMBEDDED_SECTION_RESERVE_MARGIN_RATIO = 0.1;
const DEFAULT_ENCODING_OPTIONS = {
  default: "utf-8",
  extensions: {} as Record<string, SupportedEncoding>,
} satisfies NonNullable<CliOptions["encoding"]>;

function normalizeFilenamePrefix(value: string): string {
  const prefix = value.trim();
  if (prefix.length === 0) {
    throw new Error("filenamePrefix must not be empty.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(prefix)) {
    throw new Error("filenamePrefix must contain only ASCII letters, digits, dots, underscores, and hyphens.");
  }
  return prefix;
}

export function chooseOutputDirectory(outputDirectory: string): string {
  return resolve(outputDirectory);
}

function relativeInputPath(inputPath: string, filePath: string): string {
  return toPosixPath(relative(inputPath, filePath));
}

function displayPathFromCurrentDirectory(pathValue: string): string {
  const relativePath = relative(process.cwd(), pathValue);
  return relativePath.length === 0 ? "." : toPosixPath(relativePath);
}

function readRootGitignore(inputPath: string): string[] {
  const gitignorePath = join(inputPath, ".gitignore");
  if (!statSync(gitignorePath, { throwIfNoEntry: false })?.isFile()) {
    return [];
  }
  return parseGitignore(readFileSync(gitignorePath, "utf8"));
}

function selectEncoding(relativePath: string, options: CliOptions): SupportedEncoding {
  const extension = extname(relativePath);
  const encoding = options.encoding ?? DEFAULT_ENCODING_OPTIONS;
  return encoding.extensions[extension] ?? encoding.default;
}

function decodeText(buffer: Buffer, encoding: SupportedEncoding): string | undefined {
  if (buffer.includes(0)) {
    return undefined;
  }

  try {
    return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

function formatEncoding(encoding: SupportedEncoding): string {
  return encoding === "utf-8" ? "UTF-8" : "Shift_JIS";
}

function extractMarkers(relativePath: string, content: string): Marker[] {
  return content.split(/\r?\n/).flatMap((lineText, index) => {
    const match = lineText.match(/\b(TODO|FIXME|XXX)\b(?!\.)(.*)/);
    if (!match) {
      return [];
    }

    return [{
      relativePath,
      line: index + 1,
      kind: match[1] as Marker["kind"],
      text: lineText.trim(),
    }];
  });
}

function skippedForOversizedFile(relativePath: string, maxInputFileBytes: number): SkippedFile {
  return {
    relativePath,
    reason: `File size exceeds the ${maxInputFileBytes} byte limit.`,
  };
}

function skippedForUnreadableFile(relativePath: string, encoding: SupportedEncoding): SkippedFile {
  return {
    relativePath,
    reason: `Skipped because the file cannot be decoded as ${formatEncoding(encoding)} or was detected as binary.`,
  };
}

function createCollectedFile(filePath: string, relativePath: string, content: string): CollectedFile {
  return {
    absolutePath: filePath,
    relativePath,
    extension: getExtension(filePath),
    content,
    charCount: content.length,
    lineCount: content.length === 0 ? 0 : content.split(/\r?\n/).length,
    markers: extractMarkers(relativePath, content),
  };
}

function collectFiles(inputPath: string, outputPath: string, options: CliOptions, gitignorePatterns: string[]): CollectedFilesResult {
  const files: CollectedFile[] = [];
  const skipped: SkippedFile[] = [];
  const maxInputFileBytes = options.maxInputFileBytes ?? DEFAULT_MAX_INPUT_FILE_BYTES;
  const discovered = discoverCandidateFiles(inputPath, outputPath, options, gitignorePatterns);

  for (const filePath of discovered.files) {
    const relativePath = relativeInputPath(inputPath, filePath);
    const fileStat = statSync(filePath);
    if (fileStat.size > maxInputFileBytes) {
      skipped.push(skippedForOversizedFile(relativePath, maxInputFileBytes));
      continue;
    }

    const buffer = readFileSync(filePath);
    const encoding = selectEncoding(relativePath, options);
    const content = decodeText(buffer, encoding);

    if (content === undefined) {
      skipped.push(skippedForUnreadableFile(relativePath, encoding));
      continue;
    }

    files.push(createCollectedFile(filePath, relativePath, content));
  }

  return { files, skipped, ignored: discovered.ignored };
}

function createSingleFileChunk(file: CollectedFile): BundleChunk {
  return {
    relativePath: file.relativePath,
    extension: file.extension,
    content: file.content,
    originalCharCount: file.charCount,
    originalLineCount: file.lineCount,
    chunkIndex: 1,
    chunkCount: 1,
  };
}

function splitContentByMaxChars(content: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of content.split(/(?<=\n)/)) {
    if (current.length > 0 && current.length + line.length > maxChars) {
      chunks.push(current);
      current = "";
    }

    if (line.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += maxChars) {
        chunks.push(line.slice(i, i + maxChars));
      }
      continue;
    }

    current += line;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function createSplitFileChunks(file: CollectedFile, chunkContents: string[]): BundleChunk[] {
  const chunkCount = chunkContents.length;
  return chunkContents.map((content, index) => ({
    relativePath: file.relativePath,
    extension: file.extension,
    content,
    originalCharCount: file.charCount,
    originalLineCount: file.lineCount,
    chunkIndex: index + 1,
    chunkCount,
    splitReason: "This file exceeded the size limit and was split.",
  }));
}

function splitOversizedFile(file: CollectedFile, maxChars: number): BundleChunk[] {
  if (file.content.length <= maxChars) {
    return [createSingleFileChunk(file)];
  }

  return createSplitFileChunks(file, splitContentByMaxChars(file.content, maxChars));
}

function bundlePromptFileName(filenamePrefix: string): string {
  return `${filenamePrefix}-001.md`;
}

function bundlePartFileName(filenamePrefix: string, partNumber: number): string {
  return `${filenamePrefix}-${String(partNumber).padStart(3, "0")}.md`;
}

function createBundlePart(filenamePrefix: string, partNumber: number, chunks: BundleChunk[], charCount: number): BundlePart {
  if (partNumber > MAX_BUNDLE_PART_NUMBER) {
    throw new Error(`Part count exceeds ${MAX_BUNDLE_PART_NUMBER}; only three-digit part file names are supported.`);
  }

  return {
    fileName: bundlePartFileName(filenamePrefix, partNumber),
    partNumber,
    chunks,
    charCount,
  };
}

function effectiveMaxChars(maxChars: number, reservedChars: number): number {
  return Math.max(1, maxChars - reservedChars);
}

function shouldStartNewPart(currentChunks: BundleChunk[], currentChars: number, nextChunk: BundleChunk, maxChars: number): boolean {
  return currentChunks.length > 0 && currentChars + nextChunk.content.length > maxChars;
}

function warningForSplitFile(file: CollectedFile, chunkCount: number): string {
  return `\`${file.relativePath}\` exceeded --max-chars and was split into ${chunkCount} chunks.`;
}

function buildChunks(files: CollectedFile[], maxChars: number): BundleChunksResult {
  const warnings: string[] = [];
  const chunks = files.flatMap((file) => {
    const fileChunks = splitOversizedFile(file, maxChars);
    if (fileChunks.length > 1) {
      warnings.push(warningForSplitFile(file, fileChunks.length));
    }
    return fileChunks;
  });

  return { chunks, warnings };
}

function renumberParts(parts: BundlePart[], filenamePrefix: string): BundlePart[] {
  return parts.map((part, index) => createBundlePart(filenamePrefix, index + 1, part.chunks, part.charCount));
}

function shrinkLastPartForReserve(parts: BundlePart[], maxChars: number, filenamePrefix: string, lastPartReservedChars: number): BundlePart[] {
  const lastPartMaxChars = effectiveMaxChars(maxChars, lastPartReservedChars);
  const adjustedParts = parts.map((part) => ({ ...part, chunks: [...part.chunks] }));

  while (adjustedParts.length > 0) {
    const lastPart = adjustedParts[adjustedParts.length - 1]!;
    if (lastPart.charCount <= lastPartMaxChars || lastPart.chunks.length <= 1) {
      break;
    }

    const movedChunks: BundleChunk[] = [];
    let movedCharCount = 0;
    while (lastPart.charCount > lastPartMaxChars && lastPart.chunks.length > 1) {
      const movedChunk = lastPart.chunks.pop()!;
      movedChunks.unshift(movedChunk);
      movedCharCount += movedChunk.content.length;
      lastPart.charCount -= movedChunk.content.length;
    }

    adjustedParts.push(createBundlePart(filenamePrefix, adjustedParts.length + 1, movedChunks, movedCharCount));
  }

  return renumberParts(adjustedParts, filenamePrefix);
}

function withReserveSafetyMargin(charCount: number): number {
  return Math.ceil(charCount * (1 + EMBEDDED_SECTION_RESERVE_MARGIN_RATIO)) + EMBEDDED_SECTION_RESERVE_MARGIN_CHARS;
}

function buildParts(files: CollectedFile[], maxChars: number, filenamePrefix: string, reserves: BundlePartReserves = { firstPartChars: 0, lastPartChars: 0 }): BundlePartsResult {
  const { chunks, warnings } = buildChunks(files, maxChars);

  const parts: BundlePart[] = [];
  let currentChunks: BundleChunk[] = [];
  let currentChars = 0;

  const pushPart = (): void => {
    if (currentChunks.length === 0) {
      return;
    }
    parts.push(createBundlePart(filenamePrefix, parts.length + 1, currentChunks, currentChars));
    currentChunks = [];
    currentChars = 0;
  };

  for (const chunk of chunks) {
    const currentPartNumber = parts.length + 1;
    const currentMaxChars = effectiveMaxChars(maxChars, currentPartNumber === 1 ? reserves.firstPartChars : 0);
    if (shouldStartNewPart(currentChunks, currentChars, chunk, currentMaxChars)) {
      pushPart();
    }
    currentChunks.push(chunk);
    currentChars += chunk.content.length;
  }

  pushPart();
  if (parts.length === 0) {
    parts.push(createBundlePart(filenamePrefix, 1, [], 0));
  }
  return { parts: shrinkLastPartForReserve(parts, maxChars, filenamePrefix, reserves.lastPartChars), warnings };
}

function writeBundleMarkdownFiles(params: BundleMarkdownWriteParams): BundleMarkdownPaths {
  const { outputDirectory, filenamePrefix, inputDirectory, parts, collectedFiles, skippedFiles, markers, warnings } = params;
  const promptFileName = bundlePromptFileName(filenamePrefix);
  const promptPath = join(outputDirectory, promptFileName);
  const partPaths = parts.map((part) => join(outputDirectory, part.fileName));
  const indexFileName = parts.at(-1)?.fileName ?? promptFileName;
  const indexPath = join(outputDirectory, indexFileName);

  for (const [index, part] of parts.entries()) {
    const isFirstPart = index === 0;
    const isLastPart = index === parts.length - 1;
    writeFileSync(join(outputDirectory, part.fileName), buildPartMarkdown(part, {
      toolName: "miku-text-bundle",
      toolVersion: CLI_VERSION,
    }, {
      prompt: isFirstPart ? {
        promptFileName,
        partFileNames: parts.map((bundlePart) => bundlePart.fileName),
        indexFileName,
        toolName: "miku-text-bundle",
        toolVersion: CLI_VERSION,
      } : undefined,
      index: isLastPart ? {
        inputDirectory: displayPathFromCurrentDirectory(inputDirectory),
        outputDirectory: displayPathFromCurrentDirectory(outputDirectory),
        parts,
        collectedFiles,
        skippedFiles,
        markers,
        warnings,
        terminalFileName: indexFileName,
        toolName: "miku-text-bundle",
        toolVersion: CLI_VERSION,
      } : undefined,
    }), "utf8");
  }

  return { indexPath, promptPath, partPaths };
}

function estimateEmbeddedPromptChars(parts: BundlePart[], filenamePrefix: string): number {
  const promptFileName = bundlePromptFileName(filenamePrefix);
  const indexFileName = parts.at(-1)?.fileName ?? promptFileName;
  const emptyPart = createBundlePart(filenamePrefix, 1, [], 0);
  const metadata = {
    toolName: "miku-text-bundle",
    toolVersion: CLI_VERSION,
  };

  return buildPartMarkdown(emptyPart, metadata, {
    prompt: {
      promptFileName,
      partFileNames: parts.map((part) => part.fileName),
      indexFileName,
      ...metadata,
    },
  }).length - buildPartMarkdown(emptyPart, metadata).length;
}

function estimateEmbeddedIndexChars(params: {
  filenamePrefix: string;
  inputDirectory: string;
  outputDirectory: string;
  parts: BundlePart[];
  collectedFiles: CollectedFile[];
  skippedFiles: SkippedFile[];
  markers: Marker[];
  warnings: string[];
}): number {
  const { filenamePrefix, inputDirectory, outputDirectory, parts, collectedFiles, skippedFiles, markers, warnings } = params;
  const lastPartNumber = Math.max(parts.length, 1);
  const emptyPart = createBundlePart(filenamePrefix, lastPartNumber, [], 0);
  const metadata = {
    toolName: "miku-text-bundle",
    toolVersion: CLI_VERSION,
  };
  const terminalFileName = parts.at(-1)?.fileName ?? bundlePromptFileName(filenamePrefix);

  return buildPartMarkdown(emptyPart, metadata, {
    index: {
      inputDirectory: displayPathFromCurrentDirectory(inputDirectory),
      outputDirectory: displayPathFromCurrentDirectory(outputDirectory),
      parts,
      collectedFiles,
      skippedFiles,
      markers,
      warnings,
      terminalFileName,
      ...metadata,
    },
  }).length - buildPartMarkdown(emptyPart, metadata).length;
}

function buildPartsWithEmbeddedReserves(params: {
  files: CollectedFile[];
  maxChars: number;
  filenamePrefix: string;
  inputDirectory: string;
  outputDirectory: string;
  skippedFiles: SkippedFile[];
  markers: Marker[];
}): BundlePartsResult {
  const { files, maxChars, filenamePrefix, inputDirectory, outputDirectory, skippedFiles, markers } = params;
  let result = buildParts(files, maxChars, filenamePrefix);

  for (let index = 0; index < 5; index += 1) {
    const reserves = {
      firstPartChars: withReserveSafetyMargin(estimateEmbeddedPromptChars(result.parts, filenamePrefix)),
      lastPartChars: withReserveSafetyMargin(estimateEmbeddedIndexChars({
        filenamePrefix,
        inputDirectory,
        outputDirectory,
        parts: result.parts,
        collectedFiles: files,
        skippedFiles,
        markers,
        warnings: result.warnings,
      })),
    };
    const nextResult = buildParts(files, maxChars, filenamePrefix, reserves);
    if (nextResult.parts.length === result.parts.length) {
      return nextResult;
    }
    result = nextResult;
  }

  return result;
}

function printVerboseSummary(files: CollectedFile[], skipped: SkippedFile[], parts: BundlePart[], ignored: IgnoreStats): void {
  console.log(`collected=${files.length}`);
  console.log(`skipped=${skipped.length}`);
  console.log(`parts=${parts.length}`);
  console.log(`ignoredDirectories=${ignored.directories}`);
  console.log(`ignoredFiles=${ignored.files}`);
  console.log(`ignoredByDirectory=${ignored.byDirectory}`);
  console.log(`ignoredByExtension=${ignored.byExtension}`);
  console.log(`ignoredByGitignore=${ignored.byGitignore}`);
  console.log(`ignoredByOutputDirectory=${ignored.byOutputDirectory}`);
}

function printGeneratedPaths(partPaths: string[]): void {
  for (const partPath of partPaths) {
    console.log(`generated: ${partPath}`);
  }
}

export function createTextBundle(options: CliOptions, now = new Date()): BundleResult {
  void now;
  const inputPath = resolve(options.inputDirectory);
  const inputStat = statSync(inputPath, { throwIfNoEntry: false });

  if (!inputStat?.isDirectory()) {
    throw new Error(`Input directory does not exist: ${inputPath}`);
  }

  const outputDirectory = chooseOutputDirectory(options.outputDirectory);
  const filenamePrefix = normalizeFilenamePrefix(options.filenamePrefix ?? DEFAULT_FILENAME_PREFIX);
  mkdirSync(outputDirectory, { recursive: true });

  const gitignorePatterns = readRootGitignore(inputPath);
  const { files, skipped, ignored } = collectFiles(inputPath, outputDirectory, options, gitignorePatterns);
  const markers = files.flatMap((file) => file.markers);
  const { parts, warnings } = buildPartsWithEmbeddedReserves({
    files,
    maxChars: options.maxChars,
    filenamePrefix,
    inputDirectory: inputPath,
    outputDirectory,
    skippedFiles: skipped,
    markers,
  });

  const { indexPath, promptPath, partPaths } = writeBundleMarkdownFiles({
    outputDirectory,
    filenamePrefix,
    inputDirectory: inputPath,
    parts,
    collectedFiles: files,
    skippedFiles: skipped,
    markers,
    warnings,
  });

  if (options.verbose) {
    printVerboseSummary(files, skipped, parts, ignored);
  }

  printGeneratedPaths(partPaths);

  return {
    outputDirectory,
    indexPath,
    promptPath,
    partPaths,
    filesCollected: files.length,
    filesSkipped: skipped.length,
    directoriesIgnored: ignored.directories,
    filesIgnored: ignored.files,
    ignoredByDirectory: ignored.byDirectory,
    ignoredByExtension: ignored.byExtension,
    ignoredByGitignore: ignored.byGitignore,
    ignoredByOutputDirectory: ignored.byOutputDirectory,
    partsGenerated: parts.length,
    warnings,
  };
}
