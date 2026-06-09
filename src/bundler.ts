import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { discoverCandidateFiles } from "./discovery.js";
import { buildIndexMarkdown, buildPartMarkdown, buildPromptMarkdown } from "./markdown.js";
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

const MAX_BUNDLE_PART_NUMBER = 998;
const DEFAULT_FILENAME_PREFIX = "text-bundle";
const DEFAULT_MAX_INPUT_FILE_BYTES = 1_000_000;
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
    reason: `ファイルサイズが ${maxInputFileBytes} bytes の上限を超えたためスキップしました。`,
  };
}

function skippedForUnreadableFile(relativePath: string, encoding: SupportedEncoding): SkippedFile {
  return {
    relativePath,
    reason: `${formatEncoding(encoding)} として読めない、またはバイナリと判定したためスキップしました。`,
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
    splitReason: "このファイルはサイズ上限を超えたため、やむを得ず分割しました。",
  }));
}

function splitOversizedFile(file: CollectedFile, maxChars: number): BundleChunk[] {
  if (file.content.length <= maxChars) {
    return [createSingleFileChunk(file)];
  }

  return createSplitFileChunks(file, splitContentByMaxChars(file.content, maxChars));
}

function bundlePromptFileName(filenamePrefix: string): string {
  return `${filenamePrefix}-000-prompt.md`;
}

function bundlePartFileName(filenamePrefix: string, partNumber: number): string {
  return `${filenamePrefix}-${String(partNumber).padStart(3, "0")}.md`;
}

function bundleIndexFileName(filenamePrefix: string): string {
  return `${filenamePrefix}-999-index.md`;
}

function createBundlePart(filenamePrefix: string, partNumber: number, chunks: BundleChunk[], charCount: number): BundlePart {
  if (partNumber > MAX_BUNDLE_PART_NUMBER) {
    throw new Error(`Part count exceeds ${MAX_BUNDLE_PART_NUMBER}; ${bundleIndexFileName(filenamePrefix)} is reserved for the final index.`);
  }

  return {
    fileName: bundlePartFileName(filenamePrefix, partNumber),
    partNumber,
    chunks,
    charCount,
  };
}

function shouldStartNewPart(currentChunks: BundleChunk[], currentChars: number, nextChunk: BundleChunk, maxChars: number): boolean {
  return currentChunks.length > 0 && currentChars + nextChunk.content.length > maxChars;
}

function warningForSplitFile(file: CollectedFile, chunkCount: number): string {
  return `\`${file.relativePath}\` は --max-chars を超えたため ${chunkCount} 個に分割しました。`;
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

function buildParts(files: CollectedFile[], maxChars: number, filenamePrefix: string): BundlePartsResult {
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
    if (shouldStartNewPart(currentChunks, currentChars, chunk, maxChars)) {
      pushPart();
    }
    currentChunks.push(chunk);
    currentChars += chunk.content.length;
  }

  pushPart();
  return { parts, warnings };
}

function writeBundleMarkdownFiles(params: BundleMarkdownWriteParams): BundleMarkdownPaths {
  const { outputDirectory, filenamePrefix, inputDirectory, parts, collectedFiles, skippedFiles, markers, warnings } = params;
  const indexFileName = bundleIndexFileName(filenamePrefix);
  const promptFileName = bundlePromptFileName(filenamePrefix);
  const indexPath = join(outputDirectory, indexFileName);
  const promptPath = join(outputDirectory, promptFileName);
  const partPaths = parts.map((part) => join(outputDirectory, part.fileName));

  for (const part of parts) {
    writeFileSync(join(outputDirectory, part.fileName), buildPartMarkdown(part), "utf8");
  }

  writeFileSync(indexPath, buildIndexMarkdown({
    inputDirectory,
    outputDirectory,
    parts,
    collectedFiles,
    skippedFiles,
    markers,
    warnings,
  }), "utf8");

  writeFileSync(promptPath, buildPromptMarkdown({
    promptFileName,
    partFileNames: parts.map((part) => part.fileName),
    indexFileName,
  }), "utf8");

  return { indexPath, promptPath, partPaths };
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

function printGeneratedPaths(promptPath: string, partPaths: string[], indexPath: string): void {
  console.log(`generated: ${promptPath}`);
  for (const partPath of partPaths) {
    console.log(`generated: ${partPath}`);
  }
  console.log(`generated: ${indexPath}`);
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
  const { parts, warnings } = buildParts(files, options.maxChars, filenamePrefix);

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

  printGeneratedPaths(promptPath, partPaths, indexPath);

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
