import { describe, expect, it } from "vitest";

import { matchesAnyPattern, matchesGitignore, parseGitignore } from "../src/main.js";

describe("matchesAnyPattern", () => {
  it("matches simple glob patterns", () => {
    expect(matchesAnyPattern("docs/readme.md", ["docs/**/*.md"])).toBe(true);
    expect(matchesAnyPattern("src/main.ts", ["test/**"])).toBe(false);
  });
});

describe("matchesGitignore", () => {
  it("matches root gitignore directory and file patterns", () => {
    const patterns = parseGitignore("node_modules/\nignored.ts\n# comment\n");
    expect(matchesGitignore("node_modules/pkg/index.js", patterns)).toBe(true);
    expect(matchesGitignore("src/ignored.ts", patterns)).toBe(true);
    expect(matchesGitignore("src/main.ts", patterns)).toBe(false);
  });

  it("matches basename globs at any depth", () => {
    const patterns = parseGitignore("*.log\n*.tmp\n");
    expect(matchesGitignore("debug.log", patterns)).toBe(true);
    expect(matchesGitignore("logs/debug.log", patterns)).toBe(true);
    expect(matchesGitignore("src/main.ts", patterns)).toBe(false);
  });

  it("matches rooted patterns only from the repository root", () => {
    const patterns = parseGitignore("/dist/\n/root-only.ts\n");
    expect(matchesGitignore("dist/main.js", patterns)).toBe(true);
    expect(matchesGitignore("pkg/dist/main.js", patterns)).toBe(false);
    expect(matchesGitignore("root-only.ts", patterns)).toBe(true);
    expect(matchesGitignore("src/root-only.ts", patterns)).toBe(false);
  });

  it("matches nested path globs", () => {
    const patterns = parseGitignore("generated/**/*.ts\n");
    expect(matchesGitignore("generated/main.ts", patterns)).toBe(true);
    expect(matchesGitignore("generated/deep/main.ts", patterns)).toBe(true);
    expect(matchesGitignore("src/generated/main.ts", patterns)).toBe(true);
  });
});
