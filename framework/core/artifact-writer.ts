/**
 * Writes ImplementationArtifacts to disk under output/artifacts/ —
 * mirrors blueprint-writer.ts / business-context-writer.ts's pattern.
 * Generation stays pure (generators return content, never touch fs); this
 * is the one place that does.
 */

import * as fs from "fs";
import * as path from "path";
import type { ImplementationArtifact } from "./contracts/artifact.js";

export interface WriteResult {
  ok: boolean;
  filePath?: string;
  error?: string;
}

export function writeImplementationArtifacts(
  artifacts: ImplementationArtifact[],
  outputDir: string
): WriteResult[] {
  return artifacts.map((artifact): WriteResult => {
    if (!artifact.path) {
      return { ok: false, error: `artifact "${artifact.id}" has no path` };
    }

    const filePath = path.join(outputDir, artifact.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const content = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content, null, 2);
    fs.writeFileSync(filePath, content);

    return { ok: true, filePath };
  });
}
