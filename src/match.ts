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

function matchesBasenamePattern(normalizedPath: string, cleanPattern: string, rootAnchored: boolean, directoryOnly: boolean): boolean {
  const segments = normalizedPath.split("/");

  if (directoryOnly) {
    if (rootAnchored) {
      return segments[0] === cleanPattern;
    }
    return segments.slice(0, -1).includes(cleanPattern);
  }

  if (cleanPattern.includes("*")) {
    const regex = globToRegex(cleanPattern);
    return segments.some((segment) => regex.test(segment));
  }

  if (rootAnchored) {
    return normalizedPath === cleanPattern;
  }

  return segments.includes(cleanPattern) || normalizedPath.endsWith(`/${cleanPattern}`);
}

function matchesPathPattern(normalizedPath: string, cleanPattern: string, rootAnchored: boolean, directoryOnly: boolean): boolean {
  if (directoryOnly) {
    if (rootAnchored) {
      return normalizedPath === cleanPattern || normalizedPath.startsWith(`${cleanPattern}/`);
    }
    return normalizedPath === cleanPattern || normalizedPath.includes(`/${cleanPattern}/`) || normalizedPath.startsWith(`${cleanPattern}/`);
  }

  if (cleanPattern.includes("*")) {
    const regex = globToRegex(cleanPattern);
    if (rootAnchored) {
      return regex.test(normalizedPath);
    }
    return regex.test(normalizedPath) || globToRegex(`**/${cleanPattern}`).test(normalizedPath);
  }

  if (rootAnchored) {
    return normalizedPath === cleanPattern || normalizedPath.startsWith(`${cleanPattern}/`);
  }

  return normalizedPath === cleanPattern || normalizedPath.endsWith(`/${cleanPattern}`) || normalizedPath.startsWith(`${cleanPattern}/`);
}

export function matchesGitignore(relativePath: string, patterns: string[]): boolean {
  const normalizedPath = normalizePattern(relativePath);
  return patterns.some((pattern) => {
    const rootAnchored = pattern.trim().startsWith("/");
    const normalizedPattern = normalizePattern(pattern.replace(/^\//, ""));
    const directoryOnly = normalizedPattern.endsWith("/");
    const cleanPattern = normalizedPattern.replace(/\/$/, "");

    if (cleanPattern.length === 0) {
      return false;
    }

    if (!cleanPattern.includes("/")) {
      return matchesBasenamePattern(normalizedPath, cleanPattern, rootAnchored, directoryOnly);
    }

    return matchesPathPattern(normalizedPath, cleanPattern, rootAnchored, directoryOnly);
  });
}
