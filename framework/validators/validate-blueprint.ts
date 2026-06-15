/**
 * validate-blueprint — Validates an output website-blueprint.json
 * against the website-blueprint.schema.json definition.
 *
 * TODO: Integrate a JSON Schema validator (e.g., ajv) for full
 * schema-compliant validation. The stub below checks required fields manually.
 */

import * as fs from "fs";
import * as path from "path";
import type { ValidationResult } from "./validate-input.js";

// Required top-level keys in the blueprint
const REQUIRED_KEYS = ["meta", "business", "ux", "seo", "accessibility", "pages"] as const;

export function validateBlueprint(blueprintPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const resolved = path.resolve(blueprintPath);
  if (!fs.existsSync(resolved)) {
    return { valid: false, errors: [`Blueprint not found: ${resolved}`], warnings };
  }

  let blueprint: Record<string, unknown>;
  try {
    blueprint = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  } catch {
    return { valid: false, errors: ["Blueprint is not valid JSON."], warnings };
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in blueprint)) {
      errors.push(`Missing required key: ${key}`);
    }
  }

  const meta = blueprint.meta as Record<string, unknown> | undefined;
  if (meta && !meta.generatedAt) {
    warnings.push("Blueprint meta is missing generatedAt timestamp.");
  }

  const pages = blueprint.pages as unknown[] | undefined;
  if (!Array.isArray(pages) || pages.length === 0) {
    errors.push("Blueprint must define at least one page.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
