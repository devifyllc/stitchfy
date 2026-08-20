/**
 * Deterministic export-readiness assessment (task items 8-10) — no numeric
 * score. An unresolved CodebaseEvidenceConflict that directly concerns the
 * runtime/version being migrated blocks; an unresolved dependency version
 * or an unversioned explicit target lowers readiness to needs-review;
 * `ready` only when neither applies.
 */

import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate } from "../../schemas/modernization.types.js";
import type { ModernizationExportReadiness, ModernizationReadinessReason } from "../exporter.types.js";
import { supportsGenericJavaReplatform, findRuntimeDelta } from "./generic-java-replatform.exporter.js";

function systemRef(systemId: string) {
  return [{ entityType: "system" as const, entityId: systemId }];
}

const HAS_DIGIT_PATTERN = /\d/;

export function assessGenericJavaReplatformReadiness(
  candidate: MigrationCandidate,
  architecture: ModernizationArchitecture,
  codebase: CodebaseAnalysisResult,
  exporterId: string
): ModernizationExportReadiness {
  const base = { modernizationCandidateId: candidate.id, exporterId };

  if (!supportsGenericJavaReplatform(candidate, architecture, codebase)) {
    return {
      ...base,
      status: "unsupported",
      reasons: [
        {
          code: "not-supported",
          description: "This candidate does not have an explicit replatform strategy, a Java codebase, and a real runtime delta — the generic Java replatform exporter does not apply.",
          severity: "info",
          architectureRefs: systemRef(candidate.systemId),
        },
      ],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      informationGapIds: [],
      codebaseFactIds: [],
      conflictIds: [],
    };
  }

  const delta = findRuntimeDelta(candidate, architecture)!;
  const reasons: ModernizationReadinessReason[] = [];

  const relevantConflicts = architecture.codebaseEvidenceConflicts.filter((c) => c.topic.toLowerCase().includes("runtime") || c.topic.toLowerCase().includes("java"));
  const unresolvedConflicts = relevantConflicts.filter((c) => c.resolution === "unresolved");
  for (const conflict of unresolvedConflicts) {
    reasons.push({
      code: "unresolved-evidence-conflict",
      description: `Unresolved evidence conflict "${conflict.topic}" directly concerns the runtime being migrated: ${conflict.description}`,
      severity: "blocking",
      architectureRefs: systemRef(candidate.systemId),
      evidenceRefs: conflict.codebaseEvidence,
    });
  }

  if (!HAS_DIGIT_PATTERN.test(delta.targetState)) {
    reasons.push({
      code: "target-version-unresolved",
      description: `Target runtime "${delta.targetState}" is explicit, but no target version is specified — version-dependent transformations will remain unresolved.`,
      severity: "warning",
      architectureRefs: systemRef(candidate.systemId),
      evidenceRefs: [],
    });
  }

  const unresolvedDependencies = codebase.dependencies.filter((d) => d.direct === true && d.version === "unresolved");
  for (const dep of unresolvedDependencies) {
    reasons.push({
      code: "dependency-version-unresolved",
      description: `Dependency "${dep.group ? `${dep.group}:` : ""}${dep.name}" has a locally-unresolvable version — preserved as unresolved, not exported as a concrete proposal.`,
      severity: "warning",
      architectureRefs: systemRef(candidate.systemId),
      evidenceRefs: dep.metadata.evidenceRefs,
    });
  }

  const preservationRequirementIds = architecture.preservationRequirements.filter((p) => p.systemId === candidate.systemId).map((p) => p.id);
  const validationRequirementIds = architecture.validationRequirements.filter((v) => v.preservationRequirementIds.some((id) => preservationRequirementIds.includes(id))).map((v) => v.id);
  const codebaseFactIds = [...codebase.frameworks.map((f) => f.id), ...codebase.runtimes.map((r) => r.id), ...codebase.dependencies.map((d) => d.id)];

  const status = unresolvedConflicts.length > 0 ? "blocked" : reasons.some((r) => r.severity === "warning") ? "needs-review" : "ready";

  return {
    ...base,
    status,
    reasons,
    preservationRequirementIds,
    validationRequirementIds,
    informationGapIds: architecture.informationGaps.map((g) => g.id),
    codebaseFactIds,
    conflictIds: relevantConflicts.map((c) => c.id),
  };
}
