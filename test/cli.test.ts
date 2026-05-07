import { describe, expect, it, vi } from "vitest";

import { CLI_VERSION, HelpRequestedError, parseArgs, printHelp, printVersion, VersionRequestedError } from "../src/main.js";

describe("parseArgs", () => {
  it("parses positional arguments and options", () => {
    expect(parseArgs([".", "out", "--max-chars", "1000", "--max-input-file-bytes", "2000", "--include", "docs/**/*.md,package.json", "--exclude", "test/**", "--verbose"])).toEqual({
      inputDirectory: ".",
      outputDirectory: "out",
      maxChars: 1000,
      maxInputFileBytes: 2000,
      encoding: {
        default: "utf-8",
        extensions: {},
      },
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
      encoding: {
        default: "utf-8",
        extensions: {},
      },
    });
  });

  it("parses default and extension encoding options", () => {
    expect(parseArgs([".", "--encoding", "shift_jis", "--encoding-extension", ".ts=utf-8,.java=shift_jis"])).toMatchObject({
      inputDirectory: ".",
      encoding: {
        default: "shift_jis",
        extensions: {
          ".ts": "utf-8",
          ".java": "shift_jis",
        },
      },
    });
  });

  it("rejects unsupported encoding options", () => {
    expect(() => parseArgs([".", "--encoding", "latin1"])).toThrow("--encoding must be one of");
    expect(() => parseArgs([".", "--encoding-extension", "java=shift_jis"])).toThrow("leading dot");
    expect(() => parseArgs([".", "--encoding-extension", ".java=latin1"])).toThrow("--encoding-extension must be one of");
  });

  it("signals help requests", () => {
    expect(() => parseArgs(["--help"])).toThrow(HelpRequestedError);
    expect(() => parseArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("signals version requests", () => {
    expect(() => parseArgs(["--version"])).toThrow(VersionRequestedError);
    expect(() => parseArgs(["-v"])).toThrow(VersionRequestedError);
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
    expect(output).toContain("--encoding");
    expect(output).toContain("--encoding-extension");
    expect(output).toContain("--version");
  });
});

describe("printVersion", () => {
  it("prints the package version", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    let output = "";

    try {
      printVersion();
      output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    } finally {
      logSpy.mockRestore();
    }

    expect(output).toBe(CLI_VERSION);
  });
});
