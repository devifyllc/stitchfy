/**
 * blueprint-writer — Validates and writes the website blueprint to disk.
 *
 * Validation runs against blueprint.schema.ts (Zod) before any write.
 * If validation fails, the file is NOT written and errors are returned.
 */

import * as fs from "fs";
import * as path from "path";
import { validateBlueprint } from "../schemas/blueprint.schema.js";
import type { WebsiteBlueprint } from "../schemas/blueprint.types.js";

export const BLUEPRINT_FILENAME = "website-blueprint.v1.json";

export interface WriteResult {
  ok: boolean;
  filePath?: string;
  sizeKb?: number;
  errors?: string[];
}

export function writeBlueprintArtifact(
  data: unknown,
  outputDir: string
): WriteResult {
  // 1. Validate
  const validation = validateBlueprint(data);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const blueprint: WebsiteBlueprint = validation.blueprint;

  // 2. Write
  const blueprintDir = path.join(outputDir, "blueprint");
  fs.mkdirSync(blueprintDir, { recursive: true });

  const filePath = path.join(blueprintDir, BLUEPRINT_FILENAME);
  const json = JSON.stringify(blueprint, null, 2);
  fs.writeFileSync(filePath, json);

  const sizeKb = Math.round((json.length / 1024) * 10) / 10;
  return { ok: true, filePath, sizeKb };
}
