/**
 * Builds the real, structured IntegrationPlan (task item 7) from
 * DiscoveryResult + the assessment already computed by
 * integrations.assessor.ts.
 *
 * Primary candidates come only from explicit DiscoveryResult.integrationNeeds
 * — the actual "a system boundary needs to be crossed" evidence (task item
 * 4: a system merely existing in a process is not enough). Process/
 * requirement/outcome signals only enrich an existing candidate's related
 * ids/evidence; they never spawn a new one on their own, UNLESS the
 * capability was selected with no integrationNeeds at all (an edge case —
 * selected purely via requirement/outcome signals), in which case one
 * minimal, honestly-vague candidate per related system is created rather
 * than silently producing an empty plan for a "recommended" capability.
 *
 * Candidates naming the same target system are merged when their purpose
 * text shares a significant keyword (sharesSignificantWord — a
 * deterministic string operation, not semantic matching, same technique
 * Phase 3 already uses) — this is what prevents the same Google Calendar
 * interaction appearing in a process, a requirement, and a desired outcome
 * from becoming three separate IntegrationDefinitions (task item 21).
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import type { DiscoveryResult } from "../../discovery/discovery-result.types.js";
import { makeIdGenerator, sharesSignificantWord } from "../../discovery/shared/section-lookup.js";
import type { IntegrationCandidate, IntegrationPlan } from "./schemas/integrations.types.js";

function emptyPlan(): IntegrationPlan {
  return {
    integrationNeedIds: [],
    workflowIds: [],
    processIds: [],
    requirementIds: [],
    systemIds: [],
    candidates: [],
    informationGaps: [],
    assumptions: [],
  };
}

interface DraftCandidate {
  sourceSystemId?: string;
  targetSystemId?: string;
  purpose: string;
  relatedProcessIds: Set<string>;
  relatedRequirementIds: Set<string>;
  sourceIntegrationNeedIds: Set<string>;
  evidenceRefs: EvidenceReference[];
}

/**
 * When a description names exactly one discovered system, only the target
 * boundary is known (task item 9 — the internal source stays unknown
 * rather than invented). When it names two, the convention is "the first
 * named system initiates, the last named system is the destination" (e.g.
 * "The Order Management application sends approved orders to the
 * Fulfillment API") — a deterministic sentence-position rule, not a guess
 * at anything not written.
 */
