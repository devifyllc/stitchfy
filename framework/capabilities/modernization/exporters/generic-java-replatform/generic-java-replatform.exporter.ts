/**
 * generic-java-replatform — the first concrete ModernizationExporter (task
 * item 6). Supports a candidate only when Phase 8 already classified an
 * explicit `replatform` strategy, Phase 8.5A proves a Java codebase, and a
 * real runtime ModernizationDelta exists — never merely because WebSphere
 * repository evidence exists (the strategy stays authoritative, task item
 * 6/7). Orchestration stays generic: nothing here branches on a literal
 * target-technology string outside this one exporter.
 */

import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate, ModernizationDelta } from "../../schemas/modernization.types.js";
import type { ModernizationExporter, ModernizationExportBundle } from "../exporter.types.js";
import { assessGenericJavaReplatformReadiness } from "./generic-java-replatform.readiness.js";
import { buildGenericJavaReplatformBundle } from "./generic-java-replatform.artifacts.js";

export const GENERIC_JAVA_REPLATFORM_EXPORTER_ID = "generic-java-replatform";

export function findRuntimeDelta(candidate: MigrationCandidate, architecture: ModernizationArchitecture): ModernizationDelta | undefined {
  return architecture.modernizationDeltas.find((d) => d.systemId === candidate.systemId && d.category === "runtime" && Boolean(d.targetState));
}

export function supportsGenericJavaReplatform(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): boolean {
  const hasExplicitReplatform = candidate.strategyOptions.some((o) => o.strategy === "replatform" && o.status === "explicit");
  const hasJavaCodebase = codebase.repository.detectedLanguages.includes("Java");
  const hasRuntimeDelta = Boolean(findRuntimeDelta(candidate, architecture));
  return hasExplicitReplatform && hasJavaCodebase && hasRuntimeDelta;
}

export const genericJavaReplatformExporter: ModernizationExporter = {
  id: GENERIC_JAVA_REPLATFORM_EXPORTER_ID,
  name: "Generic Java Replatform",
  version: "1.0.0",
  target: "generic-java-replatform",

  supports: supportsGenericJavaReplatform,

  assessReadiness(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult) {
    return assessGenericJavaReplatformReadiness(candidate, architecture, codebase, genericJavaReplatformExporter.id);
  },

  async export(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): Promise<ModernizationExportBundle> {
    return buildGenericJavaReplatformBundle(candidate, architecture, codebase, genericJavaReplatformExporter);
  },
};
