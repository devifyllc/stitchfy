/**
 * Turns each relevant BusinessProcess into a WorkflowDefinition — a
 * proposed, vendor-neutral TO-BE automation of that process. The AS-IS
 * record (BusinessProcess) is never rebuilt or removed; every generated
 * element cites evidenceRefs back to it.
 *
 * Classification approach (see docs/architecture/ARCHITECTURE.md "Workflow
 * Specification Generation" for the full rationale): process.steps are
 * walked in source order and classified by a small, ordered set of
 * deterministic rules — approval/review language always stays human-task
 * (never automated away, task item 14), notification language becomes a
 * "notification" step, and only a step whose text shares a significant
 * keyword with a discovered automationCandidate/manualSteps entry gets
 * reclassified — a plain deterministic string operation, not semantic/vector
 * matching. Steps that don't overlay onto anything fall back to an
 * actor/system name match. Nothing is a numeric score; every classification
 * is a named, inspectable rule.
 *
 * IDs are shared across every WorkflowDefinition generated in one call, so
 * they stay unique within the execution (task item 24).
 */

import type { SolutionContext } from "../../../core/contracts/context.js";
import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { BusinessProcess } from "../../../discovery/processes/business-process.types.js";
import type { BusinessActor } from "../../../discovery/actors/business-actor.types.js";
import type { SystemInventoryItem } from "../../../discovery/systems/system-inventory.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import { makeIdGenerator, sharesSignificantWord } from "../../../discovery/shared/section-lookup.js";
import type {
  WorkflowAutomationPlan,
  HumanTouchpoint,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStepType,
  WorkflowTrigger,
  WorkflowTransition,
  WorkflowDecision,
  WorkflowApproval,
  WorkflowNotification,
  WorkflowNotificationChannel,
  WorkflowExternalSystem,
} from "../schemas/workflow-automation.types.js";

// Approval/review language always wins — a step is never classified
// automated-task merely because a candidate happened to share a keyword
// with it (task item 14: "manual = should automatically be automated" is
// exactly the assumption this guards against). Distinct from (broader than)
// the planner's HumanTouchpoint APPROVAL_PATTERN — this one only needs to
// catch per-step wording, not decide whether a touchpoint exists.
const HUMAN_JUDGMENT_PATTERN = /approv|review|escalat|exception|human (review|approval|control)/i;
const NOTIFICATION_PATTERN = /\bsend\b|\bnotif|\bremind|\balert\b/i;
const CHANNEL_PATTERNS: Array<{ pattern: RegExp; channel: WorkflowNotificationChannel }> = [
  { pattern: /whatsapp/i, channel: "whatsapp" },
  { pattern: /\bemail\b/i, channel: "email" },
  { pattern: /\bsms\b|text message/i, channel: "sms" },
  { pattern: /\bpush\b/i, channel: "push" },
];

function findMentionedActor(text: string, actors: BusinessActor[]): BusinessActor | undefined {
  const lower = text.toLowerCase();
  return actors.find((a) => a.role && lower.includes(a.role.toLowerCase()));
}

function findMentionedSystem(text: string, systems: SystemInventoryItem[]): SystemInventoryItem | undefined {
  const lower = text.toLowerCase();
  return systems.find((s) => lower.includes(s.name.toLowerCase()));
}

interface StepClassification {
  type: WorkflowStepType;
  actorIds?: string[];
  systemIds?: string[];
  evidenceRefs: EvidenceReference[];
}

function classifyStep(
  stepText: string,
  process: BusinessProcess,
  discovery: DiscoveryResult,
  processRef: EvidenceReference
): StepClassification {
  const actors = discovery.actors.filter((a) => process.actorIds.includes(a.id));
  const systems = discovery.systems.filter((s) => process.systemIds.includes(s.id));

  if (HUMAN_JUDGMENT_PATTERN.test(stepText)) {
    const actor = findMentionedActor(stepText, actors);
    return { type: "human-task", actorIds: actor ? [actor.id] : undefined, evidenceRefs: [processRef] };
  }

  if (NOTIFICATION_PATTERN.test(stepText)) {
    return { type: "notification", evidenceRefs: [processRef] };
  }

  const matchedCandidate = process.automationCandidates.find((c) => sharesSignificantWord(stepText, c));
  if (matchedCandidate) {
    return {
      type: "automated-task",
      evidenceRefs: [processRef, { entityType: "process", entityId: process.id, description: matchedCandidate }],
    };
  }

  const matchedManual = process.manualSteps.find((m) => sharesSignificantWord(stepText, m));
  if (matchedManual) {
    return { type: "human-task", evidenceRefs: [processRef] };
  }

  const actor = findMentionedActor(stepText, actors);
  if (actor) {
    return { type: "human-task", actorIds: [actor.id], evidenceRefs: [processRef] };
  }
  const system = findMentionedSystem(stepText, systems);
  if (system) {
    return { type: "external-task", systemIds: [system.id], evidenceRefs: [processRef] };
  }

  return { type: "human-task", evidenceRefs: [processRef] };
}

