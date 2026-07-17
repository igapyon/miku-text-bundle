import { describe, expect, it } from "vitest";

import { buildIndexMarkdown, buildKnowledgeSourceMarkdown, buildPartMarkdown, buildPromptMarkdown } from "../src/main.js";
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

### FILE: src/main.ts

--- BEGIN FILE: src/main.ts ---

Source code block
Language: TypeScript

~~~ts
const value = 1;
~~~

--- END FILE: src/main.ts ---

`);
  });

  it("renders JavaScript with explicit Agent-readable file block metadata", () => {
    expect(buildPartMarkdown({
      ...part,
      chunks: [{
        ...part.chunks[0]!,
        relativePath: "src/example.js",
        extension: "js",
        content: "function hello() {\n  return \"hello\";\n}\n",
      }],
    })).toContain(`### FILE: src/example.js

--- BEGIN FILE: src/example.js ---

Source code block
Language: JavaScript

~~~js
function hello() {
  return "hello";
}
~~~

--- END FILE: src/example.js ---`);
  });

  it("maps common source and structured-text extensions to explicit languages", () => {
    const cases = [
      ["src/app.py", "py", "Source code block", "Python", "python"],
      ["src/main.go", "go", "Source code block", "Go", "go"],
      ["config/settings.yaml", "yaml", "Source text block", "YAML", "yaml"],
      ["web/index.html", "html", "Source code block", "HTML", "html"],
    ] as const;

    for (const [relativePath, extension, blockLabel, displayName, fenceLanguage] of cases) {
      const output = buildPartMarkdown({
        ...part,
        chunks: [{ ...part.chunks[0]!, relativePath, extension }],
      });
      expect(output).toContain(`${blockLabel}\nLanguage: ${displayName}\n\n~~~${fenceLanguage}`);
    }
  });

  it("uses neutral metadata for unknown extensions", () => {
    expect(buildPartMarkdown({
      ...part,
      chunks: [{
        ...part.chunks[0]!,
        relativePath: "data/example.custom-format",
        extension: "custom-format",
      }],
    })).toContain("Source content block\nLanguage: Unknown\n\n~~~\n");
  });

  it("preserves repeated blank lines inside file bodies in both modes", () => {
    const content = "first\n\n\nsecond\n";
    const blankLinePart: BundlePart = {
      ...part,
      chunks: [{ ...part.chunks[0]!, content }],
    };

    expect(buildPartMarkdown(blankLinePart)).toContain(content);
    expect(buildKnowledgeSourceMarkdown(blankLinePart)).toContain(content);
  });

  it("escapes control characters in file block display paths", () => {
    expect(buildPartMarkdown({
      ...part,
      chunks: [{
        ...part.chunks[0]!,
        relativePath: "docs/line\nbreak\tname.md",
        extension: "md",
      }],
    })).toContain("### FILE: docs/line\\nbreak\\tname.md\n\n--- BEGIN FILE: docs/line\\nbreak\\tname.md ---");

    expect(buildPartMarkdown({
      ...part,
      chunks: [{
        ...part.chunks[0]!,
        relativePath: "docs/literal\\n.md",
        extension: "md",
      }],
    })).toContain("### FILE: docs/literal\\\\n.md");
  });

  it("keeps control characters, pipes, and backticks inside index path cells", () => {
    const unusualPath = "docs/line\nbreak|`name`.md";
    const index = buildIndexMarkdown({
      ...indexParams,
      parts: [{
        ...part,
        chunks: [{ ...part.chunks[0]!, relativePath: unusualPath }],
      }],
    });

    expect(index).toContain("``docs/line\\nbreak\\|`name`.md``");
    expect(index).not.toContain("docs/line\nbreak");
  });

  it("builds stable Knowledge source file-block Markdown", () => {
    expect(buildKnowledgeSourceMarkdown({
      ...part,
      fileName: "knowledge-001.md",
      chunks: [{
        ...part.chunks[0]!,
        relativePath: "docs/guide.md",
        extension: "md",
        content: "# Guide\n\nDetails.\n",
      }],
    })).toBe(`# Knowledge Source 001

### FILE: docs/guide.md

--- BEGIN FILE: docs/guide.md ---

Source text block
Language: Markdown

~~~md
# Guide

Details.
~~~

--- END FILE: docs/guide.md ---

`);
  });

  it("uses longer tilde fences when content contains tilde fences", () => {
    expect(buildPartMarkdown({
      ...part,
      chunks: [{
        ...part.chunks[0]!,
        content: "~~~md\ninside\n~~~\n",
      }],
    })).toContain("~~~~ts\n~~~md\ninside\n~~~\n~~~~");
  });

  it("wraps every file chunk in explicit file boundary markers", () => {
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
    })).toContain("--- END FILE: src/main.ts ---\n\n### FILE: docs/guide/setup.md\n\n--- BEGIN FILE: docs/guide/setup.md ---");
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

After each non-terminal Part, do not analyze or summarize the content yet. Reply only with \`OK\`.

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
