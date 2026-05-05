import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { buildIndexMarkdown, buildPartMarkdown, buildPromptMarkdown } from "./markdown.js";
import { matchesAnyPattern, matchesGitignore, parseGitignore } from "./match.js";
import { getExtension, toPosixPath } from "./path-utils.js";
import type { BundleChunk, BundlePart, BundleResult, CliOptions, CollectedFile, Marker, SkippedFile } from "./types.js";

const DEFAULT_SOURCE_DIRECTORIES = ["src", "lib", "app", "test", "tests"];
const DEFAULT_SOURCE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "java", "cs"]);
const INDEX_FILE_NAME = "text-bundle-index.md";
const PROMPT_FILE_NAME = "text-bundle-prompt.md";

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
    const relativePath = toPosixPath(relative(rootPath, fullPath));

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

function discoverCandidateFiles(inputPath: string, options: CliOptions, gitignorePatterns: string[]): string[] {
  const candidates = new Set<string>();

  for (const rootFile of ["README.md", "TODO.md"]) {
    const fullPath = join(inputPath, rootFile);
    if (statSync(fullPath, { throwIfNoEntry: false })?.isFile()) {
      candidates.add(fullPath);
    }
  }

  for (const sourceDir of DEFAULT_SOURCE_DIRECTORIES) {
    const fullPath = join(inputPath, sourceDir);
    if (!statSync(fullPath, { throwIfNoEntry: false })?.isDirectory()) {
      continue;
    }

    for (const filePath of listFilesRecursively(inputPath, fullPath)) {
      if (DEFAULT_SOURCE_EXTENSIONS.has(getExtension(filePath))) {
        candidates.add(filePath);
      }
    }
  }

  if (options.includePatterns.length > 0) {
    for (const filePath of listFilesRecursively(inputPath, inputPath)) {
      const relativePath = toPosixPath(relative(inputPath, filePath));
      if (matchesAnyPattern(relativePath, options.includePatterns)) {
        candidates.add(filePath);
      }
    }
  }

  return [...candidates]
    .filter((filePath) => {
      const relativePath = toPosixPath(relative(inputPath, filePath));
      if (isRootDotDirectory(relativePath)) {
        return false;
      }
      if (matchesGitignore(relativePath, gitignorePatterns)) {
        return false;
      }
      if (matchesAnyPattern(relativePath, options.excludePatterns)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => toPosixPath(relative(inputPath, a)).localeCompare(toPosixPath(relative(inputPath, b)), "ja"));
}

function decodeUtf8(buffer: Buffer): string | undefined {
  if (buffer.includes(0)) {
    return undefined;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

function extractMarkers(relativePath: string, content: string): Marker[] {
  return content.split(/\r?\n/).flatMap((lineText, index) => {
    const match = lineText.match(/\b(TODO|FIXME|XXX)\b(.*)/);
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

function collectFiles(inputPath: string, options: CliOptions, gitignorePatterns: string[]): { files: CollectedFile[]; skipped: SkippedFile[] } {
  const files: CollectedFile[] = [];
  const skipped: SkippedFile[] = [];

  for (const filePath of discoverCandidateFiles(inputPath, options, gitignorePatterns)) {
    const relativePath = toPosixPath(relative(inputPath, filePath));
    const buffer = readFileSync(filePath);
    const content = decodeUtf8(buffer);

    if (content === undefined) {
      skipped.push({ relativePath, reason: "UTF-8 として読めない、またはバイナリと判定したためスキップしました。" });
      continue;
    }

    files.push({
      absolutePath: filePath,
      relativePath,
      extension: getExtension(filePath),
      content,
      charCount: content.length,
      lineCount: content.length === 0 ? 0 : content.split(/\r?\n/).length,
      markers: extractMarkers(relativePath, content),
    });
  }

  return { files, skipped };
}

function splitOversizedFile(file: CollectedFile, maxChars: number): BundleChunk[] {
  if (file.content.length <= maxChars) {
    return [{
      relativePath: file.relativePath,
      extension: file.extension,
      content: file.content,
      originalCharCount: file.charCount,
      originalLineCount: file.lineCount,
      chunkIndex: 1,
      chunkCount: 1,
    }];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of file.content.split(/(?<=\n)/)) {
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

  const chunkCount = chunks.length;
  return chunks.map((content, index) => ({
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

function buildParts(files: CollectedFile[], maxChars: number): { parts: BundlePart[]; warnings: string[] } {
  const warnings: string[] = [];
  const chunks = files.flatMap((file) => {
    const fileChunks = splitOversizedFile(file, maxChars);
    if (fileChunks.length > 1) {
      warnings.push(`\`${file.relativePath}\` は --max-chars を超えたため ${fileChunks.length} 個に分割しました。`);
    }
    return fileChunks;
  });

  const parts: BundlePart[] = [];
  let currentChunks: BundleChunk[] = [];
  let currentChars = 0;

  const pushPart = (): void => {
    if (currentChunks.length === 0) {
      return;
    }
    const partNumber = parts.length + 1;
    parts.push({
      fileName: `text-bundle-${String(partNumber).padStart(3, "0")}.md`,
      partNumber,
      chunks: currentChunks,
      charCount: currentChars,
    });
    currentChunks = [];
    currentChars = 0;
  };

  for (const chunk of chunks) {
    if (currentChunks.length > 0 && currentChars + chunk.content.length > maxChars) {
      pushPart();
    }
    currentChunks.push(chunk);
    currentChars += chunk.content.length;
  }

  pushPart();
  return { parts, warnings };
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

  const indexPath = join(outputDirectory, INDEX_FILE_NAME);
  const promptPath = join(outputDirectory, PROMPT_FILE_NAME);
  const partPaths = parts.map((part) => join(outputDirectory, part.fileName));

  for (const part of parts) {
    writeFileSync(join(outputDirectory, part.fileName), buildPartMarkdown(part), "utf8");
  }

  writeFileSync(indexPath, buildIndexMarkdown({
    inputDirectory: inputPath,
    outputDirectory,
    parts,
    collectedFiles: files,
    skippedFiles: skipped,
    markers,
    warnings,
  }), "utf8");

  writeFileSync(promptPath, buildPromptMarkdown(parts.map((part) => part.fileName)), "utf8");

  if (options.verbose) {
    console.log(`collected=${files.length}`);
    console.log(`skipped=${skipped.length}`);
    console.log(`parts=${parts.length}`);
  }

  console.log(`generated: ${indexPath}`);
  for (const partPath of partPaths) {
    console.log(`generated: ${partPath}`);
  }
  console.log(`generated: ${promptPath}`);

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
