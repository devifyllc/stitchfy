/**
 * business-context-writer — mirrors blueprint-writer.ts. Writes
 * output/context/business-context.json.
 *
 * As of Phase 1 this validates and serializes the full DiscoveryResult
 * (not just the flat BusinessContext projection) — see
 * framework/discovery/discovery-result.types.ts for why DiscoveryResult is
 * the source of truth. The filename is unchanged; the content is richer.
 */

import * as fs from "fs";
import * as path from "path";
import { DiscoveryResultSchema } from "../schemas/discovery/discovery-result.schema.js";
import type { DiscoveryResult } from "../discovery/discovery-result.types.js";

export const BUSINESS_CONTEXT_FILENAME = "business-context.json";

export interface WriteResult {
  ok: boolean;
  filePath?: string;
  sizeKb?: number;
  errors?: string[];
}

export function writeBusinessContextArtifact(data: unknown, outputDir: string): WriteResult {
  const validation = DiscoveryResultSchema.safeParse(data);
  if (!validation.success) {
    return { ok: false, errors: validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }

  const discoveryResult: DiscoveryResult = validation.data;

  const contextDir = path.join(outputDir, "context");
  fs.mkdirSync(contextDir, { recursive: true });

  const filePath = path.join(contextDir, BUSINESS_CONTEXT_FILENAME);
  const json = JSON.stringify(discoveryResult, null, 2);
  fs.writeFileSync(filePath, json);

  const sizeKb = Math.round((json.length / 1024) * 10) / 10;
  return { ok: true, filePath, sizeKb };
}
