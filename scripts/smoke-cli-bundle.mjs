#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = mkdtempSync(join(tmpdir(), "miku-text-bundle-bundle-smoke-"));

try {
  writeFileSync(join(root, "README.md"), "# README\n");
  execFileSync(process.execPath, ["bundle/miku-text-bundle.mjs", root, join(root, "out"), "--max-chars", "120000"], {
    encoding: "utf8",
  });

  const index = readFileSync(join(root, "out", "text-bundle-000-index.md"), "utf8");
  const prompt = readFileSync(join(root, "out", "text-bundle-000-prompt.md"), "utf8");
  const part = readFileSync(join(root, "out", "text-bundle-001.md"), "utf8");

  if (!index.includes("README.md") || !prompt.includes("END_OF_TEXT_BUNDLE") || !part.includes("### README.md")) {
    throw new Error("Bundle smoke output did not contain expected Markdown sections.");
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("bundle smoke: ok");
