import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];
const indexFileName = "text-bundle-000-index.md";
const promptFileName = "text-bundle-000-prompt.md";
const firstPartFileName = "text-bundle-001.md";

function makeTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "miku-text-bundle-cli-test-"));
  tempRoots.push(root);
  return root;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function runCli(args: string[]): string {
  return execFileSync(process.execPath, ["dist/main.js", ...args], {
    encoding: "utf8",
  });
}

function readOutputFile(outputDirectory: string, fileName: string): string {
  return readFileSync(join(outputDirectory, fileName), "utf8");
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

    const stdout = runCli([root, output, "--max-chars", "120000"]);

    expect(stdout).toContain("completed:");
    expect(readOutputFile(output, indexFileName)).toContain("src/main.ts");
    expect(readOutputFile(output, firstPartFileName)).toContain("### src/main.ts");
    expect(readOutputFile(output, promptFileName)).toContain("text-bundle-response.md");
  });

  it("applies max input file bytes from the CLI", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "docs", "huge.md"), "x".repeat(101));

    const stdout = runCli([root, output, "--include", "docs/**/*.md", "--max-input-file-bytes", "100"]);

    const index = readOutputFile(output, indexFileName);
    const part = readOutputFile(output, firstPartFileName);
    expect(stdout).toContain("completed:");
    expect(index).toContain("`docs/huge.md`");
    expect(index).toContain("100 bytes");
    expect(part).not.toContain("docs/huge.md");
  });

  it("returns a non-zero exit code for an invalid input directory", () => {
    const root = makeTempRepo();
    const result = spawnSync(process.execPath, ["dist/main.js", join(root, "missing")], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Input directory does not exist");
    expect(result.stdout).toContain("Usage:");
  });

  it("returns a non-zero exit code for unknown options", () => {
    const root = makeTempRepo();
    const result = spawnSync(process.execPath, ["dist/main.js", root, "--unknown"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown argument: --unknown");
    expect(result.stdout).toContain("Usage:");
  });
});
