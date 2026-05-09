import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { buildIndexMarkdown, buildPartMarkdown, buildPromptMarkdown } from "./markdown.js";
import { matchesAnyPattern, matchesGitignore, parseGitignore } from "./match.js";
import { getExtension, toPosixPath } from "./path-utils.js";
import type { BundleChunk, BundlePart, BundleResult, CliOptions, CollectedFile, Marker, SkippedFile, SupportedEncoding } from "./types.js";

type CollectedFilesResult = {
  files: CollectedFile[];
  skipped: SkippedFile[];
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

const DEFAULT_SOURCE_DIRECTORIES = ["src", "lib", "app", "test", "tests"];
const DEFAULT_SOURCE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "java", "cs"]);
const DEFAULT_ROOT_FILES = ["README.md", "TODO.md"];
const INDEX_FILE_NAME = "text-bundle-000-index.md";
const PROMPT_FILE_NAME = "text-bundle-000-prompt.md";
const DEFAULT_MAX_INPUT_FILE_BYTES = 1_000_000;
const DEFAULT_ENCODING_OPTIONS = {
  default: "utf-8",
  extensions: {} as Record<string, SupportedEncoding>,
} satisfies NonNullable<CliOptions["encoding"]>;

function formatTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function defaultOutputBase(inputDirectory: string, now = new Date()): string {
  return join(resolve(inputDirectory), "workplace", "miku-text-bundle", formatTimestamp(now));
}

export function chooseOutputDirectory(inputDirectory: string, explicitOutputDirectory?: string, now = new Date()): string {
  if (explicitOutputDirectory) {
    return resolve(explicitOutputDirectory);
  }

  const basePath = defaultOutputBase(inputDirectory, now);
  if (!statSync(basePath, { throwIfNoEntry: false })) {
    return basePath;
  }

  for (let suffix = 1; suffix < 10000; suffix += 1) {
    const candidate = `${basePath}-${suffix}`;
    if (!statSync(candidate, { throwIfNoEntry: false })) {
      return candidate;
    }
  }

  throw new Error(`Could not choose a unique output directory under ${dirname(basePath)}.`);
}

function isRootDotDirectory(relativePath: string): boolean {
  const firstSegment = toPosixPath(relativePath).split("/")[0] ?? "";
  return firstSegment.startsWith(".") && firstSegment.length > 1;
}

function relativeInputPath(inputPath: string, filePath: string): string {
  return toPosixPath(relative(inputPath, filePath));
}

function isDefaultSourceFile(filePath: string): boolean {
  return DEFAULT_SOURCE_EXTENSIONS.has(getExtension(filePath));
}

function isHardExcluded(relativePath: string, gitignorePatterns: string[]): boolean {
  return isRootDotDirectory(relativePath) || matchesGitignore(relativePath, gitignorePatterns);
}

function readRootGitignore(inputPath: string): string[] {
  const gitignorePath = join(inputPath, ".gitignore");
  if (!statSync(gitignorePath, { throwIfNoEntry: false })?.isFile()) {
    return [];
  }
  return parseGitignore(readFileSync(gitignorePath, "utf8"));
}

