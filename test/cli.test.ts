import { describe, expect, it, vi } from "vitest";

import { HelpRequestedError, parseArgs, printHelp } from "../src/main.js";

describe("parseArgs", () => {
  it("parses positional arguments and options", () => {
    expect(parseArgs([".", "out", "--max-chars", "1000", "--max-input-file-bytes", "2000", "--include", "docs/**/*.md,package.json", "--exclude", "test/**", "--verbose"])).toEqual({
      inputDirectory: ".",
      outputDirectory: "out",
      maxChars: 1000,
      maxInputFileBytes: 2000,
      includePatterns: ["docs/**/*.md", "package.json"],
      excludePatterns: ["test/**"],
      verbose: true,
    });
  });

  it("parses named directory options", () => {
    expect(parseArgs(["--input-directory", ".", "--output-directory", "out"])).toMatchObject({
      inputDirectory: ".",
      outputDirectory: "out",
      maxChars: 120000,
      maxInputFileBytes: 1000000,
    });
  });

  it("signals help requests", () => {
    expect(() => parseArgs(["--help"])).toThrow(HelpRequestedError);
  });
});

describe("printHelp", () => {
  it("prints the package bin command", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    let output = "";

    try {
      printHelp();
      output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    } finally {
      logSpy.mockRestore();
    }

    expect(output).toContain("miku-text-bundle <inputDir>");
    expect(output).toContain("--max-chars");
    expect(output).toContain("--max-input-file-bytes");
  });
});
