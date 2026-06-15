/**
 * validate-input — Validates that the input Markdown file exists
 * and meets minimum structural requirements before the pipeline runs.
 *
 * TODO: Add content validation using the intake schema to verify
 * that at least the required fields can be extracted.
 */

import * as fs from "fs";
import * as path from "path";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateInput(inputPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    errors.push(`Input file not found: ${resolved}`);
    return { valid: false, errors, warnings };
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    errors.push(`Input path is not a file: ${resolved}`);
    return { valid: false, errors, warnings };
  }

  const content = fs.readFileSync(resolved, "utf-8").trim();
  if (content.length === 0) {
    errors.push("Input file is empty.");
    return { valid: false, errors, warnings };
  }

  if (content.length < 100) {
    warnings.push("Input file is very short — the pipeline may produce incomplete results.");
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") {
    warnings.push(`Expected a Markdown file (.md), got: ${ext}`);
  }

  // Check for at least one heading — a minimal proxy for structured content
  if (!content.includes("# ") && !content.includes("## ")) {
    warnings.push("Input file has no Markdown headings. Structure may be hard to parse.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
