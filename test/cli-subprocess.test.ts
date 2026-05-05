import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];

function makeTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "miku-text-bundle-cli-test-"));
  tempRoots.push(root);
  return root;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("CLI subprocess", () => {
  it("generates Markdown bundle files from dist/main.js", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");

    const stdout = execFileSync(process.execPath, ["dist/main.js", root, output, "--max-chars", "120000"], {
      encoding: "utf8",
    });

    expect(stdout).toContain("completed:");
    expect(readFileSync(join(output, "text-bundle-index.md"), "utf8")).toContain("src/main.ts");
    expect(readFileSync(join(output, "text-bundle-001.md"), "utf8")).toContain("### src/main.ts");
    expect(readFileSync(join(output, "text-bundle-prompt.md"), "utf8")).toContain("text-bundle-response.md");
  });
});
