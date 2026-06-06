import { extname, sep } from "node:path";

export function toPosixPath(pathValue: string): string {
  return pathValue.split(sep).join("/");
}

export function getExtension(pathValue: string): string {
  return extname(pathValue).toLowerCase().replace(/^\./, "");
}

export function normalizePattern(pattern: string): string {
  return toPosixPath(pattern.trim()).replace(/^\.\//, "");
}

export function compareUtf16CodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
