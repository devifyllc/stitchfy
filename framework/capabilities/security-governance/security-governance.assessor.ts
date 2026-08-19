/**
 * Structured, explainable assessment for Security & Governance — migrated
 * off legacy keyword matching, same pattern as
 * integrations.assessor.ts/workflow-automation.assessor.ts.
 *
 * Like Integrations, this only ever sees DiscoveryResult at planning time
 * (WorkflowDefinition/IntegrationDefinition don't exist until the
 * "capabilities" stage runs) — the richer cross-capability analysis
 * happens later, in execute(), reading sibling capability output. See
 * docs/architecture/ARCHITECTURE.md "Security, Governance and Risk
 * Architecture" for why this doesn't need a new orchestration mechanism.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type {
  AssessmentReason,
  CapabilityAssessment,
  AssessmentConfidence,
} from "../../planning/capability-assessment/capability-assessment.types.js";
import type { DataEntity } from "../../discovery/data/data-entity.types.js";
import type { Constraint } from "../../discovery/constraints/constraint.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { BusinessRule } from "../../discovery/business-rules/business-rule.types.js";
import type { InformationGap } from "../../discovery/gaps/information-gap.types.js";

export const SECURITY_GOVERNANCE_CAPABILITY_ID = "security-governance";

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

function sensitiveDataSignals(dataEntities: DataEntity[]): Signal[] {
  return dataEntities
    .filter((d) => d.sensitive)
    .map((d) => ({
      strength: "strong" as const,
      reason: {
        code: "sensitive-data-entity",
        description: `Data entity "${d.name}" is marked sensitive.`,
        evidenceRefs: [{ entityType: "data-entity", entityId: d.id, description: d.name }],
      },
    }));
}

function taggedGapSignals(gaps: InformationGap[]): Signal[] {
  return gaps
    .filter((g) => g.relatedCapabilityIds.includes(SECURITY_GOVERNANCE_CAPABILITY_ID))
    .map((g) => ({
      strength: "strong" as const,
      reason: {
        code: "security-tagged-gap",
        description: `Discovery flagged an unresolved gap relevant to security/governance: "${g.topic}".`,
        evidenceRefs: [{ entityType: "information-gap", entityId: g.id, description: g.topic }],
      },
    }));
}

function constraintSignals(constraints: Constraint[]): Signal[] {
  return constraints
    .filter((c) => c.type === "security" || c.type === "regulatory" || c.type === "data")
    .map((c) => ({
      strength: "strong" as const,
      reason: {
        code: "security-relevant-constraint",
        description: `Constraint "${c.description}" is typed "${c.type}".`,
        evidenceRefs: [{ entityType: "constraint", entityId: c.id, description: c.description }],
      },
    }));
}

function requirementSignals(requirements: RequirementItem[]): Signal[] {
  return requirements
    .filter((r) => r.type === "security")
    .map((r) => ({
      strength: "strong" as const,
      reason: {
        code: "requirement-type-security",
        description: `Requirement "${r.description}" is typed "security".`,
        evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }],
      },
    }));
}

const GOVERNANCE_LANGUAGE_PATTERN = /\baccess\b|\baudit\b|\bretention\b|\bapprov|\bauthoriz|\bsign[- ]?in\b|\blog[- ]?in\b|\bauthenticat/i;

function businessRuleSignals(rules: BusinessRule[]): Signal[] {
  return rules
    .filter((r) => GOVERNANCE_LANGUAGE_PATTERN.test(r.description))
    .map((r) => ({
      strength: "supporting" as const,
      reason: {
        code: "business-rule-governance-language",
        description: `Business rule "${r.description}" describes access, audit, retention, or approval behavior.`,
        evidenceRefs: [{ entityType: "business-rule", entityId: r.id, description: r.description }],
      },
    }));
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessSecurityGovernance(context: SolutionContext): CapabilityAssessment {
  const discovery = context.discoveryResult;

  const base = {
    capabilityId: SECURITY_GOVERNANCE_CAPABILITY_ID,
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
    (g) => g.blocking && g.relatedCapabilityIds.includes(SECURITY_GOVERNANCE_CAPABILITY_ID)
  );

  const signals = [
    ...sensitiveDataSignals(discovery.dataEntities),
    ...taggedGapSignals(discovery.informationGaps),
    ...constraintSignals(discovery.constraints),
    ...requirementSignals(discovery.requirements),
    ...businessRuleSignals(discovery.businessRules),
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

  // Note: this capability is deliberately NEVER "blocked" by its own
  // blocking-gap check alone — unlike workflow-automation/integrations, its
  // entire purpose is to surface unresolved security-relevant facts, so a
  // blocking gap is exactly the kind of thing it should report ON, not be
  // prevented from reporting because of.
  if (blockingGaps.length > 0) {
    strongSignals.push(
      ...blockingGapReasons.map((reason) => ({ strength: "strong" as const, reason }))
    );
  }

  let status: CapabilityAssessment["status"];
  let confidence: AssessmentConfidence;

  if (strongSignals.length > 0) {
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
