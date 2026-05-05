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
