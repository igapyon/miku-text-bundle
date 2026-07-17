import type { BundlePart, CollectedFile, Marker, SkippedFile } from "./types.js";

type LanguageDetails = {
  displayName: string;
  fenceLanguage: string;
  blockLabel: "Source code block" | "Source text block" | "Source content block";
};

function sourceCode(displayName: string, fenceLanguage: string): LanguageDetails {
  return { displayName, fenceLanguage, blockLabel: "Source code block" };
}

function sourceText(displayName: string, fenceLanguage: string): LanguageDetails {
  return { displayName, fenceLanguage, blockLabel: "Source text block" };
}

const EXTENSION_LANGUAGES: Record<string, LanguageDetails> = {
  ts: sourceCode("TypeScript", "ts"),
  mts: sourceCode("TypeScript", "ts"),
  cts: sourceCode("TypeScript", "ts"),
  tsx: sourceCode("TypeScript TSX", "tsx"),
  js: sourceCode("JavaScript", "js"),
  jsx: sourceCode("JavaScript JSX", "jsx"),
  mjs: sourceCode("JavaScript", "js"),
  cjs: sourceCode("JavaScript", "js"),
  java: sourceCode("Java", "java"),
  cs: sourceCode("C#", "csharp"),
  py: sourceCode("Python", "python"),
  pyw: sourceCode("Python", "python"),
  go: sourceCode("Go", "go"),
  rs: sourceCode("Rust", "rust"),
  c: sourceCode("C", "c"),
  h: sourceCode("C header", "c"),
  cc: sourceCode("C++", "cpp"),
  cpp: sourceCode("C++", "cpp"),
  cxx: sourceCode("C++", "cpp"),
  hh: sourceCode("C++ header", "cpp"),
  hpp: sourceCode("C++ header", "cpp"),
  hxx: sourceCode("C++ header", "cpp"),
  swift: sourceCode("Swift", "swift"),
  kt: sourceCode("Kotlin", "kotlin"),
  kts: sourceCode("Kotlin Script", "kotlin"),
  scala: sourceCode("Scala", "scala"),
  rb: sourceCode("Ruby", "ruby"),
  php: sourceCode("PHP", "php"),
  sh: sourceCode("Shell", "bash"),
  bash: sourceCode("Bash", "bash"),
  zsh: sourceCode("Z shell", "zsh"),
  fish: sourceCode("fish shell", "fish"),
  ps1: sourceCode("PowerShell", "powershell"),
  sql: sourceCode("SQL", "sql"),
  html: sourceCode("HTML", "html"),
  htm: sourceCode("HTML", "html"),
  css: sourceCode("CSS", "css"),
  scss: sourceCode("SCSS", "scss"),
  sass: sourceCode("Sass", "sass"),
  less: sourceCode("Less", "less"),
  vue: sourceCode("Vue", "vue"),
  svelte: sourceCode("Svelte", "svelte"),
  groovy: sourceCode("Groovy", "groovy"),
  gradle: sourceCode("Gradle", "groovy"),
  md: sourceText("Markdown", "md"),
  markdown: sourceText("Markdown", "md"),
  txt: sourceText("Plain text", "text"),
  rst: sourceText("reStructuredText", "rst"),
  adoc: sourceText("AsciiDoc", "asciidoc"),
  json: sourceCode("JSON", "json"),
  jsonl: sourceCode("JSON Lines", "json"),
  yaml: sourceText("YAML", "yaml"),
  yml: sourceText("YAML", "yaml"),
  xml: sourceText("XML", "xml"),
  toml: sourceText("TOML", "toml"),
  ini: sourceText("INI", "ini"),
  cfg: sourceText("Configuration", "ini"),
  conf: sourceText("Configuration", "text"),
  properties: sourceText("Java properties", "properties"),
  csv: sourceText("CSV", "csv"),
  tsv: sourceText("TSV", "tsv"),
};

const FILE_NAME_LANGUAGES: Record<string, LanguageDetails> = {
  dockerfile: sourceCode("Dockerfile", "dockerfile"),
  containerfile: sourceCode("Containerfile", "dockerfile"),
  makefile: sourceCode("Makefile", "makefile"),
  gnumakefile: sourceCode("GNU Makefile", "makefile"),
  gradlew: sourceCode("Shell", "bash"),
  ".gitignore": sourceText("Git ignore rules", "gitignore"),
  ".gitattributes": sourceText("Git attributes", "gitattributes"),
  ".editorconfig": sourceText("EditorConfig", "editorconfig"),
  ".npmrc": sourceText("npm configuration", "ini"),
};

const UNKNOWN_LANGUAGE: LanguageDetails = {
  displayName: "Unknown",
  fenceLanguage: "",
  blockLabel: "Source content block",
};

function fenceFor(content: string): string {
  const matches = content.match(/~{3,}/g) ?? [];
  const longest = matches.reduce((max, item) => Math.max(max, item.length), 2);
  return "~".repeat(longest + 1);
}

function languageFor(extension: string, relativePath: string): LanguageDetails {
  const fileName = relativePath.split("/").at(-1)?.toLowerCase() ?? "";
  return EXTENSION_LANGUAGES[extension] ?? FILE_NAME_LANGUAGES[fileName] ?? UNKNOWN_LANGUAGE;
}

function markdown(lines: string[]): string {
  const compactedLines = lines.filter((line, index) => line !== "" || lines[index - 1] !== "");
  return `${compactedLines.join("\n")}\n`;
}

function displayPath(relativePath: string): string {
  return relativePath.replace(/\\/g, "\\\\").replace(/[\u0000-\u001f\u007f]/g, (character) => {
    if (character === "\n") {
      return "\\n";
    }
    if (character === "\r") {
      return "\\r";
    }
    if (character === "\t") {
      return "\\t";
    }
    return `\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`;
  });
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
  const displayed = displayPath(value).replace(/\|/g, "\\|");
  const matches = displayed.match(/`+/g) ?? [];
  const longest = matches.reduce((max, item) => Math.max(max, item.length), 0);
  const delimiter = "`".repeat(longest + 1);
  return `${delimiter}${displayed}${delimiter}`;
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

function buildFileBlockMarkdown(chunk: BundlePart["chunks"][number]): string[] {
  const path = displayPath(chunk.relativePath);
  const lines = [
    `### FILE: ${path}`,
    "",
    `--- BEGIN FILE: ${path} ---`,
    "",
  ];
  if (chunk.chunkCount > 1) {
    lines.push(`Chunk: ${chunk.chunkIndex} / ${chunk.chunkCount}`);
    lines.push(`Source lines: ${chunk.sourceStartLine ?? 0}-${chunk.sourceEndLine ?? 0}`);
    lines.push("");
  }

  const language = languageFor(chunk.extension, chunk.relativePath);
  const fence = fenceFor(chunk.content);
  const fencedContent = `${fence}${language.fenceLanguage}\n${chunk.content}${chunk.content.endsWith("\n") ? "" : "\n"}${fence}`;
  lines.push(language.blockLabel);
  lines.push(`Language: ${language.displayName}`);
  lines.push("");
  lines.push(fencedContent);
  lines.push("");
  lines.push(`--- END FILE: ${path} ---`);
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

  for (const chunk of part.chunks) {
    lines.push(...buildFileBlockMarkdown(chunk));
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

  for (const chunk of part.chunks) {
    lines.push(...buildFileBlockMarkdown(chunk));
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
