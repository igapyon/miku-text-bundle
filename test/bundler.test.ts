import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import iconv from "iconv-lite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseOutputDirectory, createTextBundle } from "../src/main.js";
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
    outputDirectory: join(root, "out"),
    maxChars: 120000,
    encoding: {
      default: "utf-8",
      extensions: {},
    },
    verbose: false,
    ...overrides,
  };
}

function indexSection(content: string): string {
  return content.slice(content.indexOf("# Text Bundle Index"));
}

function partBodySection(content: string): string {
  const indexStart = content.indexOf("# Text Bundle Index");
  return indexStart === -1 ? content : content.slice(0, indexStart);
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("output directory selection", () => {
  it("uses the explicit output directory", () => {
    const root = makeTempRepo();

    expect(chooseOutputDirectory(join(root, "out"))).toBe(join(root, "out"));
  });
});

describe("createTextBundle", () => {
  it("generates compact part files with embedded prompt and index from default repository files", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "TODO.md"), "- TODO root item\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n// FIXME check later\n");
    writeFile(join(root, ".git", "secret.ts"), "const hidden = true;\n");
    writeFile(join(root, ".gitignore"), "ignored.ts\n");
    writeFile(join(root, "src", "ignored.ts"), "const ignored = true;\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 52));

    expect(result.filesCollected).toBe(4);
    expect(result.filesIgnored).toBe(2);
    expect(result.directoriesIgnored).toBe(2);
    expect(result.ignoredByDirectory).toBe(1);
    expect(result.ignoredByGitignore).toBe(1);
    expect(result.ignoredByOutputDirectory).toBe(0);
    expect(result.partsGenerated).toBe(1);
    expect(result.promptPath).toBe(result.partPaths[0]);
    expect(result.indexPath).toBe(result.partPaths[0]);

    const output = readFileSync(result.indexPath, "utf8");
    const index = indexSection(output);
    const part = readFileSync(result.partPaths[0]!, "utf8");
    const prompt = readFileSync(result.promptPath, "utf8");

    expect(part).toContain("# Text Bundle Prompt");
    expect(part).toContain("# Text Bundle Part 001");
    expect(part).toContain("# Text Bundle Index");
    expect(index).toContain("`src/main.ts`");
    expect(index).toContain("FIXME");
    expect(index).toContain("`.gitignore`");
    expect(index).not.toContain(`Input directory: \`${root}\``);
    expect(index).not.toContain(`Output directory: \`${join(root, "out")}\``);
    expect(index).not.toContain(".git/secret.ts");
    expect(index).not.toContain("ignored.ts");
    expect(part).toContain("### src/main.ts");
    expect(part).toContain("~~~ts");
    expect(prompt).toContain("text-bundle-001.md");
    expect(prompt).toContain("text-bundle-response.md");
  });

  it("skips binary or non-UTF-8 files and records warnings", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "main.ts"), Buffer.from([0, 1, 2, 3]));

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 53));

    const index = indexSection(readFileSync(result.indexPath, "utf8"));
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

  it("skips text files that exceed the input file byte limit", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "docs", "huge.md"), "x".repeat(101));

    const result = createTextBundle(bundleOptions(root, {
      maxInputFileBytes: 100,
    }), new Date(2026, 4, 5, 12, 56));

    const index = indexSection(readFileSync(result.indexPath, "utf8"));
    const part = partBodySection(readFileSync(result.partPaths[0]!, "utf8"));
    expect(result.filesCollected).toBe(1);
    expect(result.filesSkipped).toBe(1);
    expect(index).toContain("`docs/huge.md`");
    expect(index).toContain("File size exceeds the 100 byte limit.");
    expect(part).not.toContain("docs/huge.md");
  });

  it("splits oversized files and writes warnings outside code fences", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "large.ts"), "line1\nline2\nline3\nline4\n");

    const result = createTextBundle(bundleOptions(root, {
      maxChars: 12,
    }), new Date(2026, 4, 5, 12, 54));

    expect(result.partsGenerated).toBeGreaterThan(1);
    const index = indexSection(readFileSync(result.indexPath, "utf8"));
    const firstPart = readFileSync(result.partPaths[0]!, "utf8");
    expect(index).toContain("--max-chars");
    expect(firstPart).toContain("This file exceeded the size limit and was split.");
    expect(firstPart.indexOf("This file exceeded the size limit and was split.")).toBeLessThan(firstPart.indexOf("~~~ts"));
  });

  it("excludes known binary extensions before reading files", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "assets", "image.png"), Buffer.from([0, 1, 2, 3]));

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 12, 55));

    const index = readFileSync(result.indexPath, "utf8");
    expect(index).toContain("`README.md`");
    expect(index).not.toContain("assets/image.png");
    expect(result.filesSkipped).toBe(0);
    expect(result.filesIgnored).toBe(1);
    expect(result.ignoredByExtension).toBe(1);
  });

  it("uses customized exclude extension and directory lists", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "assets", "document.pdf"), Buffer.from([0, 1, 2, 3]));
    writeFile(join(root, "notes", "skip.md"), "# Skip\n");
    writeFile(join(root, "dist", "generated.md"), "# Generated\n");

    const result = createTextBundle(bundleOptions(root, {
      excludeExtensions: [".png"],
      excludeDirectories: ["notes"],
    }), new Date(2026, 4, 5, 12, 55));

    const index = readFileSync(result.indexPath, "utf8");
    expect(index).toContain("`README.md`");
    expect(index).toContain("`dist/generated.md`");
    expect(index).toContain("`assets/document.pdf`");
    expect(index).toContain("UTF-8");
    expect(index).not.toContain("notes/skip.md");
    expect(result.filesIgnored).toBe(1);
    expect(result.directoriesIgnored).toBe(2);
    expect(result.ignoredByDirectory).toBe(1);
    expect(result.ignoredByOutputDirectory).toBe(0);
  });

  it("prints ignored count details in verbose mode", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "assets", "image.png"), Buffer.from([0, 1, 2, 3]));
    writeFile(join(root, "dist", "generated.md"), "# Generated\n");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    let output = "";

    try {
      createTextBundle(bundleOptions(root, { verbose: true }), new Date(2026, 4, 5, 12, 55));
      output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    } finally {
      logSpy.mockRestore();
    }

    expect(output).toContain("ignoredDirectories=2");
    expect(output).toContain("ignoredFiles=2");
    expect(output).toContain("ignoredByDirectory=1");
    expect(output).toContain("ignoredByExtension=1");
    expect(output).toContain("ignoredByGitignore=0");
    expect(output).toContain("ignoredByOutputDirectory=0");
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

  it("orders bundle files by POSIX relative path UTF-16 code units", () => {
    const root = makeTempRepo();
    writeFile(join(root, "file-2.txt"), "two\n");
    writeFile(join(root, "file-10.txt"), "ten\n");
    writeFile(join(root, "A.txt"), "upper\n");
    writeFile(join(root, "b.txt"), "lower\n");
    writeFile(join(root, "あ.txt"), "hiragana\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 13, 2));

    const part = readFileSync(result.partPaths[0]!, "utf8");
    const headings = part.match(/^### .+$/gm) ?? [];
    expect(headings).toEqual([
      "### A.txt",
      "### b.txt",
      "### file-10.txt",
      "### file-2.txt",
      "### あ.txt",
    ]);
  });

  it("does not extract markers from filename references", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "See TODO.md for project tasks.\nTODO: actionable item\n");

    const result = createTextBundle(bundleOptions(root), new Date(2026, 4, 5, 13, 0));

    const index = indexSection(readFileSync(result.indexPath, "utf8"));
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
    expect(prompt).toContain("## Reading Order");
    expect(prompt).toContain("1. `text-bundle-001.md`");
    expect(prompt).not.toContain("2. `text-bundle-001.md`");
    expect(prompt).toContain("`Received`");
    expect(prompt).not.toContain("`END_OF_TEXT_BUNDLE`");
    expect(prompt).toContain("## Response File");
    expect(prompt).toContain("`text-bundle-response.md`");
    expect(prompt).toContain("## Output Format");
    expect(prompt).toContain("~~~~");
  });

  it("uses a custom filename prefix for generated bundle files", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");

    const result = createTextBundle(bundleOptions(root, {
      filenamePrefix: "igapyon-skill-compactor-text-bundle",
    }), new Date(2026, 4, 5, 12, 58));

    expect(result.promptPath.endsWith("igapyon-skill-compactor-text-bundle-001.md")).toBe(true);
    expect(result.partPaths.map((path) => basename(path))).toEqual(["igapyon-skill-compactor-text-bundle-001.md"]);
    expect(result.indexPath.endsWith("igapyon-skill-compactor-text-bundle-001.md")).toBe(true);

    const prompt = readFileSync(result.promptPath, "utf8");
    const index = readFileSync(result.indexPath, "utf8");
    expect(prompt).toContain("1. `igapyon-skill-compactor-text-bundle-001.md`");
    expect(prompt).not.toContain("2. `igapyon-skill-compactor-text-bundle-001.md`");
    expect(index).toContain("| `igapyon-skill-compactor-text-bundle-001.md` |");
  });

  it("rejects unsafe filename prefixes through the core API", () => {
    const root = makeTempRepo();
    writeFile(join(root, "README.md"), "# README\n");

    expect(() => createTextBundle(bundleOptions(root, {
      filenamePrefix: "bad/name",
    }), new Date(2026, 4, 5, 12, 58))).toThrow("filenamePrefix must contain only");
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
    expect(part).toContain("~~~ts\nconst value = 1;\n\n~~~");
  });

  it("does not create output files in dry-run mode", () => {
    const root = makeTempRepo();
    const outputDirectory = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");

    const result = createTextBundle(bundleOptions(root, {
      outputDirectory,
      dryRun: true,
    }), new Date(2026, 4, 5, 13, 3));

    expect(result.dryRun).toBe(true);
    expect(result.filesCollected).toBe(2);
    expect(result.partsGenerated).toBe(1);
    expect(result.partPaths).toEqual([join(outputDirectory, "text-bundle-001.md")]);
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it("allows text-bundle-999.md as the final compact part", () => {
    const root = makeTempRepo();
    for (let index = 1; index <= 999; index += 1) {
      writeFile(join(root, "src", `file-${String(index).padStart(3, "0")}.txt`), "x");
    }

    const result = createTextBundle(bundleOptions(root, {
      maxChars: 1,
    }), new Date(2026, 4, 5, 13, 1));

    expect(result.partPaths.map((path) => basename(path)).at(-1)).toBe("text-bundle-999.md");
  });
});
