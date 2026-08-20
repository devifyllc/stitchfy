/**
 * One ModernizationWorkstream per non-retained MigrationCandidate. Dates,
 * durations, and sequencing are never fabricated (items 52/53) — sequence/
 * prerequisiteIds stay empty/undefined unless real, explicit sequencing
 * evidence exists (none exists in either target example).
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { MigrationCandidate, ModernizationWorkstream, ModernizationRoadmap, MigrationValidationRequirement } from "../schemas/modernization.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";

export function buildModernizationRoadmap(
  candidates: MigrationCandidate[],
  validationRequirements: MigrationValidationRequirement[],
  informationGaps: InformationGap[],
  nextWorkstreamId: () => string
): ModernizationRoadmap {
  const workstreams: ModernizationWorkstream[] = [];

  for (const candidate of candidates) {
    if (candidate.status === "retain" || candidate.status === "blocked") continue;

    const objective = candidate.status === "candidate" ? `Modernize system "${candidate.systemId}".` : `Assess modernization approach for system "${candidate.systemId}".`;

    const evidenceRefs: EvidenceReference[] = candidate.evidenceRefs;

    workstreams.push({
      id: nextWorkstreamId(),
      name: `Modernization: ${candidate.systemId}`,
      systemIds: [candidate.systemId],
      candidateIds: [candidate.id],
      objective,
      prerequisiteIds: [],
      evidenceRefs,
    });
  }

  const validationRequirementIds = validationRequirements
    .filter((v) => candidates.some((c) => c.status !== "retain" && c.status !== "blocked" && v.preservationRequirementIds.some((id) => c.preservationRequirementIds.includes(id))))
    .map((v) => v.id);

  const hasUnresolvedStrategy = candidates.some((c) => c.status === "needs-review" || c.strategyOptions.some((o) => o.status === "needs-review"));
  const status: ModernizationRoadmap["status"] = workstreams.length === 0 ? "draft" : hasUnresolvedStrategy || informationGaps.length > 0 ? "needs-review" : "complete";

  return {
    candidateIds: candidates.filter((c) => c.status !== "retain" && c.status !== "blocked").map((c) => c.id),
    workstreams,
    dependencies: [],
    validationRequirementIds,
    informationGapIds: informationGaps.map((g) => g.id),
    status,
  };
}
