import { normalizePattern } from "./path-utils.js";

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegex(pattern: string): RegExp {
  const normalized = normalizePattern(pattern);
  let source = "";

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    const afterNext = normalized[i + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      i += 2;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      i += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegex(char);
  }

  return new RegExp(`^${source}$`);
}

export function matchesAnyPattern(relativePath: string, patterns: string[]): boolean {
  const normalizedPath = normalizePattern(relativePath);
  return patterns.some((pattern) => {
    const normalizedPattern = normalizePattern(pattern);
    if (!normalizedPattern.includes("*")) {
      return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern.replace(/\/$/, "")}/`);
    }
    return globToRegex(normalizedPattern).test(normalizedPath);
  });
}

export function parseGitignore(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"));
}

export function matchesGitignore(relativePath: string, patterns: string[]): boolean {
  const normalizedPath = normalizePattern(relativePath);
  return patterns.some((pattern) => {
    const normalizedPattern = normalizePattern(pattern);
    const directoryOnly = normalizedPattern.endsWith("/");
    const cleanPattern = normalizedPattern.replace(/\/$/, "");

    if (cleanPattern.length === 0) {
      return false;
    }

    if (!cleanPattern.includes("/")) {
      const segments = normalizedPath.split("/");
      if (directoryOnly) {
        return segments.slice(0, -1).includes(cleanPattern);
      }
      return segments.includes(cleanPattern) || normalizedPath.endsWith(`/${cleanPattern}`);
    }

    if (directoryOnly) {
      return normalizedPath === cleanPattern || normalizedPath.startsWith(`${cleanPattern}/`);
    }

    if (cleanPattern.includes("*")) {
      return globToRegex(cleanPattern).test(normalizedPath);
    }

    return normalizedPath === cleanPattern || normalizedPath.startsWith(`${cleanPattern}/`);
  });
}
