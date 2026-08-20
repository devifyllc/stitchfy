/**
 * Structured, explainable assessment for AI Agents — replaces the Phase 0
 * keyword list (chatbot/assistant/copilot/...). Only ever sees
 * DiscoveryResult (assessment runs in the "planning" stage, before any
 * capability executes — same constraint every assessor has).
 *
 * Deliberately does NOT signal from manual steps, automation candidates, or
 * multi-system processes alone (task item 5) — those are Workflow
 * Automation's own signals and must not leak into this one. The primary
 * signal is a real AIAgentNeed, captured only from a dedicated "AI Agent
 * Needs" section — see framework/discovery/ai-agents/ai-agent-needs.extractor.ts.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type {
  AssessmentReason,
  CapabilityAssessment,
  AssessmentConfidence,
} from "../../planning/capability-assessment/capability-assessment.types.js";
import type { AIAgentNeed } from "../../discovery/ai-agents/ai-agent-need.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { DesiredOutcome } from "../../discovery/business/desired-outcome.types.js";

export const AI_AGENTS_CAPABILITY_ID = "ai-agents";

interface Signal {
  reason: AssessmentReason;
  strength: "strong" | "supporting";
}

function needSignals(needs: AIAgentNeed[]): Signal[] {
  return needs.map((need) => ({
    strength: "strong" as const,
    reason: {
      code: "ai-agent-need",
      description: `AI Agent Need "${need.id}" describes ${need.tasks.length} explicit task(s): "${need.purpose}".`,
      evidenceRefs: [{ entityType: "ai-agent-need", entityId: need.id, description: need.purpose }],
    },
  }));
}

function requirementSignals(requirements: RequirementItem[]): Signal[] {
  return requirements
    .filter((r) => r.type === "ai")
    .map((r) => ({
      strength: "strong" as const,
      reason: {
        code: "requirement-type-ai",
        description: `Requirement "${r.description}" is typed "ai".`,
        evidenceRefs: [{ entityType: "requirement", entityId: r.id, description: r.description }],
      },
    }));
}

const AI_TERMINOLOGY_PATTERN = /\bai\b|artificial intelligence|\bchatbot\b|\bassistant\b|\bllm\b|large language model|generative ai/i;

function outcomeSignals(outcomes: DesiredOutcome[]): Signal[] {
  return outcomes
    .filter((o) => AI_TERMINOLOGY_PATTERN.test(o.description))
    .map((o) => ({
      strength: "supporting" as const,
      reason: {
        code: "outcome-ai-terminology",
        description: `Desired outcome "${o.description}" uses explicit AI terminology.`,
        evidenceRefs: [{ entityType: "outcome", entityId: o.id, description: o.description }],
      },
    }));
}

function dedupeIds(refs: EvidenceReference[], type: EvidenceReference["entityType"]): string[] {
  return [...new Set(refs.filter((r) => r.entityType === type).map((r) => r.entityId))];
}

export function assessAIAgents(context: SolutionContext): CapabilityAssessment {
  const discovery = context.discoveryResult;

  const base = {
    capabilityId: AI_AGENTS_CAPABILITY_ID,
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
    (g) => g.blocking && g.relatedCapabilityIds.includes(AI_AGENTS_CAPABILITY_ID)
  );

  const signals = [
    ...needSignals(discovery.aiAgentNeeds),
    ...requirementSignals(discovery.requirements),
    ...outcomeSignals(discovery.desiredOutcomes),
  ];

  const strongSignals = signals.filter((s) => s.strength === "strong");
  const supportingSignals = signals.filter((s) => s.strength === "supporting");
  const signalCategoryCount = new Set(signals.map((s) => s.reason.code)).size;

  const allEvidence = signals.flatMap((s) => s.reason.evidenceRefs);
  const related = {
    relatedRequirementIds: dedupeIds(allEvidence, "requirement"),
    relatedOutcomeIds: dedupeIds(allEvidence, "outcome"),
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
