/**
 * Structured, explainable assessment for Legacy Modernization — replaces
 * the Phase 0 keyword list (legacy/migrate/migration/modernize/modernise/
 * end of life/outdated system). Only ever sees DiscoveryResult (assessment
 * runs in the "planning" stage, before any capability executes).
 *
 * Signals: `modernizationNeeds.length > 0` and explicit modernization/
 * migration terminology in already-structured requirement/constraint/
 * business-rule text are STRONG. A `SystemInventoryItem` explicitly
 * classified `category: "legacy"` is a SUPPORTING signal only (task item
 * 64) — it alone reaches `needs-review` at low confidence, never
 * `recommended`, and never selects a specific migration strategy by
 * itself. Deliberately no scan for "Java"/"database"/"API"/"monolith"/
 * "WebSphere" alone — those only matter when they co-occur with real
 * modernization intent (a dedicated section or explicit terminology).
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { AssessmentReason, CapabilityAssessment, AssessmentConfidence } from "../../planning/capability-assessment/capability-assessment.types.js";
import type { ModernizationNeed } from "../../discovery/modernization/modernization-need.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { Constraint } from "../../discovery/constraints/constraint.types.js";
import type { BusinessRule } from "../../discovery/business-rules/business-rule.types.js";
import type { SystemInventoryItem } from "../../discovery/systems/system-inventory.types.js";

export const MODERNIZATION_CAPABILITY_ID = "modernization";

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

function modernizationNeedSignals(needs: ModernizationNeed[]): Signal[] {
  return needs.map((n) => ({
    strength: "strong" as const,
    reason: {
      code: "modernization-need",
      description: `Modernization need "${n.id}" identifies ${n.systemIds.length} system(s) with ${n.desiredOutcomes.length} stated outcome(s).`,
      evidenceRefs: [{ entityType: "modernization-need", entityId: n.id, description: n.desiredOutcomes[0] ?? n.preservationNeeds[0] ?? "" }],
    },
  }));
}

const MODERNIZATION_TERMINOLOGY_PATTERN =
  /\bmoderniz|\bmigrat|\breplatform|\brearchitect|\brefactor|\brehost|\bdecommission|\bretire\b|\bend.of.life\b|\btechnical debt\b/i;

function explicitTerminologySignals(requirements: RequirementItem[], constraints: Constraint[], businessRules: BusinessRule[]): Signal[] {
  const signals: Signal[] = [];

  for (const r of requirements) {
    if (!MODERNIZATION_TERMINOLOGY_PATTERN.test(r.description)) continue;
    signals.push({
      strength: "strong",
      reason: { code: "explicit-modernization-requirement", description: `Requirement "${r.description}" describes an explicit modernization/migration concern.`, evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }] },
    });
  }
  for (const c of constraints) {
    if (!MODERNIZATION_TERMINOLOGY_PATTERN.test(c.description)) continue;
    signals.push({
      strength: "strong",
      reason: { code: "explicit-modernization-constraint", description: `Constraint "${c.description}" describes an explicit modernization/migration concern.`, evidenceRefs: [{ entityType: "constraint", entityId: c.id, description: c.description }] },
    });
  }
  for (const b of businessRules) {
    if (!MODERNIZATION_TERMINOLOGY_PATTERN.test(b.description)) continue;
    signals.push({
      strength: "strong",
      reason: { code: "explicit-modernization-business-rule", description: `Business rule "${b.description}" describes an explicit modernization/migration concern.`, evidenceRefs: [{ entityType: "business-rule", entityId: b.id, description: b.description }] },
    });
  }

  return signals;
}

function legacySystemSignals(systems: SystemInventoryItem[]): Signal[] {
  return systems
    .filter((s) => s.category === "legacy")
    .map((s) => ({
      strength: "supporting" as const,
      reason: {
        code: "legacy-classified-system",
        description: `System "${s.id}" is explicitly classified "legacy" — a supporting signal only; it does not by itself select a migration strategy.`,
        evidenceRefs: [{ entityType: "system", entityId: s.id, description: s.name }],
      },
    }));
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessModernization(context: SolutionContext): CapabilityAssessment {
  const discovery = context.discoveryResult;

  const base = {
    capabilityId: MODERNIZATION_CAPABILITY_ID,
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

  const blockingGaps = discovery.informationGaps.filter((g) => g.blocking && g.relatedCapabilityIds.includes(MODERNIZATION_CAPABILITY_ID));

  const signals = [
    ...modernizationNeedSignals(discovery.modernizationNeeds),
    ...explicitTerminologySignals(discovery.requirements, discovery.constraints, discovery.businessRules),
    ...legacySystemSignals(discovery.systems),
  ];

  const strongSignals = signals.filter((s) => s.strength === "strong");
  const supportingSignals = signals.filter((s) => s.strength === "supporting");
  const signalCategoryCount = new Set(signals.map((s) => s.reason.code)).size;

  const allEvidence = signals.flatMap((s) => s.reason.evidenceRefs);
  const related = {
    relatedRequirementIds: dedupeIds(allEvidence, "requirement"),
    relatedConstraintIds: dedupeIds(allEvidence, "constraint"),
    relatedSystemIds: dedupeIds(allEvidence, "system"),
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
