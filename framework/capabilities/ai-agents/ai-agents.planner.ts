/**
 * AIAgentPlan — one AIAgentCandidate per AIAgentNeed (task item 26's
 * default: "one coherent need → one agent"). No multi-agent splitting is
 * implemented here — separating a need into multiple agents would require
 * judgment (distinct actors/conflicting permissions/trust boundaries) with
 * no evidenced example to validate against in this phase; deferred and
 * documented rather than half-built (see ARCHITECTURE.md "AI Agent
 * Architecture").
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { makeIdGenerator } from "../../discovery/shared/section-lookup.js";
import type { AIAgentNeed } from "../../discovery/ai-agents/ai-agent-need.types.js";
import type { AIAgentPlan, AIAgentCandidate } from "./schemas/ai-agents.types.js";

/**
 * Deterministic name derivation — nothing in Discovery names the agent
 * explicitly, so the name is built from real facts only (business name +
 * the need's own dominant capability), never invented prose.
 */
function deriveAgentName(businessName: string, need: AIAgentNeed): string {
  if (need.desiredCapabilities.includes("conversation")) return `${businessName} Assistant`;
  return `${businessName} AI Agent`;
}

export function buildAIAgentPlan(context: SolutionContext, assessment: CapabilityAssessment): AIAgentPlan {
  const discovery = context.discoveryResult;

  if (!discovery || (assessment.status !== "recommended" && assessment.status !== "needs-review")) {
    return {
      needIds: [],
      processIds: [],
      workflowIds: [],
      integrationIds: [],
      requirementIds: [],
      agentCandidates: [],
      informationGaps: assessment.blockingGapIds,
      assumptions: [],
    };
  }

  const nextId = makeIdGenerator("AIAGENTCAND");

  const agentCandidates: AIAgentCandidate[] = discovery.aiAgentNeeds.map((need) => ({
    id: nextId(),
    needId: need.id,
    name: deriveAgentName(discovery.businessName, need),
    evidenceRefs: [{ entityType: "ai-agent-need", entityId: need.id, description: need.purpose }],
  }));

  return {
    needIds: discovery.aiAgentNeeds.map((n) => n.id),
    processIds: [...new Set(discovery.aiAgentNeeds.flatMap((n) => n.relatedProcessIds))],
    workflowIds: [],
    integrationIds: [],
    requirementIds: assessment.relatedRequirementIds,
    agentCandidates,
    informationGaps: assessment.blockingGapIds,
    assumptions:
      agentCandidates.length > 0
        ? ["One AI Agent is planned per distinct AI Agent Need — no automatic multi-agent splitting."]
        : [],
  };
}
