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

function markerTable(markers: Marker[]): string {
  if (markers.length === 0) {
    return "- なし\n";
  }

  return [
    "| File | Line | Kind | Text |",
    "| --- | ---: | --- | --- |",
    ...markers.map((marker) => `| \`${marker.relativePath}\` | ${marker.line} | ${marker.kind} | ${escapeTable(marker.text)} |`),
    "",
  ].join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
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
    lines.push(`### ${chunk.relativePath}`);
    lines.push("");
    lines.push(`- Characters: ${chunk.content.length}`);
    lines.push(`- Source characters: ${chunk.originalCharCount}`);
    lines.push(`- Source lines: ${chunk.originalLineCount}`);

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
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
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
    "| Part | Chunks | Approx chars | Files |",
    "| --- | ---: | ---: | --- |",
    ...parts.map((part) => `| \`${part.fileName}\` | ${part.chunks.length} | ${part.charCount} | ${part.chunks.map((chunk) => `\`${chunk.relativePath}\``).join("<br>")} |`),
    "",
    "## Skipped Files",
    "",
    ...(skippedFiles.length === 0
      ? ["- なし", ""]
      : [
          "| File | Reason |",
          "| --- | --- |",
          ...skippedFiles.map((file) => `| \`${file.relativePath}\` | ${escapeTable(file.reason)} |`),
          "",
        ]),
    "## Warnings",
    "",
    ...(warnings.length === 0 ? ["- なし", ""] : warnings.map((warning) => `- ${warning}`).concat("")),
    "## Markers",
    "",
    markerTable(markers),
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
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
