/**
 * Structured, explainable assessment for Observability — replaces the
 * Phase 0 keyword list (monitor/logging/alert/dashboard/uptime/trace/
 * metrics). Only ever sees DiscoveryResult (assessment runs in the
 * "planning" stage, before any capability executes — same constraint every
 * assessor has). The richer, architecture-derived analysis
 * (WorkflowDefinition[]/IntegrationDefinition[]/AIAgentDefinition[]/
 * SecurityArchitecture) happens later, in execute(), reading sibling
 * capability output — see docs/architecture/ARCHITECTURE.md "Observability
 * and Operational Architecture".
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type {
  AssessmentReason,
  CapabilityAssessment,
  AssessmentConfidence,
} from "../../planning/capability-assessment/capability-assessment.types.js";
import type { BusinessProcess } from "../../discovery/processes/business-process.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { Constraint } from "../../discovery/constraints/constraint.types.js";
import type { BusinessRule } from "../../discovery/business-rules/business-rule.types.js";
import type { IntegrationNeed } from "../../discovery/integrations/integration-need.types.js";
import type { AIAgentNeed } from "../../discovery/ai-agents/ai-agent-need.types.js";

export const OBSERVABILITY_CAPABILITY_ID = "observability";

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

/** Real business processes with ≥2 steps are a structural proxy for "there will be a WorkflowDefinition worth observing" — the actual WorkflowDefinition[] doesn't exist yet at planning time. */
function processSignals(processes: BusinessProcess[]): Signal[] {
  return processes
    .filter((p) => p.steps.length >= 2)
    .map((p) => ({
      strength: "supporting" as const,
      reason: {
        code: "multi-step-process",
        description: `Business process "${p.name}" has ${p.steps.length} steps — likely to produce workflow operational visibility needs.`,
        evidenceRefs: [{ entityType: "process", entityId: p.id, description: p.name }],
      },
    }));
}

function integrationSignals(needs: IntegrationNeed[]): Signal[] {
  return needs.map((n) => ({
    strength: "supporting" as const,
    reason: {
      code: "integration-need",
      description: `Integration need "${n.description}" is likely to produce an external-boundary operation worth observing.`,
      evidenceRefs: [{ entityType: "integration", entityId: n.id, description: n.description }],
    },
  }));
}

function aiAgentSignals(needs: AIAgentNeed[]): Signal[] {
  return needs.map((n) => ({
    strength: "supporting" as const,
    reason: {
      code: "ai-agent-need",
      description: `AI Agent Need "${n.id}" is likely to produce agent/tool operational visibility needs.`,
      evidenceRefs: [{ entityType: "ai-agent-need", entityId: n.id, description: n.purpose }],
    },
  }));
}

const OPERATIONAL_TERMINOLOGY_PATTERN =
  /\bmonitor|\boperational visibilit|\bresponse time|\berror detection|\bavailabilit|\balert|\baudit|\btraceab|\bservice.?level|\bSLO\b|\bSLA\b|\bdashboard|\blatenc|\buptime/i;

function explicitOperationalSignals(
  requirements: RequirementItem[],
  constraints: Constraint[],
  businessRules: BusinessRule[]
): Signal[] {
  const signals: Signal[] = [];

  for (const r of requirements) {
    if (!OPERATIONAL_TERMINOLOGY_PATTERN.test(r.description)) continue;
    signals.push({
      strength: "strong",
      reason: {
        code: "explicit-operational-requirement",
        description: `Requirement "${r.description}" describes an explicit operational concern.`,
        evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }],
      },
    });
  }
  for (const c of constraints) {
    if (!OPERATIONAL_TERMINOLOGY_PATTERN.test(c.description)) continue;
    signals.push({
      strength: "strong",
      reason: {
        code: "explicit-operational-constraint",
        description: `Constraint "${c.description}" describes an explicit operational concern.`,
        evidenceRefs: [{ entityType: "constraint", entityId: c.id, description: c.description }],
      },
    });
  }
  for (const b of businessRules) {
    if (!OPERATIONAL_TERMINOLOGY_PATTERN.test(b.description)) continue;
    signals.push({
      strength: "strong",
      reason: {
        code: "explicit-operational-business-rule",
        description: `Business rule "${b.description}" describes an explicit operational concern.`,
        evidenceRefs: [{ entityType: "business-rule", entityId: b.id, description: b.description }],
      },
    });
  }

  return signals;
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessObservability(context: SolutionContext): CapabilityAssessment {
  const discovery = context.discoveryResult;

  const base = {
    capabilityId: OBSERVABILITY_CAPABILITY_ID,
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

  const blockingGaps = discovery.informationGaps.filter(
    (g) => g.blocking && g.relatedCapabilityIds.includes(OBSERVABILITY_CAPABILITY_ID)
  );

  const signals = [
    ...explicitOperationalSignals(discovery.requirements, discovery.constraints, discovery.businessRules),
    ...processSignals(discovery.processes),
    ...integrationSignals(discovery.integrationNeeds),
    ...aiAgentSignals(discovery.aiAgentNeeds),
  ];

  const strongSignals = signals.filter((s) => s.strength === "strong");
  const supportingSignals = signals.filter((s) => s.strength === "supporting");
  const signalCategoryCount = new Set(signals.map((s) => s.reason.code)).size;

  const allEvidence = signals.flatMap((s) => s.reason.evidenceRefs);
  const related = {
    relatedProcessIds: dedupeIds(allEvidence, "process"),
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
    status = "recommended";
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
