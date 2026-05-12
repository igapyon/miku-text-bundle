import { describe, expect, it, vi } from "vitest";

import { CLI_VERSION, HelpRequestedError, parseArgs, printHelp, printVersion, VersionRequestedError } from "../src/main.js";

describe("parseArgs", () => {
  it("parses required directories and options", () => {
    expect(parseArgs(["--input", ".", "--output", "out", "--max-chars", "1000", "--max-input-file-bytes", "2000", "--verbose"])).toMatchObject({
      inputDirectory: ".",
      outputDirectory: "out",
      maxChars: 1000,
      maxInputFileBytes: 2000,
      encoding: {
        default: "utf-8",
        extensions: {},
      },
      verbose: true,
    });
  });

  it("requires input and output options", () => {
    expect(parseArgs(["--input", ".", "--output", "out"])).toMatchObject({
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

  it("parses exclude extension and directory list operations", () => {
    const options = parseArgs([
      "--input",
      ".",
      "--output",
      "out",
      "--add-exclude-extension",
      ".wasm,.BIN",
      "--remove-exclude-extension",
      ".pdf",
      "--add-exclude-directory",
      "generated,./logs/",
      "--remove-exclude-directory",
      "dist",
    ]);

    expect(options.excludeExtensions).toContain(".wasm");
    expect(options.excludeExtensions).toContain(".bin");
    expect(options.excludeExtensions).not.toContain(".pdf");
    expect(options.excludeDirectories).toContain("generated");
    expect(options.excludeDirectories).toContain("logs");
    expect(options.excludeDirectories).not.toContain("dist");
  });

  it("parses default and extension encoding options", () => {
    expect(parseArgs(["--input", ".", "--output", "out", "--encoding", "shift_jis", "--encoding-extension", ".ts=utf-8,.java=shift_jis"])).toMatchObject({
      inputDirectory: ".",
      outputDirectory: "out",
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
    expect(() => parseArgs(["--input", ".", "--output", "out", "--encoding", "latin1"])).toThrow("--encoding must be one of");
    expect(() => parseArgs(["--input", ".", "--output", "out", "--encoding-extension", "java=shift_jis"])).toThrow("leading dot");
    expect(() => parseArgs(["--input", ".", "--output", "out", "--encoding-extension", ".java=latin1"])).toThrow("--encoding-extension must be one of");
  });

  it("rejects removed and positional arguments", () => {
    expect(() => parseArgs([".", "out"])).toThrow("Positional arguments are not supported");
    expect(() => parseArgs(["--input-directory", ".", "--output", "out"])).toThrow("Unknown argument: --input-directory");
    expect(() => parseArgs(["--input", ".", "--output", "out", "--include", "docs/**/*.md"])).toThrow("Unknown argument: --include");
  });

  it("signals help requests", () => {
    expect(() => parseArgs(["--help"])).toThrow(HelpRequestedError);
    expect(() => parseArgs(["-h"])).toThrow("Unknown argument: -h");
  });

  it("signals version requests", () => {
    expect(() => parseArgs(["--version"])).toThrow(VersionRequestedError);
    expect(() => parseArgs(["-v"])).toThrow("Unknown argument: -v");
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

    expect(output).toContain("miku-text-bundle --input <dir> --output <dir>");
    expect(output).toContain("--max-chars");
    expect(output).toContain("--max-input-file-bytes");
    expect(output).toContain("--encoding");
    expect(output).toContain("--encoding-extension");
    expect(output).toContain("--add-exclude-extension");
    expect(output).toContain("--remove-exclude-directory");
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
