/**
 * Structured, explainable assessment for Workflow Automation — the first
 * capability to read context.discoveryResult directly instead of matching
 * keywords against the flattened BusinessContext (see
 * docs/architecture/ARCHITECTURE.md "Capability Selection Evolution").
 *
 * Every signal below is either purely structural (array lengths on typed
 * DiscoveryResult entities — no text search at all) or a pattern match
 * scoped to one already-structured field (a DesiredOutcome's description) —
 * never a search across the raw source Markdown. No numeric score is
 * computed anywhere: `status`/`confidence` fall out of how many independent
 * signal *categories* fired, a small fixed rule table below.
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
import type { DesiredOutcome } from "../../discovery/business/desired-outcome.types.js";

export const WORKFLOW_AUTOMATION_CAPABILITY_ID = "workflow-automation";

const OUTCOME_LANGUAGE_PATTERN =
  /automat|synchroniz|self[- ]service|reduce.*manual|less time|faster|notification|reminder/i;

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

function processSignals(processes: BusinessProcess[]): Signal[] {
  const signals: Signal[] = [];

  for (const p of processes) {
    const processRef: EvidenceReference = { entityType: "process", entityId: p.id, description: p.name };

    if (p.automationCandidates.length > 0) {
      signals.push({
        strength: "strong",
        reason: {
          code: "process-automation-candidates",
          description: `Process "${p.name}" already lists ${p.automationCandidates.length} automation candidate(s): ${p.automationCandidates.join(", ")}.`,
          evidenceRefs: [processRef],
        },
      });
    }

    if (p.manualSteps.length > 0) {
      signals.push({
        strength: "strong",
        reason: {
          code: "process-manual-steps",
          description: `Process "${p.name}" has ${p.manualSteps.length} explicitly manual step(s): ${p.manualSteps.join(", ")}.`,
          evidenceRefs: [processRef],
        },
      });
    }

    if (p.systemIds.length >= 2) {
      signals.push({
        strength: "supporting",
        reason: {
          code: "process-multi-system",
          description: `Process "${p.name}" spans ${p.systemIds.length} systems — a common automation/integration trigger.`,
          evidenceRefs: [processRef, ...p.systemIds.map((id): EvidenceReference => ({ entityType: "system", entityId: id }))],
        },
      });
    }

    if (p.actorIds.length >= 2) {
      signals.push({
        strength: "supporting",
        reason: {
          code: "process-human-handoff",
          description: `Process "${p.name}" involves ${p.actorIds.length} actors — a hand-off between people.`,
          evidenceRefs: [processRef, ...p.actorIds.map((id): EvidenceReference => ({ entityType: "actor", entityId: id }))],
        },
      });
    }
  }

  return signals;
}

function requirementSignals(requirements: RequirementItem[]): Signal[] {
  const signals: Signal[] = [];

  for (const r of requirements) {
    if (r.type === "automation") {
      signals.push({
        strength: "strong",
        reason: {
          code: "requirement-type-automation",
          description: `Requirement "${r.description}" is typed "automation".`,
          evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }],
        },
      });
    } else if (r.type === "integration" || r.type === "operational") {
      signals.push({
        strength: "supporting",
        reason: {
          code: "requirement-type-relevant",
          description: `Requirement "${r.description}" is typed "${r.type}".`,
          evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }],
        },
      });
    }
  }

  return signals;
}

function outcomeSignals(outcomes: DesiredOutcome[]): Signal[] {
  return outcomes
    .filter((o) => OUTCOME_LANGUAGE_PATTERN.test(o.description))
    .map((o) => ({
      strength: "supporting" as const,
      reason: {
        code: "outcome-automation-language",
        description: `Desired outcome "${o.description}" requests automation-style behavior.`,
        evidenceRefs: [{ entityType: "outcome", entityId: o.id, description: o.description } satisfies EvidenceReference],
      },
    }));
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessWorkflowAutomation(context: SolutionContext): CapabilityAssessment {
  const discovery = context.discoveryResult;

  const base = {
    capabilityId: WORKFLOW_AUTOMATION_CAPABILITY_ID,
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
    (g) => g.blocking && g.relatedCapabilityIds.includes(WORKFLOW_AUTOMATION_CAPABILITY_ID)
  );

  const signals = [
    ...processSignals(discovery.processes),
    ...requirementSignals(discovery.requirements),
    ...outcomeSignals(discovery.desiredOutcomes),
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
