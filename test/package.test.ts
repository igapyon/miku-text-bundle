import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
    expect(packageJson.files).toEqual(["dist/", "README.md", "docs/gitignore-limitations.md", "LICENSE"]);
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
    const files = packInfo.files.map((file) => file.path).sort();

    expect(files).toContain("README.md");
    expect(files).toContain("docs/gitignore-limitations.md");
    expect(files).toContain("LICENSE");
    expect(files).toContain("package.json");
    expect(files).toContain("dist/main.js");
    expect(files).toContain("dist/main.d.ts");
    expect(files.every((file) => file.startsWith("dist/") || ["README.md", "docs/gitignore-limitations.md", "LICENSE", "package.json"].includes(file))).toBe(true);
    expect(files.some((file) => file.startsWith("src/"))).toBe(false);
    expect(files.some((file) => file.startsWith("test/"))).toBe(false);
    expect(files.some((file) => file.startsWith("workplace/"))).toBe(false);
  });
});