function detectChannel(text: string): WorkflowNotificationChannel {
  return CHANNEL_PATTERNS.find(({ pattern }) => pattern.test(text))?.channel ?? "unknown";
}

/** Two touchpoints derived from a desired outcome and its own derived requirement share the same "Support: " text — dedupe so we don't generate near-duplicate decisions. */
function dedupeTouchpoints(touchpoints: HumanTouchpoint[]): HumanTouchpoint[] {
  const seen = new Map<string, HumanTouchpoint>();
  for (const t of touchpoints) {
    const key = t.trigger.replace(/^Support:\s*/i, "").trim().toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      existing.evidenceRefs = [...existing.evidenceRefs, ...t.evidenceRefs];
    } else {
      seen.set(key, { ...t, evidenceRefs: [...t.evidenceRefs] });
    }
  }
  return [...seen.values()];
}

interface IdGenerators {
  workflow: () => string;
  trigger: () => string;
  step: () => string;
  transition: () => string;
  decision: () => string;
  approval: () => string;
  notification: () => string;
  gap: () => string;
}

function buildOne(
  process: BusinessProcess,
  discovery: DiscoveryResult,
  touchpoints: HumanTouchpoint[],
  ids: IdGenerators
): WorkflowDefinition {
  const processRef: EvidenceReference = { entityType: "process", entityId: process.id, description: process.name };

  const triggers: WorkflowTrigger[] = [];
  if (process.trigger.trim().length > 0) {
    triggers.push({
      id: ids.trigger(),
      type: "business-event",
      description: process.trigger,
      evidenceRefs: [processRef],
    });
  }

  const steps: WorkflowStep[] = [];
  const transitions: WorkflowTransition[] = [];
  const notifications: WorkflowNotification[] = [];
  const newGaps: InformationGap[] = [];

  for (const stepText of process.steps) {
    const classification = classifyStep(stepText, process, discovery, processRef);
    const step: WorkflowStep = {
      id: ids.step(),
      name: stepText,
      type: classification.type,
      description: stepText,
      actorIds: classification.actorIds,
      systemIds: classification.systemIds,
      evidenceRefs: classification.evidenceRefs,
    };
    steps.push(step);

    if (steps.length > 1) {
      transitions.push({
        id: ids.transition(),
        fromStepId: steps[steps.length - 2].id,
        toStepId: step.id,
      });
    }

    if (classification.type === "notification") {
      const channel = detectChannel(stepText);
      const recipientActor = findMentionedActor(
        stepText,
        discovery.actors.filter((a) => process.actorIds.includes(a.id))
      );
      notifications.push({
        id: ids.notification(),
        description: stepText,
        recipientActorIds: recipientActor ? [recipientActor.id] : undefined,
        channel,
        evidenceRefs: [processRef],
      });
      if (channel === "unknown") {
        newGaps.push({
          id: ids.gap(),
          topic: "Notification channel",
          question: `What channel should be used for: "${stepText}"?`,
          importance: "medium",
          blocking: false,
          relatedCapabilityIds: ["workflow-automation"],
        });
      }
    }
  }

  const decisions: WorkflowDecision[] = [];
  const approvals: WorkflowApproval[] = [];
  let lastStepId = steps.length > 0 ? steps[steps.length - 1].id : undefined;

  for (const touchpoint of dedupeTouchpoints(touchpoints)) {
    const decisionStep: WorkflowStep = {
      id: ids.step(),
      name: `Decision: ${touchpoint.trigger}`,
      type: "decision",
      description: touchpoint.trigger,
      evidenceRefs: touchpoint.evidenceRefs,
    };
    const proceedStep: WorkflowStep = {
      id: ids.step(),
      name: "Proceed",
      type: "automated-task",
      description: "Continue without human review.",
      evidenceRefs: touchpoint.evidenceRefs,
    };
    const humanReviewStep: WorkflowStep = {
      id: ids.step(),
      name: "Human Review",
      type: "human-task",
      description: touchpoint.reason,
      evidenceRefs: touchpoint.evidenceRefs,
    };
    steps.push(decisionStep, proceedStep, humanReviewStep);

    if (lastStepId) {
      transitions.push({ id: ids.transition(), fromStepId: lastStepId, toStepId: decisionStep.id });
    }
    transitions.push({
      id: ids.transition(),
      fromStepId: decisionStep.id,
      toStepId: proceedStep.id,
      condition: `No: ${touchpoint.trigger}`,
      evidenceRefs: touchpoint.evidenceRefs,
    });
    transitions.push({
      id: ids.transition(),
      fromStepId: decisionStep.id,
      toStepId: humanReviewStep.id,
      condition: `Yes: ${touchpoint.trigger}`,
      evidenceRefs: touchpoint.evidenceRefs,
    });

    decisions.push({
      id: ids.decision(),
      stepId: decisionStep.id,
      condition: touchpoint.trigger,
      branches: [
        { label: "No", toStepId: proceedStep.id },
        { label: "Yes", toStepId: humanReviewStep.id },
      ],
      evidenceRefs: touchpoint.evidenceRefs,
    });

    const approverRole = touchpoint.approval.approverRole;
    approvals.push({
      id: ids.approval(),
      stepId: humanReviewStep.id,
      approval: touchpoint.approval,
      evidenceRefs: touchpoint.evidenceRefs,
    });
    if (approverRole === "designated approver") {
      newGaps.push({
        id: ids.gap(),
        topic: "Approval responsibility",
        question: `Who is specifically authorized to: ${touchpoint.reason}`,
        importance: "medium",
        blocking: false,
        relatedCapabilityIds: ["workflow-automation"],
      });
    }

    lastStepId = undefined; // proceed/human-review are terminal — no further AS-IS steps to chain to deterministically
  }

  if (triggers.length === 0) {
    newGaps.push({
      id: ids.gap(),
      topic: "Process trigger",
      question: `What explicitly triggers the "${process.name}" process?`,
      importance: "low",
      blocking: false,
      relatedCapabilityIds: ["workflow-automation"],
    });
  }

  const externalSystems: WorkflowExternalSystem[] = process.systemIds.map((systemId) => {
    const system = discovery.systems.find((s) => s.id === systemId);
    const integration = discovery.integrationNeeds.find((need) => need.relatedSystemIds.includes(systemId));
    return {
      systemId,
      role: system?.purpose || `${system?.category ?? "unknown"} system`,
      interactionType: integration ? "integration" : undefined,
      evidenceRefs: [{ entityType: "system", entityId: systemId, description: system?.name }],
    };
  });

  const orphanReasons: string[] = [];
  if (notifications.some((n) => n.channel === "unknown")) orphanReasons.push("notification channel unknown");
  if (approvals.some((a) => a.approval.approverRole === "designated approver")) {
    orphanReasons.push("approval responsibility unspecified");
  }
  if (triggers.length === 0) orphanReasons.push("no explicit trigger");

  const status = steps.length < 2 ? "draft" : orphanReasons.length > 0 ? "needs-review" : "complete";

  return {
    id: ids.workflow(),
    name: `${process.name} Workflow`,
    version: "1.0",
    processId: process.id,
    triggers,
    steps,
    transitions,
    decisions,
    approvals,
    notifications,
    externalSystems,
    informationGaps: newGaps,
    evidenceRefs: [processRef],
    status,
    statusReasons: orphanReasons,
  };
}

