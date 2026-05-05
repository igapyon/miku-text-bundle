#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const bundlePath = "bundle/miku-text-bundle.mjs";
const sourceArchivePath = "bundle/miku-text-bundle-sources.tgz";
const maxChars = "120000";
const indexFileName = "text-bundle-000-index.md";
const promptFileName = "text-bundle-000-prompt.md";
const firstPartFileName = "text-bundle-001.md";
const root = mkdtempSync(join(tmpdir(), "miku-text-bundle-bundle-smoke-"));
const outputDirectory = join(root, "out");

function assertIncludes(content, expected, fileName) {
  if (!content.includes(expected)) {
    throw new Error(`${fileName} did not contain expected text: ${expected}`);
  }
}

function assertFile(path, label) {
  const fileStat = statSync(path, { throwIfNoEntry: false });
  if (!fileStat?.isFile()) {
    throw new Error(`${label} was not generated: ${path}`);
  }
  if (fileStat.size === 0) {
    throw new Error(`${label} was empty: ${path}`);
  }
}

function assertBundleArtifacts() {
  assertFile(bundlePath, "CLI bundle");
  assertFile(sourceArchivePath, "CLI bundle source archive");
}

function writeSmokeInput() {
  writeFileSync(join(root, "README.md"), "# README\n");
}

function runBundleCli() {
  execFileSync(process.execPath, [bundlePath, root, outputDirectory, "--max-chars", maxChars], {
    encoding: "utf8",
  });
}

function assertSmokeOutput() {
  const index = readFileSync(join(outputDirectory, indexFileName), "utf8");
  const prompt = readFileSync(join(outputDirectory, promptFileName), "utf8");
  const part = readFileSync(join(outputDirectory, firstPartFileName), "utf8");

  assertIncludes(index, "README.md", indexFileName);
  assertIncludes(prompt, "END_OF_TEXT_BUNDLE", promptFileName);
  assertIncludes(part, "### README.md", firstPartFileName);
}

try {
  assertBundleArtifacts();
  writeSmokeInput();
  runBundleCli();
  assertSmokeOutput();
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("bundle smoke: ok");
