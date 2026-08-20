/**
 * Centralized exclusion/sensitivity/size policy — the single source of
 * truth both the scanner and every analyzer's `readFile()` call through, so
 * the root-boundary guarantee (task item 90) and the sensitive-file/binary
 * exclusion (items 15/16) can never be bypassed by a different code path.
 */

import * as fs from "fs";
import * as path from "path";

export const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "target",
  "build",
  "dist",
  ".next",
  "coverage",
  "vendor",
  "out",
  "output",
  "bin",
  "obj",
  ".idea",
  ".vscode",
]);

// Matched against the file's basename.
export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^credentials(\.json)?$/i,
  /^secrets\..+$/i,
];

export const BINARY_EXTENSIONS = new Set([
  ".jar",
  ".war",
  ".ear",
  ".class",
  ".dll",
  ".exe",
  ".zip",
  ".tar",
  ".gz",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".pdf",
  ".woff",
  ".woff2",
  ".ico",
  ".so",
  ".dylib",
]);

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB, conservative default for text analysis

export function isExcludedDir(basename: string): boolean {
  return EXCLUDED_DIRS.has(basename);
}

export function isSensitiveFile(basename: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((p) => p.test(basename));
}

export function isBinaryFile(basename: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(basename).toLowerCase());
}

/** Always POSIX-style, repository-relative — never leaks the absolute root. */
export function toRepoRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

/**
 * Resolves a repository-relative candidate path against `root` and verifies
 * the result stays inside it — rejects `..` traversal and any symlink whose
 * real target escapes the root. Returns undefined (never throws) when the
 * path is missing, unsafe, or outside the boundary — task items 13/71/90/91.
 */
export function resolveWithinRoot(root: string, relativeCandidate: string): string | undefined {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relativeCandidate);

  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;

  if (!fs.existsSync(candidate)) return undefined;

  // Symlinks are never followed — the simplest safe default (task item 13).
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) return undefined;

  return candidate;
}