function resolveSourceTarget(
  description: string,
  systems: DiscoveryResult["systems"]
): { sourceSystemId?: string; targetSystemId?: string } {
  const lower = description.toLowerCase();
  const mentions = systems
    .map((s) => ({ id: s.id, index: lower.indexOf(s.name.toLowerCase()) }))
    .filter((m) => m.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (mentions.length >= 2) {
    return { sourceSystemId: mentions[0].id, targetSystemId: mentions[mentions.length - 1].id };
  }
  if (mentions.length === 1) {
    return { targetSystemId: mentions[0].id };
  }
  return {};
}

function mergeInto(draft: DraftCandidate, addition: DraftCandidate): void {
  if (!draft.sourceSystemId && addition.sourceSystemId) draft.sourceSystemId = addition.sourceSystemId;
  for (const id of addition.relatedProcessIds) draft.relatedProcessIds.add(id);
  for (const id of addition.relatedRequirementIds) draft.relatedRequirementIds.add(id);
  for (const id of addition.sourceIntegrationNeedIds) draft.sourceIntegrationNeedIds.add(id);
  draft.evidenceRefs.push(...addition.evidenceRefs);
}

function dedupeCandidates(drafts: DraftCandidate[]): DraftCandidate[] {
  const byTarget = new Map<string, DraftCandidate[]>();
  for (const draft of drafts) {
    const key = draft.targetSystemId ?? "unknown";
    const group = byTarget.get(key) ?? [];
    const match = group.find((existing) => sharesSignificantWord(existing.purpose, draft.purpose));
    if (match) {
      mergeInto(match, draft);
    } else {
      group.push(draft);
    }
    byTarget.set(key, group);
  }
  return [...byTarget.values()].flat();
}

export function buildIntegrationPlan(context: SolutionContext, assessment: CapabilityAssessment): IntegrationPlan {
  const discovery: DiscoveryResult | undefined = context.discoveryResult;
  if (!discovery) return emptyPlan();

  const drafts: DraftCandidate[] = discovery.integrationNeeds.map((need) => {
    const { sourceSystemId, targetSystemId } = resolveSourceTarget(need.description, discovery.systems);
    return {
      sourceSystemId,
      targetSystemId,
      purpose: need.description,
      relatedProcessIds: new Set<string>(),
      relatedRequirementIds: new Set<string>(),
      sourceIntegrationNeedIds: new Set([need.id]),
      evidenceRefs: [{ entityType: "integration", entityId: need.id, description: need.description }],
    };
  });

  // Enrich with process/requirement evidence already collected by the
  // assessor — only attach to an existing matching-target draft, never
  // spawn a new one from these alone.
  for (const processId of assessment.relatedProcessIds) {
    const process = discovery.processes.find((p) => p.id === processId);
    if (!process) continue;
    for (const systemId of process.systemIds) {
      const draft = drafts.find((d) => d.targetSystemId === systemId);
      if (draft) draft.relatedProcessIds.add(processId);
    }
  }
  for (const requirementId of assessment.relatedRequirementIds) {
    const requirement = discovery.requirements.find((r) => r.id === requirementId);
    if (!requirement) continue;
    for (const draft of drafts) {
      if (sharesSignificantWord(draft.purpose, requirement.description)) {
        draft.relatedRequirementIds.add(requirementId);
      }
    }
  }

  let candidateDrafts = dedupeCandidates(drafts);

  // Edge case: capability recommended with no explicit integration needs at
  // all (selected purely via requirement/outcome signals) — still surface
  // one honestly-vague candidate per related system rather than an empty
  // plan for a "recommended" capability.
  if (candidateDrafts.length === 0 && assessment.relatedSystemIds.length > 0) {
    candidateDrafts = assessment.relatedSystemIds.map((systemId) => {
      const system = discovery.systems.find((s) => s.id === systemId);
      return {
        sourceSystemId: undefined,
        targetSystemId: systemId,
        purpose: `Interaction with ${system?.name ?? systemId}`,
        relatedProcessIds: new Set(assessment.relatedProcessIds),
        relatedRequirementIds: new Set(assessment.relatedRequirementIds),
        sourceIntegrationNeedIds: new Set<string>(),
        evidenceRefs: assessment.reasons.flatMap((r) => r.evidenceRefs).filter((e) => e.entityType === "system" && e.entityId === systemId),
      };
    });
  }

  const nextCandidateId = makeIdGenerator("INT-CANDIDATE");
  const candidates: IntegrationCandidate[] = candidateDrafts.map((draft) => ({
    id: nextCandidateId(),
    sourceSystemId: draft.sourceSystemId,
    targetSystemId: draft.targetSystemId,
    purpose: draft.purpose,
    relatedWorkflowIds: [],
    relatedProcessIds: [...draft.relatedProcessIds],
    relatedRequirementIds: [...draft.relatedRequirementIds],
    sourceIntegrationNeedIds: [...draft.sourceIntegrationNeedIds],
    evidenceRefs: draft.evidenceRefs,
  }));

  return {
    integrationNeedIds: discovery.integrationNeeds.map((n) => n.id),
    workflowIds: [],
    processIds: assessment.relatedProcessIds,
    requirementIds: assessment.relatedRequirementIds,
    systemIds: assessment.relatedSystemIds,
    candidates,
    informationGaps: discovery.informationGaps
      .filter((g) => g.relatedCapabilityIds.includes("integrations"))
      .map((g) => g.id),
    assumptions: [
      "Architectural plan only — no external system is actually connected in this phase.",
      "A candidate's sourceSystemId stays unknown unless Discovery explicitly names the initiating application.",
    ],
  };
}
