/**
 * Structured, explainable assessment for Cloud Architecture — replaces the
 * Phase 0 keyword list (cloud/aws/azure/gcp/scal/deploy/infrastructure).
 * Only ever sees DiscoveryResult (assessment runs in the "planning" stage,
 * before any capability executes — same constraint every assessor has).
 *
 * Deliberately excludes "multi-step business process" and "integration
 * need" as signals — a process performed by a human, or an integration to
 * an external SaaS system, is evidence that a human or a third party owns
 * the runtime work, never that the SOLUTION owns it (task item 58: none of
 * appointment-business.md/invoice-approval.md/api-integration.md should
 * select Cloud "merely because" a workflow/integration exists). An
 * AIAgentNeed is treated differently: an agent's tools/permissions/
 * autonomy are active software logic the solution itself would need to
 * host, even before anything is known about where model inference runs —
 * see docs/architecture/ARCHITECTURE.md "Vendor-Neutral Cloud and
 * Deployment Architecture" for the full reasoning.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type {
  AssessmentReason,
  CapabilityAssessment,
  AssessmentConfidence,
} from "../../planning/capability-assessment/capability-assessment.types.js";
import type { DeploymentNeed } from "../../discovery/cloud/deployment-need.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { Constraint } from "../../discovery/constraints/constraint.types.js";
import type { BusinessRule } from "../../discovery/business-rules/business-rule.types.js";
import type { AIAgentNeed } from "../../discovery/ai-agents/ai-agent-need.types.js";

export const CLOUD_CAPABILITY_ID = "cloud";

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

function deploymentNeedSignals(needs: DeploymentNeed[]): Signal[] {
  return needs.map((n) => ({
    strength: "strong" as const,
    reason: {
      code: "deployment-need",
      description: `Deployment need "${n.id}" (${n.category}): "${n.description}".`,
      evidenceRefs: [{ entityType: "deployment-need", entityId: n.id, description: n.description }],
    },
  }));
}

const OPERATIONAL_TERMINOLOGY_PATTERN =
  /\bdeploy|\bhost(ed|ing)?\b|\benvironment\b|\bscal|\bresilien|\bavailab|\bpersist|\bruntime\b|\binfrastructure\b/i;

function explicitOperationalSignals(requirements: RequirementItem[], constraints: Constraint[], businessRules: BusinessRule[]): Signal[] {
  const signals: Signal[] = [];

  for (const r of requirements) {
    if (!OPERATIONAL_TERMINOLOGY_PATTERN.test(r.description)) continue;
    signals.push({
      strength: "strong",
      reason: { code: "explicit-operational-requirement", description: `Requirement "${r.description}" describes an explicit deployment/operational concern.`, evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }] },
    });
  }
  for (const c of constraints) {
    if (!OPERATIONAL_TERMINOLOGY_PATTERN.test(c.description)) continue;
    signals.push({
      strength: "strong",
      reason: { code: "explicit-operational-constraint", description: `Constraint "${c.description}" describes an explicit deployment/operational concern.`, evidenceRefs: [{ entityType: "constraint", entityId: c.id, description: c.description }] },
    });
  }
  for (const b of businessRules) {
    if (!OPERATIONAL_TERMINOLOGY_PATTERN.test(b.description)) continue;
    signals.push({
      strength: "strong",
      reason: { code: "explicit-operational-business-rule", description: `Business rule "${b.description}" describes an explicit deployment/operational concern.`, evidenceRefs: [{ entityType: "business-rule", entityId: b.id, description: b.description }] },
    });
  }

  return signals;
}

function aiAgentSignals(needs: AIAgentNeed[]): Signal[] {
  return needs.map((n) => ({
    strength: "supporting" as const,
    reason: {
      code: "ai-agent-owns-runtime-execution",
      description: `AI Agent Need "${n.id}" implies solution-owned orchestration logic that requires a runtime, even though where it runs is not yet known.`,
      evidenceRefs: [{ entityType: "ai-agent-need", entityId: n.id, description: n.purpose }],
    },
  }));
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessCloud(context: SolutionContext): CapabilityAssessment {
  const discovery = context.discoveryResult;

  const base = {
    capabilityId: CLOUD_CAPABILITY_ID,
    relatedProcessIds: [] as string[],
    relatedRequirementIds: [] as string[],
    relatedOutcomeIds: [] as string[],
    relatedSystemIds: [] as string[],
    relatedConstraintIds: [] as string[],
    method: "structured" as const,
  };

  if (!discovery) {
    return { ...base, status: "not-recommended", confidence: "high", reasons: [], blockingGapIds: [] };
  }

  const blockingGaps = discovery.informationGaps.filter((g) => g.blocking && g.relatedCapabilityIds.includes(CLOUD_CAPABILITY_ID));

  const signals = [
    ...deploymentNeedSignals(discovery.deploymentNeeds),
    ...explicitOperationalSignals(discovery.requirements, discovery.constraints, discovery.businessRules),
    ...aiAgentSignals(discovery.aiAgentNeeds),
  ];

  const strongSignals = signals.filter((s) => s.strength === "strong");
  const supportingSignals = signals.filter((s) => s.strength === "supporting");
  const signalCategoryCount = new Set(signals.map((s) => s.reason.code)).size;

  const allEvidence = signals.flatMap((s) => s.reason.evidenceRefs);
  const related = {
    relatedRequirementIds: dedupeIds(allEvidence, "requirement"),
    relatedConstraintIds: dedupeIds(allEvidence, "constraint"),
  };

  const blockingGapReasons: AssessmentReason[] = blockingGaps.map((gap) => ({
    code: "blocking-information-gap",
    description: `"${gap.topic}" is an unresolved blocking gap for this capability: ${gap.question}`,
    evidenceRefs: [{ entityType: "information-gap", entityId: gap.id, description: gap.topic }],
  }));

  let status: CapabilityAssessment["status"];
  let confidence: AssessmentConfidence;

  if (blockingGaps.length > 0) {
    status = "blocked";
    confidence = "high";
  } else if (strongSignals.length > 0) {
    status = "recommended";
    confidence = signalCategoryCount >= 2 ? "high" : "medium";
  } else if (supportingSignals.length >= 2) {
    status = "needs-review";
    confidence = "medium";
  } else if (supportingSignals.length === 1) {
    status = "needs-review";
    confidence = "low";
  } else {
    status = "not-recommended";
    confidence = "high";
  }

  return {
    ...base,
    ...related,
    status,
    confidence,
    reasons: [...signals.map((s) => s.reason), ...blockingGapReasons],
    blockingGapIds: blockingGaps.map((g) => g.id),
  };
}
