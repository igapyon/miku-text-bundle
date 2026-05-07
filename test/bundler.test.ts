import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import iconv from "iconv-lite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseOutputDirectory, createTextBundle, defaultOutputBase } from "../src/main.js";
import type { CliOptions } from "../src/main.js";

const tempRoots: string[] = [];

function makeTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "miku-text-bundle-test-"));
  tempRoots.push(root);
  return root;
}

function writeFile(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function bundleOptions(root: string, overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    inputDirectory: root,
    maxChars: 120000,
    encoding: {
      default: "utf-8",
      extensions: {},
    },
    includePatterns: [],
    excludePatterns: [],
    verbose: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("output directory selection", () => {
  it("uses local timestamp and suffixes collisions", () => {
    const root = makeTempRepo();
    const now = new Date(2026, 4, 5, 12, 52);
    const base = defaultOutputBase(root, now);
    mkdirSync(base, { recursive: true });

    expect(chooseOutputDirectory(root, undefined, now)).toBe(`${base}-1`);
  });
});

describe("createTextBundle", () => {
  it("generates index, parts, and prompt from default repository files", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "TODO.md"), "- TODO root item\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n// FIXME check later\n");
    writeFile(join(root, ".hidden", "secret.ts"), "const hidden = true;\n");
    writeFile(join(root, ".gitignore"), "ignored.ts\n");
    writeFile(join(root, "src", "ignored.ts"), "const ignored = true;\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 52));

    expect(result.filesCollected).toBe(3);
    expect(result.partsGenerated).toBe(1);

    const index = readFileSync(result.indexPath, "utf8");
    const part = readFileSync(result.partPaths[0]!, "utf8");
    const prompt = readFileSync(result.promptPath, "utf8");

    expect(index).toContain("`src/main.ts`");
    expect(index).toContain("FIXME");
    expect(index).not.toContain(".hidden");
    expect(index).not.toContain("ignored.ts");
    expect(part).toContain("### src/main.ts");
    expect(part).toContain("```ts");
    expect(prompt).toContain("text-bundle-000-index.md");
    expect(prompt).toContain("text-bundle-response.md");
  });

  it("skips binary or non-UTF-8 files and records warnings", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "main.ts"), Buffer.from([0, 1, 2, 3]));

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 53));

    const index = readFileSync(result.indexPath, "utf8");
    expect(result.filesSkipped).toBe(1);
    expect(index).toContain("UTF-8");
  });

  it("uses extension encoding rules for Shift_JIS files", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "Legacy.java"), iconv.encode("こんにちは\n", "shift_jis"));

    const result = createTextBundle(bundleOptions(root, {
      encoding: {
        default: "utf-8",
        extensions: {
          ".java": "shift_jis",
        },
      },
    }), new Date(2026, 4, 5, 12, 58));

    const part = readFileSync(result.partPaths[0]!, "utf8");
    expect(result.filesCollected).toBe(1);
    expect(result.filesSkipped).toBe(0);
    expect(part).toContain("こんにちは");
  });

  it("uses the default encoding when no extension rule matches", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), iconv.encode("# 説明\n", "shift_jis"));

    const result = createTextBundle(bundleOptions(root, {
      encoding: {
        default: "shift_jis",
        extensions: {},
      },
    }), new Date(2026, 4, 5, 12, 59));

    const part = readFileSync(result.partPaths[0]!, "utf8");
    expect(result.filesCollected).toBe(1);
    expect(result.filesSkipped).toBe(0);
    expect(part).toContain("# 説明");
  });

  it("skips explicitly included files that exceed the input file byte limit", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "docs", "huge.md"), "x".repeat(101));

    const result = createTextBundle(bundleOptions(root, {
      maxInputFileBytes: 100,
      includePatterns: ["docs/**/*.md"],
    }), new Date(2026, 4, 5, 12, 56));

    const index = readFileSync(result.indexPath, "utf8");
    const part = readFileSync(result.partPaths[0]!, "utf8");
    expect(result.filesCollected).toBe(1);
    expect(result.filesSkipped).toBe(1);
    expect(index).toContain("`docs/huge.md`");
    expect(index).toContain("ファイルサイズ");
    expect(part).not.toContain("docs/huge.md");
  });

  it("splits oversized files and writes warnings outside code fences", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "large.ts"), "line1\nline2\nline3\nline4\n");

    const result = createTextBundle(bundleOptions(root, {
      maxChars: 12,
    }), new Date(2026, 4, 5, 12, 54));

    expect(result.partsGenerated).toBeGreaterThan(1);
    const index = readFileSync(result.indexPath, "utf8");
    const firstPart = readFileSync(result.partPaths[0]!, "utf8");
    expect(index).toContain("--max-chars");
    expect(firstPart).toContain("やむを得ず分割");
    expect(firstPart.indexOf("やむを得ず分割")).toBeLessThan(firstPart.indexOf("```ts"));
  });

  it("honors explicit include and exclude patterns without bypassing hard exclusions", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "docs", "extra.md"), "# Extra\n");
    writeFile(join(root, "docs", "skip.md"), "# Skip\n");
    writeFile(join(root, ".secret", "extra.md"), "# Secret\n");
    writeFile(join(root, ".gitignore"), "ignored.md\n");
    writeFile(join(root, "docs", "ignored.md"), "# Ignored\n");

    const result = createTextBundle(bundleOptions(root, {
      includePatterns: ["docs/**/*.md", ".secret/**/*.md"],
      excludePatterns: ["docs/skip.md"],
    }), new Date(2026, 4, 5, 12, 55));

    const index = readFileSync(result.indexPath, "utf8");
    expect(index).toContain("`README.md`");
    expect(index).toContain("`docs/extra.md`");
    expect(index).not.toContain("docs/skip.md");
    expect(index).not.toContain("docs/ignored.md");
    expect(index).not.toContain(".secret");
  });

  it("writes the index Markdown sections in a stable order", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "TODO.md"), "- TODO check index\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");
    writeFile(join(root, "src", "bad.ts"), Buffer.from([0]));

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 57));

    const index = readFileSync(result.indexPath, "utf8");
    expect(index).toContain("# Text Bundle Index\n");
    expect(index.indexOf("## Summary")).toBeLessThan(index.indexOf("## Parts"));
    expect(index.indexOf("## Parts")).toBeLessThan(index.indexOf("## Skipped Files"));
    expect(index.indexOf("## Skipped Files")).toBeLessThan(index.indexOf("## Warnings"));
    expect(index.indexOf("## Warnings")).toBeLessThan(index.indexOf("## Markers"));
    expect(index).toContain("| Part | Chunks | Approx chars | Files |");
    expect(index).toContain("| File | Reason |");
    expect(index).toContain("| File | Line | Kind | Text |");
  });

  it("does not extract markers from filename references", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "See TODO.md for project tasks.\nTODO: actionable item\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 13, 0));

    const index = readFileSync(result.indexPath, "utf8");
    expect(index).toContain("TODO: actionable item");
    expect(index).not.toContain("See TODO.md for project tasks.");
  });

  it("writes the prompt Markdown reading order and response contract", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 58));

    const prompt = readFileSync(result.promptPath, "utf8");
    expect(prompt).toContain("# Text Bundle Prompt\n");
    expect(prompt).toContain("## 読み込み順");
    expect(prompt).toContain("1. `text-bundle-000-index.md`");
    expect(prompt).toContain("2. `text-bundle-001.md`");
    expect(prompt).toContain("`受領しました`");
    expect(prompt).toContain("`END_OF_TEXT_BUNDLE`");
    expect(prompt).toContain("## 回答ファイル");
    expect(prompt).toContain("`text-bundle-response.md`");
    expect(prompt).toContain("## 出力形式");
    expect(prompt).toContain("~~~~");
  });

  it("writes part Markdown with path headings and backtick code fences", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 59));

    const part = readFileSync(result.partPaths[0]!, "utf8");
    expect(part).toContain("# Text Bundle Part 001");
    expect(part).toContain("### src/main.ts");
    expect(part).toContain("- Characters: 17");
    expect(part).toContain("- Source characters: 17");
    expect(part).toContain("- Source lines: 2");
    expect(part).toContain("```ts\nconst value = 1;\n\n```");
  });
});
