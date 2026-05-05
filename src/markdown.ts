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
  const matches = content.match(/`{3,}/g) ?? [];
  const longest = matches.reduce((max, item) => Math.max(max, item.length), 2);
  return "`".repeat(longest + 1);
}

function languageFor(extension: string): string {
  return EXTENSION_LANGUAGES[extension] ?? "";
}

function markdown(lines: string[]): string {
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
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
    return ["- なし", ""];
  }

  return warnings.map((warning) => `- ${warning}`).concat("");
}

function markerTable(markers: Marker[]): string {
  if (markers.length === 0) {
    return "- なし\n";
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
    lines.push(`このファイルはサイズ上限を超えたため、やむを得ず分割しました。元ファイル: \`${chunk.relativePath}\`。分割: ${chunk.chunkIndex} / ${chunk.chunkCount}。`);
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
    return ["- なし", ""];
  }

  return table(
    ["File", "Reason"],
    ["---", "---"],
    skippedFiles.map((file) => [code(file.relativePath), escapeTable(file.reason)]),
  );
}

export function buildPartMarkdown(part: BundlePart): string {
  const lines = [
    `# Text Bundle Part ${String(part.partNumber).padStart(3, "0")}`,
    "",
    `- Part file: \`${part.fileName}\``,
    `- Files/chunks: ${part.chunks.length}`,
    `- Approx chars: ${part.charCount}`,
    "",
  ];

  for (const chunk of part.chunks) {
    lines.push(...buildChunkMarkdown(chunk));
  }

  return markdown(lines);
}

export function buildIndexMarkdown(params: {
  inputDirectory: string;
  outputDirectory: string;
  parts: BundlePart[];
  collectedFiles: CollectedFile[];
  skippedFiles: SkippedFile[];
  markers: Marker[];
  warnings: string[];
}): string {
  const { inputDirectory, outputDirectory, parts, collectedFiles, skippedFiles, markers, warnings } = params;
  const lines = [
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

  return markdown(lines);
}

export function buildPromptMarkdown(partFileNames: string[]): string {
  const lines = [
    "# Text Bundle Prompt",
    "",
    "これから Markdown バンドルを複数のメッセージに分けて順番に送ります。",
    "",
    "各メッセージを受け取ったら、内容の分析や要約はまだ行わず、`受領しました` とだけ返してください。",
    "",
    "`END_OF_TEXT_BUNDLE` という完了合図を受け取るまで、最終回答を開始しないでください。",
    "",
    "## 読み込み順",
    "",
    "1. `text-bundle-000-index.md`",
    ...partFileNames.map((fileName, index) => `${index + 2}. \`${fileName}\``),
    `${partFileNames.length + 2}. \`END_OF_TEXT_BUNDLE\``,
    "",
    "## 回答ファイル",
    "",
    "`END_OF_TEXT_BUNDLE` の後に作成する回答は `text-bundle-response.md` として保存する想定です。",
    "",
    "## 出力形式",
    "",
    "markdown テキスト形式で出力してください。",
    "",
    "○最終的な回答は Markdown テキスト形式で出力し、さらに ~~~~ で囲まれた一塊として出力してください。markdown 内に backtick による code fence が含まれる場合があるため、外側の囲みは tilde を使ってください。",
    "",
  ];

  return lines.join("\n");
}
