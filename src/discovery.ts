import { readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { DEFAULT_EXCLUDE_DIRECTORIES, DEFAULT_EXCLUDE_EXTENSIONS } from "./cli.js";
import { matchesGitignore } from "./match.js";
import { compareUtf16CodeUnits, toPosixPath } from "./path-utils.js";
import type { CliOptions, IgnoreStats } from "./types.js";

export type DiscoveryResult = {
  files: string[];
  ignored: IgnoreStats;
};

function relativeDiscoveryPath(inputPath: string, filePath: string): string {
  return toPosixPath(relative(inputPath, filePath));
}

function createIgnoreStats(): IgnoreStats {
  return {
    directories: 0,
    files: 0,
    byDirectory: 0,
    byExtension: 0,
    byGitignore: 0,
    byOutputDirectory: 0,
  };
}

function addIgnoredFiles(ignored: IgnoreStats, count: number, reason: keyof Pick<IgnoreStats, "byDirectory" | "byExtension" | "byGitignore" | "byOutputDirectory">): void {
  ignored.files += count;
  ignored[reason] += count;
}

function getEffectiveExcludeExtensions(options: CliOptions): Set<string> {
  return new Set((options.excludeExtensions ?? DEFAULT_EXCLUDE_EXTENSIONS).map((extension) => extension.toLowerCase()));
}

function getEffectiveExcludeDirectories(options: CliOptions): Set<string> {
  return new Set(options.excludeDirectories ?? DEFAULT_EXCLUDE_DIRECTORIES);
}

function isExcludedDirectory(relativePath: string, excludeDirectories: Set<string>): boolean {
  const normalizedPath = toPosixPath(relativePath).replace(/\/+$/, "");
  const segments = normalizedPath.split("/").filter((segment) => segment.length > 0);

  for (const excludedDirectory of excludeDirectories) {
    if (excludedDirectory.includes("/")) {
      if (normalizedPath === excludedDirectory || normalizedPath.startsWith(`${excludedDirectory}/`)) {
        return true;
      }
      continue;
    }

    if (segments.includes(excludedDirectory)) {
      return true;
    }
  }

  return false;
}

function hasExcludedExtension(filePath: string, excludeExtensions: Set<string>): boolean {
  const extension = extname(filePath).toLowerCase();
  return extension.length > 0 && excludeExtensions.has(extension);
}

function isOutputPathInsideInput(inputPath: string, outputPath: string): boolean {
  const outputRelativePath = relativeDiscoveryPath(inputPath, outputPath);
  return !outputRelativePath.startsWith("../") && outputRelativePath !== ".." && outputRelativePath !== "";
}

function isInsideOutputDirectory(inputPath: string, filePath: string, outputPath: string): boolean {
  if (!isOutputPathInsideInput(inputPath, outputPath)) {
    return false;
  }

  const outputRelativePath = relativeDiscoveryPath(inputPath, outputPath);
  const fileRelativePath = relativeDiscoveryPath(inputPath, filePath);
  return fileRelativePath === outputRelativePath || fileRelativePath.startsWith(`${outputRelativePath}/`);
}

function countDirectoryTree(startPath: string): { directories: number; files: number } {
  let directories = 1;
  let files = 0;

  for (const entry of readdirSync(startPath, { withFileTypes: true })) {
    const fullPath = join(startPath, entry.name);
    if (entry.isDirectory()) {
      const childCounts = countDirectoryTree(fullPath);
      directories += childCounts.directories;
      files += childCounts.files;
      continue;
    }

    if (entry.isFile()) {
      files += 1;
    }
  }

  return { directories, files };
}

function ignoreDirectory(fullPath: string, ignored: IgnoreStats, reason: "byDirectory" | "byOutputDirectory"): void {
  const counts = countDirectoryTree(fullPath);
  ignored.directories += counts.directories;
  addIgnoredFiles(ignored, counts.files, reason);
}

function listFilesRecursively(rootPath: string, startPath: string, outputPath: string, excludeDirectories: Set<string>, ignored: IgnoreStats): string[] {
  const files: string[] = [];
  const entries = readdirSync(startPath, { withFileTypes: true }).sort((a, b) => compareUtf16CodeUnits(a.name, b.name));

  for (const entry of entries) {
    const fullPath = join(startPath, entry.name);
    const relativePath = relativeDiscoveryPath(rootPath, fullPath);

    if (entry.isDirectory()) {
      if (isInsideOutputDirectory(rootPath, fullPath, outputPath)) {
        ignoreDirectory(fullPath, ignored, "byOutputDirectory");
        continue;
      }

      if (isExcludedDirectory(relativePath, excludeDirectories)) {
        ignoreDirectory(fullPath, ignored, "byDirectory");
        continue;
      }

      files.push(...listFilesRecursively(rootPath, fullPath, outputPath, excludeDirectories, ignored));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldCollectCandidate(inputPath: string, outputPath: string, filePath: string, gitignorePatterns: string[], excludeExtensions: Set<string>, ignored: IgnoreStats): boolean {
  const relativePath = relativeDiscoveryPath(inputPath, filePath);

  if (isInsideOutputDirectory(inputPath, filePath, outputPath)) {
    addIgnoredFiles(ignored, 1, "byOutputDirectory");
    return false;
  }

  if (hasExcludedExtension(filePath, excludeExtensions)) {
    addIgnoredFiles(ignored, 1, "byExtension");
    return false;
  }

  if (matchesGitignore(relativePath, gitignorePatterns)) {
    addIgnoredFiles(ignored, 1, "byGitignore");
    return false;
  }

  return true;
}

export function discoverCandidateFiles(inputPath: string, outputPath: string, options: CliOptions, gitignorePatterns: string[]): DiscoveryResult {
  const excludeExtensions = getEffectiveExcludeExtensions(options);
  const excludeDirectories = getEffectiveExcludeDirectories(options);
  const ignored = createIgnoreStats();
  const candidates = listFilesRecursively(inputPath, inputPath, outputPath, excludeDirectories, ignored);

  return {
    files: candidates
      .filter((filePath) => shouldCollectCandidate(inputPath, outputPath, filePath, gitignorePatterns, excludeExtensions, ignored))
      .sort((a, b) => compareUtf16CodeUnits(relativeDiscoveryPath(inputPath, a), relativeDiscoveryPath(inputPath, b))),
    ignored,
  };
}
