import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { HumanApprovalRequest } from "../../../governance/approvals/human-approval.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";

/**
 * Phase 1.5 — the real, structured output of
 * workflow-automation.planner.ts. Architectural plan only: no external
 * system is actually integrated (see AutomationCandidate.processId /
 * evidenceRefs — always DiscoveryResult entities, never a live API call).
 */
export interface AutomationCandidate {
  description: string;
  processId: string;
  evidenceRefs: EvidenceReference[];
}

export interface HumanTouchpoint {
  id: string;
  trigger: string;
  reason: string;
  approval: HumanApprovalRequest;
  evidenceRefs: EvidenceReference[];
}

export interface WorkflowAutomationPlan {
  processIds: string[];
  requirementIds: string[];
  systemIds: string[];
  automationCandidates: AutomationCandidate[];
  humanTouchpoints: HumanTouchpoint[];
  integrationNeeds: string[];
  informationGaps: string[];
  assumptions: string[];
}

/**
 * Phase 3 — WorkflowDefinition and its parts. One WorkflowDefinition per
 * relevant BusinessProcess (never one giant business-wide workflow — task
 * item 4). Represents a proposed, vendor-neutral TO-BE automation of that
 * process: the AS-IS record stays exactly where Phase 1 put it
 * (DiscoveryResult.processes) and is never rebuilt or removed; every
 * generated element here carries evidenceRefs back to it. See
 * docs/architecture/ARCHITECTURE.md "Workflow Specification Generation".
 */

// Only "business-event" is ever produced in Phase 3 — a technical trigger
// mechanism (HTTP/webhook/cron/queue) is not something discovery captures,
// and inventing one would violate task item 5. The union stays open for a
// future phase that might.
export type WorkflowTriggerType = "business-event";

export interface WorkflowTrigger {
  id: string;
  type: WorkflowTriggerType;
  description: string;
  evidenceRefs: EvidenceReference[];
}

export type WorkflowStepType = "automated-task" | "human-task" | "external-task" | "decision" | "notification";

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  description: string;
  actorIds?: string[];
  systemIds?: string[];
  evidenceRefs: EvidenceReference[];
}

export interface WorkflowTransition {
  id: string;
  fromStepId: string;
  toStepId: string;
  condition?: string;
  evidenceRefs?: EvidenceReference[];
}

export interface WorkflowDecisionBranch {
  label: string;
  toStepId: string;
}

export interface WorkflowDecision {
  id: string;
  stepId: string;
  condition: string;
  branches: WorkflowDecisionBranch[];
  evidenceRefs: EvidenceReference[];
}

/** Wraps the existing HumanApprovalRequest (governance/approvals) rather than duplicating an approval domain — task item 9. */
export interface WorkflowApproval {
  id: string;
  stepId: string;
  approval: HumanApprovalRequest;
  evidenceRefs: EvidenceReference[];
}

export type WorkflowNotificationChannel = "email" | "sms" | "whatsapp" | "push" | "unknown";

export interface WorkflowNotification {
  id: string;
  description: string;
  recipientActorIds?: string[];
  channel: WorkflowNotificationChannel;
  timing?: string;
  evidenceRefs: EvidenceReference[];
}

export interface WorkflowExternalSystem {
  systemId: string;
  role: string;
  interactionType?: string;
  evidenceRefs: EvidenceReference[];
}

export type WorkflowStatus = "draft" | "complete" | "needs-review";

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  processId: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
  decisions: WorkflowDecision[];
  approvals: WorkflowApproval[];
  notifications: WorkflowNotification[];
  externalSystems: WorkflowExternalSystem[];
  /** New gaps surfaced by generation itself (task item 16) — reuses InformationGap, never merged back into DiscoveryResult. */
  informationGaps: InformationGap[];
  evidenceRefs: EvidenceReference[];
  status: WorkflowStatus;
  statusReasons: string[];
}

/**
 * `implemented: true` means Stitchfy generated and validated a vendor-neutral
 * WorkflowDefinition for at least one relevant process — never that the
 * workflow is deployed or running against real systems (task item 22).
 */
export interface WorkflowAutomationSection {
  implemented: boolean;
  plan?: WorkflowAutomationPlan;
  workflows: WorkflowDefinition[];
  artifacts: ImplementationArtifact[];
  notes: string[];
}
