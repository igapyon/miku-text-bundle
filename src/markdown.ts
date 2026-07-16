import type { BundlePart, CollectedFile, Marker, SkippedFile } from "./types.js";

const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  cjs: "js",
  java: "java",
  cs: "csharp",
  md: "md",
  json: "json",
};

function fenceFor(content: string): string {
  const matches = content.match(/~{3,}/g) ?? [];
  const longest = matches.reduce((max, item) => Math.max(max, item.length), 2);
  return "~".repeat(longest + 1);
}

function languageFor(extension: string): string {
  return EXTENSION_LANGUAGES[extension] ?? "";
}

function markdown(lines: string[]): string {
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

type TextBundleMetadata = {
  toolName?: string;
  toolVersion?: string;
};

function frontMatter(role: string, metadata: TextBundleMetadata = {}, extra: string[] = []): string[] {
  return [
    "---",
    `tool: ${metadata.toolName ?? "miku-text-bundle"}`,
    `version: ${metadata.toolVersion ?? "unknown"}`,
    `role: ${role}`,
    ...extra,
    "---",
    "",
  ];
}

function table(headers: string[], alignments: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${alignments.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
  ];
}

function code(value: string): string {
  return `\`${value}\``;
}

function warningList(warnings: string[]): string[] {
  if (warnings.length === 0) {
    return ["- None", ""];
  }

  return warnings.map((warning) => `- ${warning}`).concat("");
}

function markerTable(markers: Marker[]): string {
  if (markers.length === 0) {
    return "- None\n";
  }

  return table(
    ["File", "Line", "Kind", "Text"],
    ["---", "---:", "---", "---"],
    markers.map((marker) => [code(marker.relativePath), String(marker.line), marker.kind, escapeTable(marker.text)]),
  ).join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function buildChunkMarkdown(chunk: BundlePart["chunks"][number]): string[] {
  const lines = [
    `### ${chunk.relativePath}`,
    "",
    `- Characters: ${chunk.content.length}`,
    `- Source characters: ${chunk.originalCharCount}`,
    `- Source lines: ${chunk.originalLineCount}`,
  ];

  if (chunk.splitReason) {
    lines.push(`- Warning: ${chunk.splitReason}`);
    lines.push(`- Split: ${chunk.chunkIndex} / ${chunk.chunkCount}`);
  }

  lines.push("");

  if (chunk.splitReason) {
    lines.push(`This file exceeded the size limit and was split. Source file: \`${chunk.relativePath}\`. Split: ${chunk.chunkIndex} / ${chunk.chunkCount}.`);
    lines.push("");
  }

  const fence = fenceFor(chunk.content);
  const language = languageFor(chunk.extension);
  lines.push(`${fence}${language}`);
  lines.push(chunk.content);
  lines.push(fence);
  lines.push("");
  return lines;
}

function partsTable(parts: BundlePart[]): string[] {
  return table(
    ["Part", "Chunks", "Approx chars", "Files"],
    ["---", "---:", "---:", "---"],
    parts.map((part) => [
      code(part.fileName),
      String(part.chunks.length),
      String(part.charCount),
      part.chunks.map((chunk) => code(chunk.relativePath)).join("<br>"),
    ]),
  );
}

function skippedFilesTable(skippedFiles: SkippedFile[]): string[] {
  if (skippedFiles.length === 0) {
    return ["- None", ""];
  }

  return table(
    ["File", "Reason"],
    ["---", "---"],
    skippedFiles.map((file) => [code(file.relativePath), escapeTable(file.reason)]),
  );
}

function agentSkillPaths(collectedFiles: CollectedFile[]): string[] {
  return collectedFiles
    .map((file) => file.relativePath)
    .filter((relativePath) => relativePath === "SKILL.md" || /^skills\/[^/]+\/SKILL\.md$/.test(relativePath));
}

function agentSkillHandoffSection(skillPaths: string[], terminalFileName = "the final part file"): string[] {
  if (skillPaths.length === 0) {
    return [];
  }

  return [
    "## Agent Skill Handoff",
    "",
    "This Text Bundle includes Agent Skill definitions.",
    "",
    "Read the following `SKILL.md` files as the primary Agent Skill instructions and keep them available for reference in this conversation.",
    "",
    ...skillPaths.map((skillPath) => `- ${code(skillPath)}`),
    "",
    `After receiving ${code(terminalFileName)}, the Text Bundle loading is complete. If the user asks to use this Agent Skill or the target product, prioritize the relevant \`SKILL.md\` activation rules, operating rules, workflow, and references, and work from the related files in this bundle.`,
    "",
    "If higher-priority system, developer, or user instructions apply, follow those instructions first.",
    "",
  ];
}

type IndexMarkdownParams = {
  inputDirectory: string;
  outputDirectory: string;
  parts: BundlePart[];
  collectedFiles: CollectedFile[];
  skippedFiles: SkippedFile[];
  markers: Marker[];
  warnings: string[];
  toolName?: string;
  toolVersion?: string;
  terminalFileName?: string;
};

type PromptMarkdownParams = {
  promptFileName: string;
  partFileNames: string[];
  indexFileName: string;
  toolName?: string;
  toolVersion?: string;
};

type PartMarkdownOptions = {
  prompt?: PromptMarkdownParams;
  index?: IndexMarkdownParams;
  acknowledgeOnly?: boolean;
};

export function buildPartMarkdown(part: BundlePart, metadata: TextBundleMetadata = {}, options: PartMarkdownOptions = {}): string {
  const extraFrontMatter = [`part: ${part.partNumber}`];
  if (options.prompt) {
    extraFrontMatter.push("prompt: true");
  }
  if (options.index) {
    extraFrontMatter.push("terminal: true");
  }

  const lines = [
    ...frontMatter("part", metadata, extraFrontMatter),
    ...(options.prompt ? buildPromptMarkdownLines(options.prompt, false) : []),
    `# Text Bundle Part ${String(part.partNumber).padStart(3, "0")}`,
    "",
    `- Part file: \`${part.fileName}\``,
    `- Files/chunks: ${part.chunks.length}`,
    `- Approx chars: ${part.charCount}`,
    "",
  ];

  for (const [index, chunk] of part.chunks.entries()) {
    if (index > 0) {
      lines.push("---");
      lines.push("");
    }
    lines.push(...buildChunkMarkdown(chunk));
  }

  if (options.index) {
    lines.push(...buildIndexMarkdownLines(options.index, false));
  }

  if (options.acknowledgeOnly) {
    lines.push(...buildAcknowledgementFooterLines());
  }

  return markdown(lines);
}

function buildAcknowledgementFooterLines(): string[] {
  return [
    "## Acknowledgement",
    "",
    "After reading this Part, do not analyze or summarize the content yet. Reply only with `OK`.",
    "",
  ];
}

function buildIndexMarkdownLines(params: IndexMarkdownParams, includeFrontMatter: boolean): string[] {
  const { inputDirectory, outputDirectory, parts, collectedFiles, skippedFiles, markers, warnings, toolName, toolVersion } = params;
  const terminalFileName = params.terminalFileName ?? "the final part file";
  const skillPaths = agentSkillPaths(collectedFiles);
  return [
    ...(includeFrontMatter ? frontMatter("index", { toolName, toolVersion }, ["terminal: true"]) : []),
    "# Text Bundle Index",
    "",
    "## Summary",
    "",
    `- Input directory: \`${inputDirectory}\``,
    `- Output directory: \`${outputDirectory}\``,
    `- Collected files: ${collectedFiles.length}`,
    `- Skipped files: ${skippedFiles.length}`,
    `- Parts: ${parts.length}`,
    "",
    ...agentSkillHandoffSection(skillPaths, terminalFileName),
    "## Parts",
    "",
    ...partsTable(parts),
    "## Skipped Files",
    "",
    ...skippedFilesTable(skippedFiles),
    "## Warnings",
    "",
    ...warningList(warnings),
    "## Markers",
    "",
    markerTable(markers),
  ];
}

export function buildIndexMarkdown(params: IndexMarkdownParams): string {
  return markdown(buildIndexMarkdownLines(params, true));
}

function normalizePromptMarkdownParams(params: string[] | PromptMarkdownParams): PromptMarkdownParams {
  if (Array.isArray(params)) {
    return {
      promptFileName: params[0] ?? "text-bundle-001.md",
      partFileNames: params,
      indexFileName: params.at(-1) ?? params[0] ?? "text-bundle-001.md",
    };
  }
  return params;
}

function buildPromptMarkdownLines(params: PromptMarkdownParams, includeFrontMatter: boolean): string[] {
  const { promptFileName, partFileNames, indexFileName, toolName, toolVersion } = normalizePromptMarkdownParams(params);
  const readingOrderFileNames = [
    ...(partFileNames[0] === promptFileName ? [] : [promptFileName]),
    ...partFileNames,
    ...(partFileNames.at(-1) === indexFileName ? [] : [indexFileName]),
  ];
  return [
    ...(includeFrontMatter ? frontMatter("prompt", { toolName, toolVersion }) : []),
    "# Text Bundle Prompt",
    "",
    "This is the reading instruction for a Text Bundle that packages a set of files for handoff to generative AI or similar tools.",
    "",
    "The Markdown bundle will be sent in multiple messages in the order listed below.",
    "",
    "After each non-terminal Part, do not analyze or summarize the content yet. Reply only with `OK`.",
    "",
    `Do not start the final response until you receive \`${indexFileName}\`.`,
    "",
    "## Reading Order",
    "",
    ...readingOrderFileNames.map((fileName, index) => `${index + 1}. \`${fileName}\``),
    "",
    "## Response File",
    "",
    `If you save the final response after \`${indexFileName}\`, \`text-bundle-response.md\` is the recommended filename.`,
    "",
    "## Output Format",
    "",
    "Output the final response as Markdown text.",
    "",
    "Wrap the entire final Markdown response in a single outer fence using `~~~~`. Use tildes for the outer fence because the Markdown response may contain backtick code fences.",
    "",
  ];
}

export function buildPromptMarkdown(params: string[] | PromptMarkdownParams): string {
  return buildPromptMarkdownLines(normalizePromptMarkdownParams(params), true).join("\n");
}

export function buildKnowledgeSourceMarkdown(part: BundlePart): string {
  const lines = [`# Knowledge Source ${String(part.partNumber).padStart(3, "0")}`, ""];

  for (const [index, chunk] of part.chunks.entries()) {
    if (index > 0) {
      lines.push("---", "");
    }
    lines.push(`## Source: ${chunk.relativePath}`, "", `- Source path: ${code(chunk.relativePath)}`);
    if (chunk.chunkCount > 1) {
      lines.push(`- Source chunk: ${chunk.chunkIndex} / ${chunk.chunkCount}`);
      lines.push(`- Source lines: ${chunk.sourceStartLine ?? 0}-${chunk.sourceEndLine ?? 0}`);
    }
    lines.push("");

    if (chunk.extension === "md") {
      lines.push(chunk.content, "");
    } else {
      const fence = fenceFor(chunk.content);
      lines.push(`${fence}${languageFor(chunk.extension)}`, chunk.content, fence, "");
    }
  }

  return `${lines.join("\n")}\n`;
}

export type KnowledgeIndexParams = {
  managementIndexFileName: string;
  configuration: Array<[string, string]>;
  parts: BundlePart[];
  collectedFiles: CollectedFile[];
  skippedFiles: SkippedFile[];
  markers: Marker[];
  warnings: string[];
  staleOutputCandidates: string[];
};

export function buildKnowledgeIndexMarkdown(params: KnowledgeIndexParams): string {
  const generatedRows = [
    ...params.parts.map((part) => [code(part.fileName), "knowledge-source", String(part.chunks.length), String(part.charCount)]),
    [code(params.managementIndexFileName), "management-index", "-", "-"],
  ];
  const mappingRows = params.parts.flatMap((part) => part.chunks.map((chunk) => [
    code(chunk.relativePath),
    code(part.fileName),
    `${chunk.chunkIndex} / ${chunk.chunkCount}`,
    `${chunk.sourceStartLine ?? 0}-${chunk.sourceEndLine ?? 0}`,
    `${chunk.sourceStartChar ?? 0}-${chunk.sourceEndChar ?? chunk.content.length}`,
    String(chunk.originalCharCount),
    String(chunk.content.length),
  ]));
  const staleLines = params.staleOutputCandidates.length === 0
    ? ["- None", ""]
    : params.staleOutputCandidates.map((path) => `- ${code(path)}`).concat("");

  return markdown([
    "# Knowledge Bundle Index", "",
    "## Configuration", "",
    ...table(["Option", "Effective value"], ["---", "---"], params.configuration.map(([key, value]) => [code(key), escapeTable(value)])),
    "## Summary", "",
    `- Collected files: ${params.collectedFiles.length}`,
    `- Skipped files: ${params.skippedFiles.length}`,
    `- Knowledge files: ${params.parts.length}`, "",
    "## Generated Files", "",
    ...table(["File", "Role", "Chunks", "Approx chars"], ["---", "---", "---:", "---:"], generatedRows),
    "## Source Mapping", "",
    ...table(
      ["Source", "Generated file", "Chunk", "Source lines", "UTF-16 chars", "Source chars", "Chunk chars"],
      ["---", "---", "---:", "---:", "---:", "---:", "---:"],
      mappingRows,
    ),
    "## Skipped Files", "", ...skippedFilesTable(params.skippedFiles),
    "## Warnings", "", ...warningList(params.warnings),
    "## Markers", "", markerTable(params.markers),
    "## Stale Output Candidates", "", ...staleLines,
  ]);
}
