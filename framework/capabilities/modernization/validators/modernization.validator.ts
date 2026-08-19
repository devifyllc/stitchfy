/**
 * Deterministic validation beyond the Zod shape check — same {ok, issues}
 * pattern as every prior validator. Unknown values are always valid — only
 * missing/incorrect references, unsupported concrete values, and candidates
 * silently promoted from a dependency alone are errors.
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { ModernizationArchitecture } from "../schemas/modernization.types.js";

export interface ModernizationValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ModernizationValidationResult {
  ok: boolean;
  issues: ModernizationValidationIssue[];
}

function checkUniqueIds(ids: string[], label: string): ModernizationValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): ModernizationValidationIssue => ({ code: "duplicate-id", message: `${label} id "${id}" is used ${count} times`, severity: "error" }));
}

export function validateModernizationArchitecture(
  arch: ModernizationArchitecture,
  discovery: DiscoveryResult,
  integrations: IntegrationDefinition[]
): ModernizationValidationResult {
  const issues: ModernizationValidationIssue[] = [];

  const systemIds = new Set(discovery.systems.map((s) => s.id));
  const integrationIds = new Set(integrations.map((i) => i.id));
  const modernizationNeedIds = new Set(discovery.modernizationNeeds.map((n) => n.id));
  const inScopeSystemIds = new Set(discovery.modernizationNeeds.flatMap((n) => n.systemIds));
  const constraintIds = new Set(discovery.constraints.map((c) => c.id));

  const dependencyIds = new Set(arch.dependencies.map((d) => d.id));
  const preservationIds = new Set(arch.preservationRequirements.map((p) => p.id));
  const candidateIds = new Set(arch.migrationCandidates.map((c) => c.id));
  const workstreamIds = new Set(arch.roadmap.workstreams.map((w) => w.id));
  const validationRequirementIds = new Set(arch.validationRequirements.map((v) => v.id));

  issues.push(...checkUniqueIds(arch.profiles.map((p) => p.id), "SystemModernizationProfile"));
  issues.push(...checkUniqueIds(arch.dependencies.map((d) => d.id), "SystemDependency"));
  issues.push(...checkUniqueIds(arch.technicalDebt.map((t) => t.id), "TechnicalDebtItem"));
  issues.push(...checkUniqueIds(arch.preservationRequirements.map((p) => p.id), "PreservationRequirement"));
  issues.push(...checkUniqueIds(arch.migrationCandidates.map((c) => c.id), "MigrationCandidate"));

  // Referential integrity — systems.
  for (const profile of arch.profiles) {
    if (!systemIds.has(profile.systemId)) issues.push({ code: "unknown-system", message: `SystemModernizationProfile "${profile.id}" references unknown system "${profile.systemId}"`, severity: "error" });
    for (const needId of profile.modernizationNeedIds) {
      if (!modernizationNeedIds.has(needId)) issues.push({ code: "unknown-modernization-need", message: `SystemModernizationProfile "${profile.id}" references unknown modernization need "${needId}"`, severity: "error" });
    }
  }
  for (const dep of arch.dependencies) {
    if (!systemIds.has(dep.sourceSystemId)) issues.push({ code: "unknown-system", message: `SystemDependency "${dep.id}" references unknown source system "${dep.sourceSystemId}"`, severity: "error" });
    if (!systemIds.has(dep.targetSystemId)) issues.push({ code: "unknown-system", message: `SystemDependency "${dep.id}" references unknown target system "${dep.targetSystemId}"`, severity: "error" });
    if (dep.sourceSystemId === dep.targetSystemId) issues.push({ code: "self-dependency", message: `SystemDependency "${dep.id}" has identical source and target "${dep.sourceSystemId}"`, severity: "error" });
    if (dep.integrationId && !integrationIds.has(dep.integrationId)) issues.push({ code: "unknown-integration", message: `SystemDependency "${dep.id}" references unknown integration "${dep.integrationId}"`, severity: "error" });
  }
  for (const debt of arch.technicalDebt) {
    if (!systemIds.has(debt.systemId)) issues.push({ code: "unknown-system", message: `TechnicalDebtItem "${debt.id}" references unknown system "${debt.systemId}"`, severity: "error" });
    if (debt.evidenceRefs.length === 0) issues.push({ code: "no-evidence", message: `TechnicalDebtItem "${debt.id}" has no evidence references`, severity: "error" });
  }
  for (const p of arch.preservationRequirements) {
    if (!systemIds.has(p.systemId)) issues.push({ code: "unknown-system", message: `PreservationRequirement "${p.id}" references unknown system "${p.systemId}"`, severity: "error" });
  }

  // Candidate scope — task item 66: never silently promoted from a dependency alone.
  for (const candidate of arch.migrationCandidates) {
    if (!inScopeSystemIds.has(candidate.systemId)) {
      issues.push({ code: "out-of-scope-candidate", message: `MigrationCandidate "${candidate.id}" references system "${candidate.systemId}" not named in any ModernizationNeed`, severity: "error" });
    }
    for (const option of candidate.strategyOptions) {
      if (option.status === "explicit" && option.evidenceRefs.length === 0) {
        issues.push({ code: "unsupported-strategy", message: `MigrationCandidate "${candidate.id}" has an explicit strategy "${option.strategy}" with no supporting evidence`, severity: "error" });
      }
      for (const prereqId of option.prerequisiteIds) {
        if (!candidateIds.has(prereqId)) issues.push({ code: "unknown-prerequisite", message: `MigrationCandidate "${candidate.id}" references unknown prerequisite candidate "${prereqId}"`, severity: "error" });
      }
    }
    for (const depId of candidate.dependencyIds) {
      if (!dependencyIds.has(depId)) issues.push({ code: "unknown-dependency", message: `MigrationCandidate "${candidate.id}" references unknown dependency "${depId}"`, severity: "error" });
    }
    for (const presId of candidate.preservationRequirementIds) {
      if (!preservationIds.has(presId)) issues.push({ code: "unknown-preservation", message: `MigrationCandidate "${candidate.id}" references unknown preservation requirement "${presId}"`, severity: "error" });
    }
  }

  // Target-state / lifecycle provenance.
  for (const t of arch.targetStateRequirements) {
    if (t.explicit && t.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-target-technology", message: `TargetStateRequirement "${t.id}" is marked explicit with no supporting evidence`, severity: "error" });
    }
  }
  for (const profile of arch.profiles) {
    if (profile.lifecycleStatus !== "unknown" && profile.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-lifecycle", message: `SystemModernizationProfile "${profile.id}" declares lifecycle status "${profile.lifecycleStatus}" with no supporting evidence`, severity: "error" });
    }
  }

  // Constraint cross-reference.
  for (const c of arch.migrationConstraints) {
    if (c.relatedConstraintId && !constraintIds.has(c.relatedConstraintId)) {
      issues.push({ code: "unknown-constraint", message: `MigrationConstraint "${c.id}" references unknown constraint "${c.relatedConstraintId}"`, severity: "error" });
    }
  }

  // Validation requirements.
  for (const v of arch.validationRequirements) {
    for (const presId of v.preservationRequirementIds) {
      if (!preservationIds.has(presId)) issues.push({ code: "unknown-preservation", message: `MigrationValidationRequirement "${v.id}" references unknown preservation requirement "${presId}"`, severity: "error" });
    }
  }

  // Risks — RiskAssessmentSchema already requires evidenceRefs.length >= 1; verify category.
  for (const r of arch.risks) {
    if (r.category !== "modernization") issues.push({ code: "unexpected-risk-category", message: `Modernization risk "${r.id}" has category "${r.category}", expected "modernization"`, severity: "error" });
  }

  // Roadmap.
  for (const w of arch.roadmap.workstreams) {
    for (const candId of w.candidateIds) {
      if (!candidateIds.has(candId)) issues.push({ code: "unknown-candidate", message: `ModernizationWorkstream "${w.id}" references unknown candidate "${candId}"`, severity: "error" });
    }
    for (const prereqId of w.prerequisiteIds) {
      if (!workstreamIds.has(prereqId)) issues.push({ code: "unknown-prerequisite-workstream", message: `ModernizationWorkstream "${w.id}" references unknown prerequisite workstream "${prereqId}"`, severity: "error" });
    }
  }
  for (const d of arch.roadmap.dependencies) {
    if (!workstreamIds.has(d.fromWorkstreamId) || !workstreamIds.has(d.toWorkstreamId)) {
      issues.push({ code: "unknown-workstream", message: `RoadmapDependency "${d.id}" references an unknown workstream`, severity: "error" });
    }
  }
  for (const id of arch.roadmap.validationRequirementIds) {
    if (!validationRequirementIds.has(id)) issues.push({ code: "unknown-validation-requirement", message: `ModernizationRoadmap references unknown validation requirement "${id}"`, severity: "error" });
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
