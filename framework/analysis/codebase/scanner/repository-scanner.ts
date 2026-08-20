/**
 * Safe repository scanner — filesystem inventory only. Uses `fs.readdirSync`/
 * `fs.lstatSync` exclusively (no `child_process`, no network). Sorted
 * traversal makes identical repository contents produce identical fact
 * ordering (task item 72).
 */

import * as fs from "fs";
import * as path from "path";
import { isExcludedDir, isSensitiveFile, isBinaryFile, toRepoRelativePath, MAX_FILE_SIZE_BYTES } from "./path-safety.js";
import type { ScannedFile } from "../contracts/codebase-analyzer.types.js";

export interface ScanResult {
  files: ScannedFile[];
  analyzedFileCount: number;
  ignoredFileCount: number;
}

function walk(root: string, dir: string, files: ScannedFile[], ignored: { count: number }): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    // Symlinks are never followed, files or directories (task item 13).
    if (entry.isSymbolicLink()) {
      ignored.count++;
      continue;
    }

    if (entry.isDirectory()) {
      if (isExcludedDir(entry.name)) {
        ignored.count++;
        continue;
      }
      walk(root, absolutePath, files, ignored);
      continue;
    }

    if (!entry.isFile()) {
      ignored.count++;
      continue;
    }

    if (isSensitiveFile(entry.name) || isBinaryFile(entry.name)) {
      ignored.count++;
      continue;
    }

    let size: number;
    try {
      size = fs.statSync(absolutePath).size;
    } catch {
      ignored.count++;
      continue;
    }

    if (size > MAX_FILE_SIZE_BYTES) {
      ignored.count++;
      continue;
    }

    files.push({ relativePath: toRepoRelativePath(root, absolutePath), size, ext: path.extname(entry.name).toLowerCase() });
  }
}

export function scanRepository(root: string): ScanResult {
  const files: ScannedFile[] = [];
  const ignored = { count: 0 };
  walk(root, root, files, ignored);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { files, analyzedFileCount: files.length, ignoredFileCount: ignored.count };
}
