/**
 * Structured, explainable assessment for Integrations — migrated off
 * legacy keyword matching, same pattern as
 * workflow-automation.assessor.ts. Every signal reads DiscoveryResult
 * directly; text checks are scoped to one already-structured field
 * (a RequirementItem/DesiredOutcome description) and only ever match
 * against real discovered system names — never a fixed keyword list
 * searched across raw Markdown.
 *
 * WorkflowDefinition/WorkflowExternalSystem are NOT available here: the
 * planning stage that calls this runs before any capability executes (see
 * docs/architecture/ARCHITECTURE.md "Integration Architecture" for why).
 * Workflow evidence is used later, at generation time, purely to enrich
 * the already-selected integrations — never to change this decision.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type {
  AssessmentReason,
  CapabilityAssessment,
  AssessmentConfidence,
} from "../../planning/capability-assessment/capability-assessment.types.js";
import type { DiscoveryResult } from "../../discovery/discovery-result.types.js";
import type { BusinessProcess } from "../../discovery/processes/business-process.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { DesiredOutcome } from "../../discovery/business/desired-outcome.types.js";
import type { SystemInventoryItem } from "../../discovery/systems/system-inventory.types.js";
import type { IntegrationNeed } from "../../discovery/integrations/integration-need.types.js";

export const INTEGRATIONS_CAPABILITY_ID = "integrations";

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

function mentionsRealSystem(text: string, systems: SystemInventoryItem[]): SystemInventoryItem | undefined {
  const lower = text.toLowerCase();
  return systems.find((s) => lower.includes(s.name.toLowerCase()));
}

function integrationNeedSignals(needs: IntegrationNeed[]): Signal[] {
  return needs.map((need) => ({
    strength: "strong" as const,
    reason: {
      code: "discovery-integration-need",
      description: `Discovery lists an explicit integration need: "${need.description}".`,
      evidenceRefs: [{ entityType: "integration", entityId: need.id, description: need.description }],
    },
  }));
}

function processSignals(processes: BusinessProcess[]): Signal[] {
  return processes
    .filter((p) => p.systemIds.length >= 2)
    .map((p) => ({
      strength: "supporting" as const,
      reason: {
        code: "process-multi-system",
        description: `Process "${p.name}" spans ${p.systemIds.length} systems — a candidate system boundary.`,
        evidenceRefs: [
          { entityType: "process", entityId: p.id, description: p.name },
          ...p.systemIds.map((id): EvidenceReference => ({ entityType: "system", entityId: id })),
        ],
      },
    }));
}

function requirementSignals(requirements: RequirementItem[], systems: SystemInventoryItem[]): Signal[] {
  const signals: Signal[] = [];
  for (const r of requirements) {
    if (r.type === "integration") {
      signals.push({
        strength: "strong",
        reason: {
          code: "requirement-type-integration",
          description: `Requirement "${r.description}" is typed "integration".`,
          evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }],
        },
      });
    } else if (r.type === "automation") {
      const system = mentionsRealSystem(r.description, systems);
      if (system) {
        signals.push({
          strength: "supporting",
          reason: {
            code: "requirement-references-system",
            description: `Requirement "${r.description}" names a discovered system (${system.name}).`,
            evidenceRefs: [
              { entityType: "requirement", entityId: r.id, description: r.description },
              { entityType: "system", entityId: system.id, description: system.name },
            ],
          },
        });
      }
    }
  }
  return signals;
}

function outcomeSignals(outcomes: DesiredOutcome[], systems: SystemInventoryItem[]): Signal[] {
  const signals: Signal[] = [];
  for (const o of outcomes) {
    const system = mentionsRealSystem(o.description, systems);
    if (system) {
      signals.push({
        strength: "supporting",
        reason: {
          code: "outcome-references-system",
          description: `Desired outcome "${o.description}" names a discovered system (${system.name}).`,
          evidenceRefs: [
            { entityType: "outcome", entityId: o.id, description: o.description },
            { entityType: "system", entityId: system.id, description: system.name },
          ],
        },
      });
    }
  }
  return signals;
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessIntegrations(context: SolutionContext): CapabilityAssessment {
  const discovery: DiscoveryResult | undefined = context.discoveryResult;

  const base = {
    capabilityId: INTEGRATIONS_CAPABILITY_ID,
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
    (g) => g.blocking && g.relatedCapabilityIds.includes(INTEGRATIONS_CAPABILITY_ID)
  );

  const signals = [
    ...integrationNeedSignals(discovery.integrationNeeds),
    ...processSignals(discovery.processes),
    ...requirementSignals(discovery.requirements, discovery.systems),
    ...outcomeSignals(discovery.desiredOutcomes, discovery.systems),
  ];

  const strongSignals = signals.filter((s) => s.strength === "strong");
  const supportingSignals = signals.filter((s) => s.strength === "supporting");
  const signalCategoryCount = new Set(signals.map((s) => s.reason.code)).size;

  const allEvidence = signals.flatMap((s) => s.reason.evidenceRefs);
  const related = {
    relatedProcessIds: dedupeIds(allEvidence, "process"),
    relatedRequirementIds: dedupeIds(allEvidence, "requirement"),
    relatedOutcomeIds: dedupeIds(allEvidence, "outcome"),
    relatedSystemIds: dedupeIds(allEvidence, "system"),
  };

  const blockingGapReasons: AssessmentReason[] = blockingGaps.map((gap) => ({
    code: "blocking-information-gap",
    description: `"${gap.topic}" is an unresolved blocking gap for this capability: ${gap.question}`,
    evidenceRefs: [{ entityType: "information-gap", entityId: gap.id, description: gap.topic }],
  }));

  if (blockingGaps.length > 0) {
    return {
      ...base,
      ...related,
      status: "blocked",
      confidence: "low",
      reasons: [...signals.map((s) => s.reason), ...blockingGapReasons],
      blockingGapIds: blockingGaps.map((g) => g.id),
    };
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
    reasons: signals.map((s) => s.reason),
    blockingGapIds: [],
  };
}
