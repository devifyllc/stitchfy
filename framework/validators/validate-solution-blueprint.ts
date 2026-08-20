/**
 * validate-solution-blueprint — file-level checker for an already-written
 * solution-blueprint.v1.json, following the same pattern as
 * validate-blueprint.ts (used by scripts/validate.ts). The in-pipeline Zod
 * validation used by solution-orchestrator.ts lives in
 * framework/schemas/solution-blueprint/solution-blueprint.schema.ts.
 */

import * as fs from "fs";
import * as path from "path";
import type { ValidationResult } from "./validate-input.js";

const REQUIRED_KEYS = ["project", "business"] as const;

export function validateSolutionBlueprintFile(blueprintPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const resolved = path.resolve(blueprintPath);
  if (!fs.existsSync(resolved)) {
    return { valid: false, errors: [`Solution blueprint not found: ${resolved}`], warnings };
  }

  let blueprint: Record<string, unknown>;
  try {
    blueprint = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  } catch {
    return { valid: false, errors: ["Solution blueprint is not valid JSON."], warnings };
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in blueprint)) {
      errors.push(`Missing required key: ${key}`);
    }
  }

  if (!("capabilities" in blueprint)) {
    warnings.push("Solution blueprint has no capabilities section — no capability has executed yet.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