function listFilesRecursively(rootPath: string, startPath: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(startPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "ja"));

  for (const entry of entries) {
    const fullPath = join(startPath, entry.name);
    const relativePath = relativeInputPath(rootPath, fullPath);

    if (isRootDotDirectory(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(rootPath, fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function addRootFiles(candidates: Set<string>, inputPath: string): void {
  for (const rootFile of DEFAULT_ROOT_FILES) {
    const fullPath = join(inputPath, rootFile);
    if (statSync(fullPath, { throwIfNoEntry: false })?.isFile()) {
      candidates.add(fullPath);
    }
  }
}

function addDefaultSourceFiles(candidates: Set<string>, inputPath: string): void {
  for (const sourceDir of DEFAULT_SOURCE_DIRECTORIES) {
    const fullPath = join(inputPath, sourceDir);
    if (!statSync(fullPath, { throwIfNoEntry: false })?.isDirectory()) {
      continue;
    }

    for (const filePath of listFilesRecursively(inputPath, fullPath)) {
      if (isDefaultSourceFile(filePath)) {
        candidates.add(filePath);
      }
    }
  }
}

function addIncludedFiles(candidates: Set<string>, inputPath: string, includePatterns: string[]): void {
  if (includePatterns.length === 0) {
    return;
  }

  for (const filePath of listFilesRecursively(inputPath, inputPath)) {
    if (matchesAnyPattern(relativeInputPath(inputPath, filePath), includePatterns)) {
      candidates.add(filePath);
    }
  }
}

function shouldCollectCandidate(inputPath: string, filePath: string, options: CliOptions, gitignorePatterns: string[]): boolean {
  const relativePath = relativeInputPath(inputPath, filePath);
  return !isHardExcluded(relativePath, gitignorePatterns) && !matchesAnyPattern(relativePath, options.excludePatterns);
}

function discoverCandidateFiles(inputPath: string, options: CliOptions, gitignorePatterns: string[]): string[] {
  const candidates = new Set<string>();

  addRootFiles(candidates, inputPath);
  addDefaultSourceFiles(candidates, inputPath);
  addIncludedFiles(candidates, inputPath, options.includePatterns);

  return [...candidates]
    .filter((filePath) => shouldCollectCandidate(inputPath, filePath, options, gitignorePatterns))
    .sort((a, b) => relativeInputPath(inputPath, a).localeCompare(relativeInputPath(inputPath, b), "ja"));
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

function collectFiles(inputPath: string, options: CliOptions, gitignorePatterns: string[]): CollectedFilesResult {
  const files: CollectedFile[] = [];
  const skipped: SkippedFile[] = [];
  const maxInputFileBytes = options.maxInputFileBytes ?? DEFAULT_MAX_INPUT_FILE_BYTES;

  for (const filePath of discoverCandidateFiles(inputPath, options, gitignorePatterns)) {
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

  return { files, skipped };
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

function createBundlePart(partNumber: number, chunks: BundleChunk[], charCount: number): BundlePart {
  return {
    fileName: `text-bundle-${String(partNumber).padStart(3, "0")}.md`,
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

function buildParts(files: CollectedFile[], maxChars: number): BundlePartsResult {
  const { chunks, warnings } = buildChunks(files, maxChars);

  const parts: BundlePart[] = [];
  let currentChunks: BundleChunk[] = [];
  let currentChars = 0;

  const pushPart = (): void => {
    if (currentChunks.length === 0) {
      return;
    }
    parts.push(createBundlePart(parts.length + 1, currentChunks, currentChars));
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
  const { outputDirectory, inputDirectory, parts, collectedFiles, skippedFiles, markers, warnings } = params;
  const indexPath = join(outputDirectory, INDEX_FILE_NAME);
  const promptPath = join(outputDirectory, PROMPT_FILE_NAME);
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

  writeFileSync(promptPath, buildPromptMarkdown(parts.map((part) => part.fileName)), "utf8");

  return { indexPath, promptPath, partPaths };
}

function printVerboseSummary(files: CollectedFile[], skipped: SkippedFile[], parts: BundlePart[]): void {
  console.log(`collected=${files.length}`);
  console.log(`skipped=${skipped.length}`);
  console.log(`parts=${parts.length}`);
}

function printGeneratedPaths(indexPath: string, partPaths: string[], promptPath: string): void {
  console.log(`generated: ${indexPath}`);
  for (const partPath of partPaths) {
    console.log(`generated: ${partPath}`);
  }
  console.log(`generated: ${promptPath}`);
}

export function createTextBundle(options: CliOptions, now = new Date()): BundleResult {
  const inputPath = resolve(options.inputDirectory);
  const inputStat = statSync(inputPath, { throwIfNoEntry: false });

  if (!inputStat?.isDirectory()) {
    throw new Error(`Input directory does not exist: ${inputPath}`);
  }

  const outputDirectory = chooseOutputDirectory(inputPath, options.outputDirectory, now);
  mkdirSync(outputDirectory, { recursive: true });

  const gitignorePatterns = readRootGitignore(inputPath);
  const { files, skipped } = collectFiles(inputPath, options, gitignorePatterns);
  const markers = files.flatMap((file) => file.markers);
  const { parts, warnings } = buildParts(files, options.maxChars);

  const { indexPath, promptPath, partPaths } = writeBundleMarkdownFiles({
    outputDirectory,
    inputDirectory: inputPath,
    parts,
    collectedFiles: files,
    skippedFiles: skipped,
    markers,
    warnings,
  });

  if (options.verbose) {
    printVerboseSummary(files, skipped, parts);
  }

  printGeneratedPaths(indexPath, partPaths, promptPath);

  return {
    outputDirectory,
    indexPath,
    promptPath,
    partPaths,
    filesCollected: files.length,
    filesSkipped: skipped.length,
    partsGenerated: parts.length,
    warnings,
  };
}
