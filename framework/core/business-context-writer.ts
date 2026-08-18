/**
 * business-context-writer — mirrors blueprint-writer.ts. Writes
 * output/context/business-context.json.
 */

import * as fs from "fs";
import * as path from "path";
import { BusinessContextSchema } from "../schemas/business-context/business-context.schema.js";
import type { BusinessContext } from "../discovery/business/business-context.types.js";

export const BUSINESS_CONTEXT_FILENAME = "business-context.json";

export interface WriteResult {
  ok: boolean;
  filePath?: string;
  sizeKb?: number;
  errors?: string[];
}

export function writeBusinessContextArtifact(
  data: unknown,
  outputDir: string
): WriteResult {
  const validation = BusinessContextSchema.safeParse(data);
  if (!validation.success) {
    return { ok: false, errors: validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }

  const businessContext: BusinessContext = validation.data;

  const contextDir = path.join(outputDir, "context");
  fs.mkdirSync(contextDir, { recursive: true });

  const filePath = path.join(contextDir, BUSINESS_CONTEXT_FILENAME);
  const json = JSON.stringify(businessContext, null, 2);
  fs.writeFileSync(filePath, json);

  const sizeKb = Math.round((json.length / 1024) * 10) / 10;
  return { ok: true, filePath, sizeKb };
}
