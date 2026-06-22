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
    reason: "File size exceeds the 100 byte limit.",
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
    warnings: ["`src/large.ts` exceeded --max-chars and was split into 2 chunks."],
  };

  const promptPartFileNames = ["text-bundle-001.md", "text-bundle-002.md"];

  it("builds stable part Markdown", () => {
    expect(buildPartMarkdown(part, {
      toolName: "miku-text-bundle",
      toolVersion: "1.1.0",
    })).toBe(`---
tool: miku-text-bundle
version: 1.1.0
role: part
part: 1
---

# Text Bundle Part 001

- Part file: \`text-bundle-001.md\`
- Files/chunks: 1
- Approx chars: 17

### src/main.ts

- Characters: 17
- Source characters: 17
- Source lines: 2

~~~ts
const value = 1;

~~~

`);
  });

  it("uses longer tilde fences when content contains tilde fences", () => {
    expect(buildPartMarkdown({
      ...part,
      chunks: [{
        ...part.chunks[0]!,
        content: "~~~md\ninside\n~~~\n",
      }],
    })).toContain("~~~~ts\n~~~md\ninside\n~~~\n\n~~~~");
  });

  it("separates later file chunks with a horizontal rule", () => {
    expect(buildPartMarkdown({
      ...part,
      charCount: 32,
      chunks: [
        part.chunks[0]!,
        {
          relativePath: "docs/guide/setup.md",
          extension: "md",
          content: "# Setup\n",
          originalCharCount: 8,
          originalLineCount: 2,
          chunkIndex: 1,
          chunkCount: 1,
        },
      ],
    })).toContain("~~~\n\n---\n\n### docs/guide/setup.md");
  });

  it("builds stable index Markdown", () => {
    expect(buildIndexMarkdown({
      ...indexParams,
      toolName: "miku-text-bundle",
      toolVersion: "1.1.0",
    })).toBe(`---
tool: miku-text-bundle
version: 1.1.0
role: index
terminal: true
---

# Text Bundle Index

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
| \`docs/huge.md\` | File size exceeds the 100 byte limit. |

## Warnings

- \`src/large.ts\` exceeded --max-chars and was split into 2 chunks.

## Markers

| File | Line | Kind | Text |
| --- | ---: | --- | --- |
| \`TODO.md\` | 3 | TODO | - TODO check \\| escape |

`);
  });

  it("adds Agent Skill handoff guidance when SKILL.md is bundled", () => {
    const skillFile: CollectedFile = {
      absolutePath: "/repo/skills/example/SKILL.md",
      relativePath: "skills/example/SKILL.md",
      extension: "md",
      content: "---\nname: example\n---\n",
      charCount: 22,
      lineCount: 3,
      markers: [],
    };

    const index = buildIndexMarkdown({
      ...indexParams,
      collectedFiles: [...collectedFiles, skillFile],
    });

    expect(index).toContain("## Agent Skill Handoff");
    expect(index).toContain("`skills/example/SKILL.md`");
    expect(index).toContain("keep them available for reference in this conversation");
    expect(index).toContain("activation rules, operating rules, workflow, and references");
  });

  it("builds stable prompt Markdown", () => {
    expect(buildPromptMarkdown({
      promptFileName: "text-bundle-001.md",
      partFileNames: promptPartFileNames,
      indexFileName: "text-bundle-002.md",
      toolName: "miku-text-bundle",
      toolVersion: "1.1.0",
    })).toBe(`---
tool: miku-text-bundle
version: 1.1.0
role: prompt
---

# Text Bundle Prompt

This is the reading instruction for a Text Bundle that packages a set of files for handoff to generative AI or similar tools.

The Markdown bundle will be sent in multiple messages in the order listed below.

After each message, do not analyze or summarize the content yet. Reply only with \`Received\`.

Do not start the final response until you receive \`text-bundle-002.md\`.

## Reading Order

1. \`text-bundle-001.md\`
2. \`text-bundle-002.md\`

## Response File

If you save the final response after \`text-bundle-002.md\`, \`text-bundle-response.md\` is the recommended filename.

## Output Format

Output the final response as Markdown text.

Wrap the entire final Markdown response in a single outer fence using \`~~~~\`. Use tildes for the outer fence because the Markdown response may contain backtick code fences.
`);
  });
});
