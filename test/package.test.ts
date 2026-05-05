import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(packageJson.files).toEqual(["dist/", "README.md", "LICENSE"]);
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
});
