#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";

const product = "miku-text-bundle";
const bundleDir = "bundle";
const bundlePath = join(bundleDir, `${product}.mjs`);
const sourceArchivePath = join(bundleDir, `${product}-sources.tgz`);

const moduleOrder = [
  "markdown.js",
  "match.js",
  "path-utils.js",
  "cli.js",
  "bundler.js",
  "main.js",
];

function transformModule(fileName) {
  const content = readFileSync(join("dist", fileName), "utf8")
    .replace(/^#!.*\n/, "")
    .split("\n")
    .filter((line) => !line.match(/^import /))
    .filter((line) => !line.match(/^export \{ .* \} from "\.\/.*\.js";$/))
    .join("\n")
    .replace(/\bexport function\b/g, "function")
    .replace(/\bexport class\b/g, "class")
    .replace(/\bexport const\b/g, "const")
    .replace(/\bexport let\b/g, "let")
    .replace(/\bexport var\b/g, "var");

  return `// ${fileName}\n${content.trim()}\n`;
}

mkdirSync(bundleDir, { recursive: true });

const nodeImports = [
  'import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";',
  'import { dirname, extname, join, relative, resolve, sep } from "node:path";',
  'import { TextDecoder } from "node:util";',
  'import { pathToFileURL } from "node:url";',
];

const body = moduleOrder.map(transformModule).join("\n");
const exportsBlock = `export {
  HelpRequestedError,
  parseArgs,
  printHelp,
  createTextBundle,
  chooseOutputDirectory,
  defaultOutputBase,
  buildIndexMarkdown,
  buildPartMarkdown,
  buildPromptMarkdown,
  matchesAnyPattern,
  matchesGitignore,
  parseGitignore,
  getExtension,
  normalizePattern,
  toPosixPath,
  main,
};
`;

writeFileSync(bundlePath, `#!/usr/bin/env node\n${nodeImports.join("\n")}\n\n${body}\n${exportsBlock}`, "utf8");
chmodSync(bundlePath, 0o755);

rmSync(sourceArchivePath, { force: true });
const sourceFiles = [
  "src",
  "test",
  "docs/gitignore-limitations.md",
  "README.md",
  "TODO.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  ...moduleOrder.map((fileName) => join("dist", fileName)),
].map((path) => basename(path) === path ? path : path);

const tar = spawnSync("tar", ["-czf", sourceArchivePath, ...sourceFiles], {
  encoding: "utf8",
});

if (tar.status !== 0) {
  process.stderr.write(tar.stderr);
  process.exit(tar.status ?? 1);
}

console.log(`generated: ${bundlePath}`);
console.log(`generated: ${sourceArchivePath}`);
