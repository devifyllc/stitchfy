/**
 * Builds the real, structured WorkflowAutomationPlan (task item 8) from
 * DiscoveryResult + the assessment already computed by
 * workflow-automation.assessor.ts — no external system is contacted, this
 * is an architectural plan only (AutomationCandidate/HumanTouchpoint only
 * ever cite DiscoveryResult entities).
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import type { DiscoveryResult } from "../../discovery/discovery-result.types.js";
import type { BusinessActor } from "../../discovery/actors/business-actor.types.js";
import { createApprovalRequest } from "../../governance/approvals/human-approval.types.js";
import { makeIdGenerator } from "../../discovery/shared/section-lookup.js";
import type { AutomationCandidate, HumanTouchpoint, WorkflowAutomationPlan } from "./schemas/workflow-automation.types.js";
import { WORKFLOW_AUTOMATION_CAPABILITY_ID } from "./workflow-automation.assessor.js";

// Human-in-the-loop language (task item 9): conflict resolution, ambiguous
// info, approval steps, exception handling. Scoped to already-structured
// DesiredOutcome/RequirementItem descriptions, not raw Markdown.
const APPROVAL_PATTERN = /approv|manual review|human (review|approval|control)|escalat|exception/i;

function findApproverRole(text: string, actors: BusinessActor[]): string {
  const lower = text.toLowerCase();
  const match = actors.find((a) => a.role && lower.includes(a.role.toLowerCase()));
  return match ? match.role : "designated approver";
}

function buildHumanTouchpoints(discovery: DiscoveryResult, nextId: () => string): HumanTouchpoint[] {
  const touchpoints: HumanTouchpoint[] = [];

  for (const outcome of discovery.desiredOutcomes) {
    if (!APPROVAL_PATTERN.test(outcome.description)) continue;
    touchpoints.push({
      id: nextId(),
      trigger: outcome.description,
      reason: `Desired outcome "${outcome.description}" explicitly requires human oversight — preserved rather than automated away.`,
      approval: createApprovalRequest({
        approverRole: findApproverRole(outcome.description, discovery.actors),
        reason: outcome.description,
        riskLevel: "medium",
      }),
      evidenceRefs: [{ entityType: "outcome", entityId: outcome.id, description: outcome.description }],
    });
  }

  for (const req of discovery.requirements) {
    if (!APPROVAL_PATTERN.test(req.description)) continue;
    touchpoints.push({
      id: nextId(),
      trigger: req.description,
      reason: `Requirement "${req.description}" explicitly requires human oversight — preserved rather than automated away.`,
      approval: createApprovalRequest({
        approverRole: findApproverRole(req.description, discovery.actors),
        reason: req.description,
        riskLevel: "medium",
      }),
      evidenceRefs: [{ entityType: "requirement", entityId: req.id, description: req.description }],
    });
  }

  return touchpoints;
}

function emptyPlan(): WorkflowAutomationPlan {
  return {
    processIds: [],
    requirementIds: [],
    systemIds: [],
    automationCandidates: [],
    humanTouchpoints: [],
    integrationNeeds: [],
    informationGaps: [],
    assumptions: [],
  };
}

export function buildWorkflowAutomationPlan(
  context: SolutionContext,
  assessment: CapabilityAssessment
): WorkflowAutomationPlan {
  const discovery = context.discoveryResult;
  if (!discovery) return emptyPlan();

  const nextTouchpointId = makeIdGenerator("TOUCHPOINT");

  const relevantProcesses = discovery.processes.filter((p) => assessment.relatedProcessIds.includes(p.id));
  const automationCandidates: AutomationCandidate[] = relevantProcesses.flatMap((p) =>
    p.automationCandidates.map(
      (description): AutomationCandidate => ({
        description,
        processId: p.id,
        evidenceRefs: [{ entityType: "process", entityId: p.id, description: p.name } satisfies EvidenceReference],
      })
    )
  );

  const integrationNeeds = discovery.integrationNeeds
    .filter((need) => need.relatedSystemIds.some((id) => assessment.relatedSystemIds.includes(id)))
    .map((need) => need.description);

  const informationGaps = discovery.informationGaps
    .filter((gap) => gap.relatedCapabilityIds.includes(WORKFLOW_AUTOMATION_CAPABILITY_ID))
    .map((gap) => gap.id);

  return {
    processIds: assessment.relatedProcessIds,
    requirementIds: assessment.relatedRequirementIds,
    systemIds: assessment.relatedSystemIds,
    automationCandidates,
    humanTouchpoints: buildHumanTouchpoints(discovery, nextTouchpointId),
    integrationNeeds,
    informationGaps,
    assumptions: [
      "Architectural plan only — no external system (e.g. calendar, messaging, SaaS API) is actually integrated in this phase.",
      "Requirement↔process correlation beyond explicit shared ids is not attempted (no fuzzy matching) — see docs/architecture/ARCHITECTURE.md Phase 1.5.",
    ],
  };
}
