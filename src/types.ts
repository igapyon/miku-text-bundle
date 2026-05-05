export type CliOptions = {
  inputDirectory: string;
  outputDirectory?: string;
  maxChars: number;
  includePatterns: string[];
  excludePatterns: string[];
  verbose: boolean;
};

export type CollectedFile = {
  absolutePath: string;
  relativePath: string;
  extension: string;
  content: string;
  charCount: number;
  lineCount: number;
  markers: Marker[];
};

export type Marker = {
  relativePath: string;
  line: number;
  kind: "TODO" | "FIXME" | "XXX";
  text: string;
};

export type SkippedFile = {
  relativePath: string;
  reason: string;
};

export type BundleChunk = {
  relativePath: string;
  extension: string;
  content: string;
  originalCharCount: number;
  originalLineCount: number;
  chunkIndex: number;
  chunkCount: number;
  splitReason?: string;
};

export type BundlePart = {
  fileName: string;
  partNumber: number;
  chunks: BundleChunk[];
  charCount: number;
};

export type BundleResult = {
  outputDirectory: string;
  indexPath: string;
  promptPath: string;
  partPaths: string[];
  filesCollected: number;
  filesSkipped: number;
  partsGenerated: number;
  warnings: string[];
};
