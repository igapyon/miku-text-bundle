export type SupportedEncoding = "utf-8" | "shift_jis";
export type BundleMode = "handoff" | "knowledge-source";

export type EncodingOptions = {
  default: SupportedEncoding;
  extensions: Record<string, SupportedEncoding>;
};

export type CliOptions = {
  inputDirectory: string;
  outputDirectory: string;
  filenamePrefix?: string;
  mode?: BundleMode;
  maxChars: number;
  maxInputFileBytes?: number;
  encoding?: EncodingOptions;
  excludeExtensions?: string[];
  excludeDirectories?: string[];
  verbose: boolean;
  dryRun?: boolean;
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

export type IgnoreStats = {
  directories: number;
  files: number;
  byDirectory: number;
  byExtension: number;
  byGitignore: number;
  byOutputDirectory: number;
};

export type BundleChunk = {
  relativePath: string;
  extension: string;
  content: string;
  originalCharCount: number;
  originalLineCount: number;
  chunkIndex: number;
  chunkCount: number;
  sourceStartLine?: number;
  sourceEndLine?: number;
  sourceStartChar?: number;
  sourceEndChar?: number;
  splitReason?: string;
};

export type BundlePart = {
  fileName: string;
  partNumber: number;
  chunks: BundleChunk[];
  charCount: number;
};

export type BundleResult = {
  mode: BundleMode;
  outputDirectory: string;
  indexPath: string;
  promptPath: string;
  partPaths: string[];
  knowledgeSourcePaths: string[];
  managementIndexPath?: string;
  filesCollected: number;
  filesSkipped: number;
  directoriesIgnored: number;
  filesIgnored: number;
  ignoredByDirectory: number;
  ignoredByExtension: number;
  ignoredByGitignore: number;
  ignoredByOutputDirectory: number;
  partsGenerated: number;
  warnings: string[];
  dryRun: boolean;
};
