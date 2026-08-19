/**
 * Pure transformation from CapabilityAssessment[] to SolutionPlan — no I/O,
 * no recomputation of assessment rules (those live in the capability's
 * assessor / legacyKeywordAssessment). The report renderer
 * (framework/reports/render-solution-plan-report.ts) reads this output
 * directly rather than re-deriving decisions itself.
 */

import { makeIdGenerator } from "../../discovery/shared/section-lookup.js";
import type { DiscoveryResult } from "../../discovery/discovery-result.types.js";
import type { CapabilityAssessment } from "./capability-assessment.types.js";
import type { SolutionDecision, SolutionDecisionStatus, SolutionPlan } from "./solution-plan.types.js";

const DECISION_BY_STATUS: Record<CapabilityAssessment["status"], SolutionDecisionStatus> = {
  recommended: "selected",
  "needs-review": "deferred",
  "not-recommended": "not-selected",
  blocked: "blocked",
};

function toDecision(assessment: CapabilityAssessment, nextId: () => string): SolutionDecision {
  const rationale =
    assessment.reasons.length > 0
      ? assessment.reasons.map((r) => r.description)
      : [`No matching evidence found for ${assessment.capabilityId}.`];

  return {
    id: nextId(),
    capabilityId: assessment.capabilityId,
    decision: DECISION_BY_STATUS[assessment.status],
    rationale,
    evidenceRefs: assessment.reasons.flatMap((r) => r.evidenceRefs),
  };
}

export function buildSolutionPlan(
  assessments: CapabilityAssessment[],
  discoveryResult: DiscoveryResult
): SolutionPlan {
  const nextDecisionId = makeIdGenerator("DECISION");
  const decisions = assessments.map((a) => toDecision(a, nextDecisionId));

  const selectedCapabilities = assessments
    .filter((a) => a.status === "recommended" || a.status === "needs-review")
    .map((a) => a.capabilityId);

  const unresolvedGaps = discoveryResult.informationGaps.filter((g) => g.blocking).map((g) => g.id);

  return {
    generatedAt: new Date().toISOString(),
    assessments,
    selectedCapabilities,
    decisions,
    unresolvedGaps,
  };
}
