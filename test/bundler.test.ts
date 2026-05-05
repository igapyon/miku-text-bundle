import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseOutputDirectory, createTextBundle, defaultOutputBase } from "../src/main.js";

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

    const result = createTextBundle({
      inputDirectory: root,
      maxChars: 120000,
      includePatterns: [],
      excludePatterns: [],
      verbose: false,
    }, new Date(2026, 4, 5, 12, 52));

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
    expect(prompt).toContain("text-bundle-index.md");
    expect(prompt).toContain("text-bundle-response.md");
  });

  it("skips binary or non-UTF-8 files and records warnings", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "main.ts"), Buffer.from([0, 1, 2, 3]));

    const result = createTextBundle({
      inputDirectory: root,
      maxChars: 120000,
      includePatterns: [],
      excludePatterns: [],
      verbose: false,
    }, new Date(2026, 4, 5, 12, 53));

    const index = readFileSync(result.indexPath, "utf8");
    expect(result.filesSkipped).toBe(1);
    expect(index).toContain("UTF-8");
  });

  it("splits oversized files and writes warnings outside code fences", () => {
    const root = makeTempRepo();
    writeFile(join(root, "src", "large.ts"), "line1\nline2\nline3\nline4\n");

    const result = createTextBundle({
      inputDirectory: root,
      maxChars: 12,
      includePatterns: [],
      excludePatterns: [],
      verbose: false,
    }, new Date(2026, 4, 5, 12, 54));

    expect(result.partsGenerated).toBeGreaterThan(1);
    const index = readFileSync(result.indexPath, "utf8");
    const firstPart = readFileSync(result.partPaths[0]!, "utf8");
    expect(index).toContain("--max-chars");
    expect(firstPart).toContain("やむを得ず分割");
    expect(firstPart.indexOf("やむを得ず分割")).toBeLessThan(firstPart.indexOf("```ts"));
  });
});