export function buildWorkflowDefinitions(
  context: SolutionContext,
  plan: WorkflowAutomationPlan
): WorkflowDefinition[] {
  const discovery = context.discoveryResult;
  if (!discovery) return [];

  const relevantProcesses = discovery.processes.filter((p) => plan.processIds.includes(p.id));
  if (relevantProcesses.length === 0) return [];

  const ids: IdGenerators = {
    workflow: makeIdGenerator("WF"),
    trigger: makeIdGenerator("TRIGGER"),
    step: makeIdGenerator("STEP"),
    transition: makeIdGenerator("TRANS"),
    decision: makeIdGenerator("DEC"),
    approval: makeIdGenerator("APPROVAL"),
    notification: makeIdGenerator("NOTIF"),
    gap: makeIdGenerator("WFGAP"),
  };

  // HumanTouchpoints are only attributable to a specific process when there
  // is exactly one relevant process — with several, there is no
  // deterministic way to know which touchpoint belongs to which, so none
  // are attributed rather than guessed (task item 13's "no fuzzy matching"
  // applied to this ambiguity too).
  const touchpointsPerProcess = relevantProcesses.length === 1 ? plan.humanTouchpoints : [];

  return relevantProcesses.map((process) => buildOne(process, discovery, touchpointsPerProcess, ids));
}
