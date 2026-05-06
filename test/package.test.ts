import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const PACKAGE_RUNTIME_FILES = ["dist/", "README.md", "docs/gitignore-limitations.md", "docs/project-design.md", "LICENSE"];
const REQUIRED_PACK_FILES = [
  "README.md",
  "docs/gitignore-limitations.md",
  "docs/project-design.md",
  "LICENSE",
  "package.json",
  "dist/main.js",
  "dist/main.d.ts",
];
const ALLOWED_PACK_ROOT_FILES = ["README.md", "docs/gitignore-limitations.md", "docs/project-design.md", "LICENSE", "package.json"];

function npmPackDryRunFiles(): string[] {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: "workplace/.npm-cache",
    },
  });

  expect(result.status).toBe(0);

  const [packInfo] = JSON.parse(result.stdout) as [{
    files: { path: string }[];
  }];
  return packInfo.files.map((file) => file.path).sort();
}

function isAllowedPackFile(file: string): boolean {
  return file.startsWith("dist/") || ALLOWED_PACK_ROOT_FILES.includes(file);
}

describe("package metadata", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    name: string;
    version: string;
    license: string;
    type: string;
    bin: Record<string, string>;
    exports: Record<string, string>;
    types: string;
    files: string[];
    scripts: Record<string, string>;
    repository: { type: string; url: string };
    devDependencies: Record<string, string>;
  };

  it("keeps the CLI version in sync with package.json", async () => {
    const { CLI_VERSION } = await import("../src/main.js");

    expect(CLI_VERSION).toBe(packageJson.version);
  });

  it("declares the CLI package shape", () => {
    expect(packageJson.name).toBe("miku-text-bundle");
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.type).toBe("module");
    expect(packageJson.bin).toEqual({
      "miku-text-bundle": "./dist/main.js",
    });
    expect(packageJson.exports).toEqual({
      ".": "./dist/main.js",
    });
    expect(packageJson.types).toBe("./dist/main.d.ts");
  });

  it("limits npm package files to runtime artifacts and docs", () => {
    expect(packageJson.files).toEqual(PACKAGE_RUNTIME_FILES);
  });

  it("declares repository metadata", () => {
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/igapyon/miku-text-bundle.git",
    });
  });

  it("keeps verification scripts available", () => {
    expect(packageJson.scripts.build).toContain("npm run verify");
    expect(packageJson.scripts.verify).toContain("npm test");
    expect(packageJson.scripts.verify).toContain("npm run pack:check");
  });

  it("uses Vitest 4 or later for tests", () => {
    expect(packageJson.devDependencies.vitest).toMatch(/^\^4\./);
  });

  it("keeps npm dry-run package contents limited to runtime files and docs", () => {
    const files = npmPackDryRunFiles();

    for (const file of REQUIRED_PACK_FILES) {
      expect(files).toContain(file);
    }
    expect(files.every(isAllowedPackFile)).toBe(true);
    expect(files.some((file) => file.startsWith("src/"))).toBe(false);
    expect(files.some((file) => file.startsWith("test/"))).toBe(false);
    expect(files.some((file) => file.startsWith("workplace/"))).toBe(false);
  });
});
