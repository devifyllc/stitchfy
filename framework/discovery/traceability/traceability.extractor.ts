/**
 * Builds links only from relation IDs already stored on typed discovery
 * objects — no fuzzy/semantic matching, so every link is explainable back
 * to an explicit field. This instantiates the traceability chain from the
 * Phase 1 task (Source → Goal/PainPoint → Requirement → Process →
 * Capability → Decision/Artifact) for the Requirement/Process links; the
 * Capability/Decision end of the chain is populated later by
 * solution-orchestrator.ts (SolutionBlueprint.capabilities), not here.
 *
 * Phase 1.5: RequirementItem.relatedOutcomeIds (populated deterministically
 * by requirements.extractor.ts for derived requirements) now produces a
 * "derived-from" link back to the DesiredOutcome that produced it.
 */

import type { RequirementItem } from "../requirements/requirement.types.js";
import type { BusinessProcess } from "../processes/business-process.types.js";
import type { TraceabilityLink } from "./traceability.types.js";

export function extractTraceabilityLinks(
  requirements: RequirementItem[],
  processes: BusinessProcess[]
): TraceabilityLink[] {
  const links: TraceabilityLink[] = [];

  for (const req of requirements) {
    for (const goalId of req.relatedGoalIds) {
      links.push({ fromId: req.id, toId: goalId, relationship: "addresses" });
    }
    for (const painPointId of req.relatedPainPointIds) {
      links.push({ fromId: req.id, toId: painPointId, relationship: "addresses" });
    }
    for (const processId of req.relatedProcessIds) {
      links.push({ fromId: req.id, toId: processId, relationship: "depends-on" });
    }
    for (const outcomeId of req.relatedOutcomeIds) {
      links.push({ fromId: req.id, toId: outcomeId, relationship: "derived-from" });
    }
  }

  for (const process of processes) {
    for (const actorId of process.actorIds) {
      links.push({ fromId: process.id, toId: actorId, relationship: "performed-by" });
    }
    for (const systemId of process.systemIds) {
      links.push({ fromId: process.id, toId: systemId, relationship: "uses-system" });
    }
    for (const painPointId of process.painPointIds) {
      links.push({ fromId: process.id, toId: painPointId, relationship: "affects" });
    }
    for (const ruleId of process.businessRuleIds) {
      links.push({ fromId: process.id, toId: ruleId, relationship: "constrained-by" });
    }
  }

  return links;
}
