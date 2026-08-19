/**
 * Generic exporter registry (task item 47) — adding a new export target is
 * a `register()` call in default-exporters.ts, never a switch statement
 * over exporter ids anywhere else. `findSupported()` takes the specific
 * candidate being considered, matching the per-candidate orchestration
 * policy (task item 48).
 */

import type { CodebaseAnalysisResult } from "../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate } from "../schemas/modernization.types.js";
import type { ModernizationExporter } from "./exporter.types.js";

export class ModernizationExporterRegistry {
  private exporters = new Map<string, ModernizationExporter>();

  register(exporter: ModernizationExporter): void {
    if (this.exporters.has(exporter.id)) {
      throw new Error(`ModernizationExporterRegistry: "${exporter.id}" is already registered`);
    }
    this.exporters.set(exporter.id, exporter);
  }

  get(id: string): ModernizationExporter | undefined {
    return this.exporters.get(id);
  }

  getAll(): ModernizationExporter[] {
    return [...this.exporters.values()];
  }

  findSupported(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): ModernizationExporter[] {
    return this.getAll().filter((exporter) => exporter.supports(candidate, architecture, codebase));
  }
}
