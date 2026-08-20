/**
 * solution-blueprint-writer — mirrors blueprint-writer.ts. Validates and
 * writes output/blueprints/solution-blueprint.v1.json. Kept in a separate
 * output directory (plural "blueprints") from the legacy
 * output/blueprint/website-blueprint.v1.json to keep the two models visibly
 * distinct during the migration — see docs/architecture/ARCHITECTURE.md.
 */

import * as fs from "fs";
import * as path from "path";
import { validateSolutionBlueprint } from "../schemas/solution-blueprint/solution-blueprint.schema.js";
import type { SolutionBlueprint } from "../schemas/solution-blueprint/solution-blueprint.types.js";

export const SOLUTION_BLUEPRINT_FILENAME = "solution-blueprint.v1.json";

export interface WriteResult {
  ok: boolean;
  filePath?: string;
  sizeKb?: number;
  errors?: string[];
}

export function writeSolutionBlueprintArtifact(data: unknown, outputDir: string): WriteResult {
  const validation = validateSolutionBlueprint(data);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const blueprint: SolutionBlueprint = validation.blueprint;

  const blueprintDir = path.join(outputDir, "blueprints");
  fs.mkdirSync(blueprintDir, { recursive: true });

  const filePath = path.join(blueprintDir, SOLUTION_BLUEPRINT_FILENAME);
  const json = JSON.stringify(blueprint, null, 2);
  fs.writeFileSync(filePath, json);

  const sizeKb = Math.round((json.length / 1024) * 10) / 10;
  return { ok: true, filePath, sizeKb };
}
