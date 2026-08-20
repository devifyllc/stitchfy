/**
 * Pure orchestration function — export generation requires EXPLICIT user
 * intent (task item 101), unlike every capability's automatic execution.
 * Called only when the CLI's `--modernization-export <target>` flag is
 * supplied alongside `--codebase`/`--system-id`; plain `--codebase
 * --system-id` (no export flag) performs analysis/enrichment only (task
 * item 102). A requested target that isn't registered, or that doesn't
 * support the mapped candidate, produces no bundle and no error (task
 * item 103/104) — never a fabricated recipe.
 */

import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { CodebaseAnalysisResult } from "../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture } from "../schemas/modernization.types.js";
import type { ModernizationExportBundle } from "./exporter.types.js";
import { createDefaultModernizationExporterRegistry } from "./default-exporters.js";

export async function generateModernizationExports(
  architecture: ModernizationArchitecture,
  codebase: CodebaseAnalysisResult,
  systemId: string,
  requestedTarget: string
): Promise<{ bundles: ModernizationExportBundle[]; artifacts: ImplementationArtifact[]; notes: string[] }> {
  const registry = createDefaultModernizationExporterRegistry();
  const exporter = registry.get(requestedTarget);
  const notes: string[] = [];

  if (!exporter) {
    notes.push(`Requested modernization export target "${requestedTarget}" is not a registered exporter — no export generated.`);
    return { bundles: [], artifacts: [], notes };
  }

  const candidates = architecture.migrationCandidates.filter((c) => c.systemId === systemId);
  if (candidates.length === 0) {
    notes.push(`No migration candidate found for system "${systemId}" — no export generated.`);
    return { bundles: [], artifacts: [], notes };
  }

  const bundles: ModernizationExportBundle[] = [];
  const artifacts: ImplementationArtifact[] = [];

  for (const candidate of candidates) {
    if (!exporter.supports(candidate, architecture, codebase)) {
      notes.push(`Exporter "${exporter.id}" does not support candidate "${candidate.id}" (system "${systemId}") — no export generated.`);
      continue;
    }

    const bundle = await exporter.export(candidate, architecture, codebase);
    bundles.push(bundle);
    artifacts.push(...bundle.artifacts);
    notes.push(`Exported candidate "${candidate.id}" via "${exporter.id}": readiness ${bundle.readiness.status}.`);
  }

  return { bundles, artifacts, notes };
}
