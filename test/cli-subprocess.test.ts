import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];
const indexFileName = "text-bundle-001.md";
const promptFileName = "text-bundle-001.md";
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

function partBodySection(content: string): string {
  const indexStart = content.indexOf("# Text Bundle Index");
  return indexStart === -1 ? content : content.slice(0, indexStart);
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

    const stdout = runCli(["--input", root, "--output", output, "--max-chars", "120000"]);

    expect(stdout).toContain("completed:");
    expect(stdout).toContain("file(s) skipped");
    expect(stdout).toContain("directories ignored");
    expect(stdout).toContain("file(s) ignored");
    expect(readOutputFile(output, indexFileName)).toContain("src/main.ts");
    expect(readOutputFile(output, firstPartFileName)).toContain("### src/main.ts");
    expect(readOutputFile(output, promptFileName)).toContain("text-bundle-response.md");
  });

  it("prints help and version from dist/main.js", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

    expect(runCli(["--help"])).toContain("Usage:");
    expect(runCli(["--version"])).toBe(`${packageJson.version}\n`);
  });

  it("starts from a symlinked dist/main.js path", () => {
    const root = makeTempRepo();
    const linkPath = join(root, "linked-main.js");
    symlinkSync(join(process.cwd(), "dist", "main.js"), linkPath);

    const stdout = execFileSync(process.execPath, [linkPath, "--help"], {
      encoding: "utf8",
    });

    expect(stdout).toContain("Usage:");
  });

  it("applies max input file bytes from the CLI", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "docs", "huge.md"), "x".repeat(101));

    const stdout = runCli(["--input", root, "--output", output, "--max-input-file-bytes", "100"]);

    const index = readOutputFile(output, indexFileName);
    const part = partBodySection(readOutputFile(output, firstPartFileName));
    expect(stdout).toContain("completed:");
    expect(index).toContain("`docs/huge.md`");
    expect(index).toContain("100 byte limit");
    expect(part).not.toContain("docs/huge.md");
  });

  it("applies filename prefix from the CLI", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");

    const stdout = runCli([
      "--input",
      root,
      "--output",
      output,
      "--filename-prefix",
      "sample-repo-text-bundle",
    ]);

    expect(stdout).toContain("sample-repo-text-bundle-001.md");
    expect(readOutputFile(output, "sample-repo-text-bundle-001.md")).toContain("sample-repo-text-bundle-001.md");
    expect(readOutputFile(output, "sample-repo-text-bundle-001.md")).toContain("### README.md");
    expect(readOutputFile(output, "sample-repo-text-bundle-001.md")).toContain("# Text Bundle Index");
  });

  it("generates Knowledge source files and management index from dist/main.js", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# Repository facts\n");

    const stdout = runCli(["--input", root, "--output", output, "--mode", "knowledge-source"]);

    expect(stdout).toContain("1 knowledge file(s), 1 management index");
    expect(readOutputFile(output, "knowledge-001.md")).toContain("- Source path: `README.md`");
    expect(readOutputFile(output, "knowledge-001.md")).not.toContain("Text Bundle Prompt");
    expect(readOutputFile(output, "knowledge-index.md")).toContain("# Knowledge Bundle Index");
  });

  it("estimates collection without writing files in dry-run mode", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");
    writeFile(join(root, "src", "main.ts"), "const value = 1;\n");

    const stdout = runCli(["--input", root, "--output", output, "--dry-run"]);

    expect(stdout).toContain("dry-run:");
    expect(stdout).toContain("1 part(s)");
    expect(stdout).toContain("2 file(s) collected");
    expect(stdout).toContain("no files written");
    expect(stdout).not.toContain("generated:");
    expect(existsSync(output)).toBe(false);
  });

  it("plans Knowledge source files without writing in dry-run mode", () => {
    const root = makeTempRepo();
    const output = join(root, "out");
    writeFile(join(root, "README.md"), "# README\n");

    const stdout = runCli(["--input", root, "--output", output, "--mode", "knowledge-source", "--dry-run"]);

    expect(stdout).toContain("dry-run: 1 knowledge file(s), 1 management index");
    expect(stdout).toContain("no files written");
    expect(existsSync(output)).toBe(false);
  });

  it("returns a non-zero exit code for an invalid input directory", () => {
    const root = makeTempRepo();
    const result = spawnSync(process.execPath, ["dist/main.js", "--input", join(root, "missing"), "--output", join(root, "out")], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Input directory does not exist");
    expect(result.stdout).toContain("Usage:");
  });

  it("returns a non-zero exit code for unknown options", () => {
    const root = makeTempRepo();
    const result = spawnSync(process.execPath, ["dist/main.js", "--input", root, "--output", join(root, "out"), "--unknown"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown argument: --unknown");
    expect(result.stdout).toContain("Usage:");
  });
});
