import { describe, expect, it } from "vitest";

import { buildIndexMarkdown, buildPartMarkdown, buildPromptMarkdown } from "../src/main.js";
import type { BundlePart, CollectedFile, Marker, SkippedFile } from "../src/main.js";

describe("Markdown golden outputs", () => {
  const part: BundlePart = {
    fileName: "text-bundle-001.md",
    partNumber: 1,
    charCount: 17,
    chunks: [{
      relativePath: "src/main.ts",
      extension: "ts",
      content: "const value = 1;\n",
      originalCharCount: 17,
      originalLineCount: 2,
      chunkIndex: 1,
      chunkCount: 1,
    }],
  };

  const collectedFiles: CollectedFile[] = [{
    absolutePath: "/repo/src/main.ts",
    relativePath: "src/main.ts",
    extension: "ts",
    content: "const value = 1;\n",
    charCount: 17,
    lineCount: 2,
    markers: [],
  }];

  const skippedFiles: SkippedFile[] = [{
    relativePath: "docs/huge.md",
    reason: "ファイルサイズが 100 bytes の上限を超えたためスキップしました。",
  }];

  const markers: Marker[] = [{
    relativePath: "TODO.md",
    line: 3,
    kind: "TODO",
    text: "- TODO check | escape",
  }];

  const indexParams = {
    inputDirectory: "/repo",
    outputDirectory: "/repo/workplace/miku-text-bundle/202605051200",
    parts: [part],
    collectedFiles,
    skippedFiles,
    markers,
    warnings: ["`src/large.ts` は --max-chars を超えたため 2 個に分割しました。"],
  };

  const promptPartFileNames = ["text-bundle-001.md", "text-bundle-002.md"];

  it("builds stable part Markdown", () => {
    expect(buildPartMarkdown(part)).toBe(`# Text Bundle Part 001

- Part file: \`text-bundle-001.md\`
- Files/chunks: 1
- Approx chars: 17

### src/main.ts

- Characters: 17
- Source characters: 17
- Source lines: 2

\`\`\`ts
const value = 1;

\`\`\`

`);
  });

  it("builds stable index Markdown", () => {
    expect(buildIndexMarkdown(indexParams)).toBe(`# Text Bundle Index

## Summary

- Input directory: \`/repo\`
- Output directory: \`/repo/workplace/miku-text-bundle/202605051200\`
- Collected files: 1
- Skipped files: 1
- Parts: 1

## Parts

| Part | Chunks | Approx chars | Files |
| --- | ---: | ---: | --- |
| \`text-bundle-001.md\` | 1 | 17 | \`src/main.ts\` |

## Skipped Files

| File | Reason |
| --- | --- |
| \`docs/huge.md\` | ファイルサイズが 100 bytes の上限を超えたためスキップしました。 |

## Warnings

- \`src/large.ts\` は --max-chars を超えたため 2 個に分割しました。

## Markers

| File | Line | Kind | Text |
| --- | ---: | --- | --- |
| \`TODO.md\` | 3 | TODO | - TODO check \\| escape |

`);
  });

  it("builds stable prompt Markdown", () => {
    expect(buildPromptMarkdown(promptPartFileNames)).toBe(`# Text Bundle Prompt

これから Markdown バンドルを複数のメッセージに分けて順番に送ります。

各メッセージを受け取ったら、内容の分析や要約はまだ行わず、\`受領しました\` とだけ返してください。

\`text-bundle-999-index.md\` を受け取るまで、最終回答を開始しないでください。

## 読み込み順

1. \`text-bundle-000-prompt.md\`
2. \`text-bundle-001.md\`
3. \`text-bundle-002.md\`
4. \`text-bundle-999-index.md\`

## 回答ファイル

\`text-bundle-999-index.md\` の後に作成する回答は \`text-bundle-response.md\` として保存する想定です。

## 出力形式

markdown テキスト形式で出力してください。

○最終的な回答は Markdown テキスト形式で出力し、さらに ~~~~ で囲まれた一塊として出力してください。markdown 内に backtick による code fence が含まれる場合があるため、外側の囲みは tilde を使ってください。
`);
  });
});
