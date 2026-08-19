/**
 * Deterministic validation beyond the Zod shape check — same {ok, issues}
 * pattern as every capability validator. The two rules that matter most for
 * this module specifically: no absolute path ever appears in evidence, and
 * every derived fact traces back to a real observed one.
 */

import type { CodebaseAnalysisResult } from "../contracts/codebase-analysis-result.types.js";

export interface CodebaseValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface CodebaseValidationResult {
  ok: boolean;
  issues: CodebaseValidationIssue[];
}

const ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]|^\//;

function checkUniqueIds(ids: string[], label: string): CodebaseValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): CodebaseValidationIssue => ({ code: "duplicate-id", message: `${label} id "${id}" is used ${count} times`, severity: "error" }));
}

export function validateCodebaseAnalysisResult(result: CodebaseAnalysisResult): CodebaseValidationResult {
  const issues: CodebaseValidationIssue[] = [];

  const moduleIds = new Set(result.modules.map((m) => m.id));
  const buildSystemIds = new Set(result.buildSystems.map((b) => b.id));

  issues.push(...checkUniqueIds(result.buildSystems.map((b) => b.id), "BuildSystemFact"));
  issues.push(...checkUniqueIds(result.modules.map((m) => m.id), "CodeModule"));
  issues.push(...checkUniqueIds(result.dependencies.map((d) => d.id), "CodeDependencyFact"));
  issues.push(...checkUniqueIds(result.frameworks.map((f) => f.id), "FrameworkFact"));
  issues.push(...checkUniqueIds(result.runtimes.map((r) => r.id), "RuntimeFact"));
  issues.push(...checkUniqueIds(result.sourceStructure.map((s) => s.id), "SourceStructureFact"));

  const allEvidenceRefs = [
    ...result.buildSystems.flatMap((f) => f.metadata.evidenceRefs),
    ...result.dependencies.flatMap((f) => f.metadata.evidenceRefs),
    ...result.frameworks.flatMap((f) => f.metadata.evidenceRefs),
    ...result.runtimes.flatMap((f) => f.metadata.evidenceRefs),
    ...result.sourceStructure.flatMap((f) => f.metadata.evidenceRefs),
    ...result.informationGaps.flatMap((g) => g.evidenceRefs),
    ...result.evidenceRefs,
  ];

  for (const ref of allEvidenceRefs) {
    if (ABSOLUTE_PATH_PATTERN.test(ref.filePath)) {
      issues.push({ code: "absolute-path-leak", message: `Evidence reference filePath "${ref.filePath}" looks like an absolute path`, severity: "error" });
    }
  }
  if (ABSOLUTE_PATH_PATTERN.test(result.repository.rootMarker)) {
    issues.push({ code: "absolute-path-leak", message: `RepositoryInventory.rootMarker "${result.repository.rootMarker}" looks like an absolute path`, severity: "error" });
  }

  for (const fact of [...result.buildSystems, ...result.dependencies, ...result.frameworks, ...result.runtimes, ...result.sourceStructure]) {
    if (fact.metadata.provenance === "derived" && fact.metadata.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-derived-fact", message: `Derived fact "${fact.id}" has no evidence references`, severity: "error" });
    }
  }

  for (const module of result.modules) {
    for (const buildSystemId of module.buildSystemIds) {
      if (!buildSystemIds.has(buildSystemId)) {
        issues.push({ code: "unknown-build-system", message: `CodeModule "${module.id}" references unknown build system "${buildSystemId}"`, severity: "error" });
      }
    }
  }
  for (const dependency of result.dependencies) {
    if (dependency.moduleId && !moduleIds.has(dependency.moduleId)) {
      issues.push({ code: "unknown-module", message: `CodeDependencyFact "${dependency.id}" references unknown module "${dependency.moduleId}"`, severity: "error" });
    }
  }
  for (const framework of result.frameworks) {
    for (const moduleId of framework.moduleIds) {
      if (!moduleIds.has(moduleId)) {
        issues.push({ code: "unknown-module", message: `FrameworkFact "${framework.id}" references unknown module "${moduleId}"`, severity: "error" });
      }
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
