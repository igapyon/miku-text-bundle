#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const bundlePath = "bundle/miku-text-bundle.mjs";
const sourceArchivePath = "bundle/miku-text-bundle-sources.tgz";
const maxChars = "120000";
const indexFileName = "text-bundle-001.md";
const promptFileName = "text-bundle-001.md";
const firstPartFileName = "text-bundle-001.md";
const root = mkdtempSync(join(tmpdir(), "miku-text-bundle-bundle-smoke-"));
const outputDirectory = join(root, "out");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

function assertIncludes(content, expected, fileName) {
  if (!content.includes(expected)) {
    throw new Error(`${fileName} did not contain expected text: ${expected}`);
  }
}

function assertExcludes(content, unexpected, fileName) {
  if (content.includes(unexpected)) {
    throw new Error(`${fileName} contained unexpected text: ${unexpected}`);
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
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "Legacy.java"), Buffer.from([
    0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd, 0x0a,
  ]));
}

function runBundleCli() {
  execFileSync(process.execPath, [
    bundlePath,
    "--input",
    root,
    "--output",
    outputDirectory,
    "--max-chars",
    maxChars,
    "--encoding-extension",
    ".java=shift_jis",
  ], {
    encoding: "utf8",
  });
}

function assertKnowledgeSourceMode() {
  const knowledgeInputDirectory = join(root, "knowledge-input");
  const knowledgeOutputDirectory = join(root, "knowledge-out");
  mkdirSync(knowledgeInputDirectory, { recursive: true });
  writeFileSync(join(knowledgeInputDirectory, "source.md"), "# Knowledge source content\n", "utf8");
  execFileSync(process.execPath, [
    bundlePath,
    "--input",
    knowledgeInputDirectory,
    "--output",
    knowledgeOutputDirectory,
    "--mode",
    "knowledge-source",
  ], {
    encoding: "utf8",
  });

  const partFileName = "knowledge-001.md";
  const indexFileName = "knowledge-index.md";
  const part = readFileSync(join(knowledgeOutputDirectory, partFileName), "utf8");
  assertFile(join(knowledgeOutputDirectory, partFileName), "Knowledge source part");
  assertFile(join(knowledgeOutputDirectory, indexFileName), "Knowledge source index");
  assertIncludes(part, "# Knowledge source content", partFileName);
  assertExcludes(part, "prompt: true", partFileName);
  assertExcludes(part, "terminal: true", partFileName);
}

function assertSymlinkEntrypoint() {
  const linkPath = join(root, "linked-miku-text-bundle.mjs");
  symlinkSync(join(process.cwd(), bundlePath), linkPath);

  const help = execFileSync(process.execPath, [linkPath, "--help"], {
    encoding: "utf8",
  });
  assertIncludes(help, "Usage:", "symlink bundle help");

  const version = execFileSync(process.execPath, [linkPath, "--version"], {
    encoding: "utf8",
  });
  if (version !== `${packageJson.version}\n`) {
    throw new Error(`symlink bundle version was ${JSON.stringify(version)}`);
  }
}

function assertSmokeOutput() {
  const index = readFileSync(join(outputDirectory, indexFileName), "utf8");
  const prompt = readFileSync(join(outputDirectory, promptFileName), "utf8");
  const part = readFileSync(join(outputDirectory, firstPartFileName), "utf8");

  assertIncludes(index, "README.md", indexFileName);
  assertIncludes(index, "src/Legacy.java", indexFileName);
  assertIncludes(prompt, "text-bundle-001.md", promptFileName);
  assertIncludes(part, "### README.md", firstPartFileName);
  assertIncludes(part, "### src/Legacy.java", firstPartFileName);
  assertIncludes(part, "こんにちは", firstPartFileName);
}

try {
  assertBundleArtifacts();
  writeSmokeInput();
  assertSymlinkEntrypoint();
  runBundleCli();
  assertSmokeOutput();
  assertKnowledgeSourceMode();
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("bundle smoke: ok");
