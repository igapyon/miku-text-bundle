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
});
